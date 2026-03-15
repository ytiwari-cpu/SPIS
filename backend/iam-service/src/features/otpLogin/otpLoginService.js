/**
 * IAM — OTP Login Service
 *
 * Two-step OTP login flow (no password required).
 * Step 1: requestOtp — look up user, generate & send OTP.
 * Step 2: verifyOtp  — verify OTP, activate user if pending, issue JWT.
 */

import { BaseService } from '../../../../base/baseService.js'
import { ApplicationError } from '../../../../base/applicationError.js'
import { signToken } from '../../../../base/auth/signToken.js'
import { config } from '../../config.js'
import { generateOtp, hashOtp, verifyOtp, hashNationalId } from '../../lib/crypto.js'
import { sendOtpEmail } from '../../lib/emailClient.js'
import { lookupByNationalId } from '../../lib/registryClient.js'
import { OtpLoginRepository } from './otpLoginRepository.js'

export class OtpLoginService extends BaseService {
  /**
   * @param {import('../../../../base/apiContext.js').ApiContext} ctx
   * @param {import('./otpLoginRepository.js').OtpLoginRepository} repo
   */
  constructor(context) {
    super(context)
    this.request = context.request
    this.otpLoginRepository = new OtpLoginRepository(context)
  }

  /**
   * Step 1 — Request OTP.
   * Looks up user in IAM first, then in Registry if not found.
   */
  async requestOtp(nationalId) {
    const nationalIdHash = hashNationalId(nationalId)
    let user = await this.otpLoginRepository.findByNationalIdHash(nationalIdHash)
    const userExistsInIam = !!user
    let email = null

    if (user) {
      email = user.email
      this.log.info('OTP login request - user found in IAM', { user_id: user.user_id })
    } else {
      // Look up in Registry (family_member)
      const registryResult = await lookupByNationalId(nationalId)
      if (!registryResult) {
        throw ApplicationError.notFound('National ID not found in system')
      }
      email = registryResult.email
      if (!email) {
        throw ApplicationError.conflict('No email registered for this national ID')
      }

      // Create pending user
      const userId = OtpLoginService.generateUUID()
      await this.otpLoginRepository.createUser({
        user_id:          userId,
        email,
        registry_id:      registryResult.registry_id || null,
        national_id_hash: nationalIdHash,
        status:           'pending',
      })
      user = { user_id: userId, email, status: 'pending' }
      const isRoleExists = await this.otpLoginRepository.isUserRoleExists(user.user_id, 'Citizen')
      if (!isRoleExists) {
        await this.otpLoginRepository.insertUserRole(user.user_id, 'Citizen')
      }
      this.log.info('OTP login request - pending user created from Registry', { user_id: user.user_id })
    }

    // Generate + store OTP
    const otp       = generateOtp()
    const otpHash   = hashOtp(otp)
    const expiresAt = new Date(Date.now() + config.otp.ttlMinutes * 60 * 1000)

    const tokenId = OtpLoginService.generateUUID()
    await this.otpLoginRepository.createOtpToken({
      id:          tokenId,
      userId:      user.user_id,
      otpHash,
      purpose:     'otp_login',
      expiresAt,
      maxAttempts: config.otp.maxAttempts,
    })

    // Send email
    try {
      await sendOtpEmail({ to_email: email, otp_code: otp, expires_at: expiresAt.toISOString(), purpose: 'login' })
    } catch {
      throw ApplicationError.serviceUnavailable('Email Service unavailable — please try again later')
    }

    this.log.info('OTP login request sent', { user_id: user.user_id, otp_id: tokenId })

    return {
      message:            'OTP sent to your registered email address',
      otp_id:             tokenId,
      user_exists_in_iam: userExistsInIam,
    }
  }

  /**
   * Step 2 — Verify OTP and issue JWT.
   */
  async verifyOtp({ nationalId, otp, ip, userAgent }) {
    const nationalIdHash = hashNationalId(nationalId)
    const user = await this.otpLoginRepository.findByNationalIdHash(nationalIdHash)

    if (!user) {
      throw ApplicationError.notFound('No OTP login in progress for this national ID')
    }

    const token = await this.otpLoginRepository.getActiveOtpToken(user.user_id, 'otp_login')
    if (!token) {
      throw ApplicationError.badRequest('OTP expired or not found — please request a new one')
    }

    const attempts = await this.otpLoginRepository.incrementOtpAttempt(token.id)
    if (attempts > token.max_attempts) {
      throw ApplicationError.tooManyRequests('Maximum OTP attempts exceeded — please request a new code')
    }

    if (!verifyOtp(otp, token.otp_hash)) {
      const remaining = token.max_attempts - attempts
      throw ApplicationError.badRequest(`Invalid OTP code. ${remaining} attempt(s) remaining.`)
    }

    await this.otpLoginRepository.markOtpUsed(token.id)

    const isNewUser = user.status === 'pending'
    // Activate pending users; unlock locked/disabled accounts so password login works again
    if (isNewUser || user.status === 'locked' || user.status === 'disabled') {
      await this.otpLoginRepository.updateStatus(user.user_id, 'active')
    }
    // Always reset failed login counter and lock timer on successful OTP login
    await this.otpLoginRepository.unlockUser(user.user_id)

    const roleRows    = await this.otpLoginRepository.getRoles(user.user_id)
    const roles       = roleRows.map(r => r.role_name)
    const permissions = await this.otpLoginRepository.getPermissions(user.user_id)

    // Issue JWT (national_id intentionally omitted — PII, never in JWT)
    const jwtToken = await signToken(
      { userId: user.user_id, email: user.email, roles, permissions, registryId: user.registry_id || undefined },
      {
        secret: config.jwt.secret, expiresInSeconds: config.jwt.expiresInSeconds,
        issuer: config.jwt.issuer, audience: config.jwt.audience,
      },
    )

    await this.otpLoginRepository.recordEvent({ userId: user.user_id, ip, userAgent, outcome: 'success' })

    this.log.info('OTP login successful', { user_id: user.user_id, is_new_user: isNewUser })

    return {
      access_token: jwtToken,
      token_type:   'Bearer',
      expires_in:   config.jwt.expiresInSeconds,
      user_id:      user.user_id,
      email:        user.email,
      roles,
      permissions,
      registry_id:  user.registry_id || null,
      is_new_user:  isNewUser,
    }
  }
}
