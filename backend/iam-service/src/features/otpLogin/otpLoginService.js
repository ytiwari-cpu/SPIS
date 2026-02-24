/**
 * IAM — OTP Login Service
 *
 * Two-step OTP login flow (no password required).
 * Step 1: requestOtp — look up user, generate & send OTP.
 * Step 2: verifyOtp  — verify OTP, activate user if pending, issue JWT.
 */

import { SignJWT } from 'jose'
import { BaseService } from '../../../../base/baseService.js'
import { config } from '../../config.js'
import { logger } from '../../lib/logger.js'
import { generateOtp, hashOtp, verifyOtp, hashNationalId } from '../../lib/crypto.js'
import { sendOtpEmail } from '../../lib/emailClient.js'
import { lookupByNationalId } from '../../lib/registryClient.js'
import { OtpLoginRepository } from './otpLoginRepository.js'

export class OtpLoginService extends BaseService {
  /** @param {OtpLoginRepository} repo */
  constructor(repo) {
    super(repo.context)
    this.repo = repo
  }

  /**
   * Step 1 — Request OTP.
   * Looks up user in IAM first, then in Registry if not found.
   */
  async requestOtp(nationalId) {
    const nationalIdHash = hashNationalId(nationalId)
    let user = await this.repo.findByNationalIdHash(nationalIdHash)
    let userExistsInIam = !!user
    let email = null

    if (user) {
      email = user.email
      logger.info('OTP login request - user found in IAM', { user_id: user.user_id })
    } else {
      // Look up in Registry (family_member)
      const registryResult = await lookupByNationalId(nationalId)
      if (!registryResult) {
        throw Object.assign(new Error('National ID not found in system'), { statusCode: 404 })
      }
      email = registryResult.email
      if (!email) {
        throw Object.assign(new Error('No email registered for this national ID'), { statusCode: 409 })
      }

      // Create pending user
      user = await this.repo.createUser({
        email,
        registryId:     registryResult.registry_id || undefined,
        nationalIdHash,
        status:         'pending',
      })
      await this.repo.addRole(user.user_id, 'Citizen')
      logger.info('OTP login request - pending user created from Registry', { user_id: user.user_id })
    }

    // Generate + store OTP
    const otp       = generateOtp()
    const otpHash   = hashOtp(otp)
    const expiresAt = new Date(Date.now() + config.otp.ttlMinutes * 60 * 1000)

    const token = await this.repo.createOtpToken({
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
      throw Object.assign(new Error('Email Service unavailable — please try again later'), { statusCode: 503 })
    }

    logger.info('OTP login request sent', { user_id: user.user_id, otp_id: token.id })

    return {
      message:            'OTP sent to your registered email address',
      otp_id:             token.id,
      user_exists_in_iam: userExistsInIam,
    }
  }

  /**
   * Step 2 — Verify OTP and issue JWT.
   */
  async verifyOtp({ nationalId, otp, ip, userAgent }) {
    const nationalIdHash = hashNationalId(nationalId)
    const user = await this.repo.findByNationalIdHash(nationalIdHash)

    if (!user) {
      throw Object.assign(new Error('No OTP login in progress for this national ID'), { statusCode: 404 })
    }

    const token = await this.repo.getActiveOtpToken(user.user_id, 'otp_login')
    if (!token) {
      throw Object.assign(new Error('OTP expired or not found — please request a new one'), { statusCode: 400 })
    }

    const attempts = await this.repo.incrementOtpAttempt(token.id)
    if (attempts > token.max_attempts) {
      throw Object.assign(new Error('Maximum OTP attempts exceeded — please request a new code'), { statusCode: 429 })
    }

    if (!verifyOtp(otp, token.otp_hash)) {
      const remaining = token.max_attempts - attempts
      throw Object.assign(new Error(`Invalid OTP code. ${remaining} attempt(s) remaining.`), { statusCode: 400 })
    }

    await this.repo.markOtpUsed(token.id)

    const isNewUser = user.status === 'pending'
    if (isNewUser) {
      await this.repo.updateStatus(user.user_id, 'active')
    }

    const roleRows    = await this.repo.getRoles(user.user_id)
    const roles       = roleRows.map(r => r.role_name)
    const permissions = await this.repo.getPermissions(user.user_id)

    // Issue JWT
    const secret   = new TextEncoder().encode(config.jwt.secret)
    const jwtToken = await new SignJWT({
      sub:         user.user_id,
      email:       user.email,
      national_id: nationalId,
      roles,
      permissions,
      registry_id: user.registry_id || undefined,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer(config.jwt.issuer)
      .setAudience(config.jwt.audience)
      .setExpirationTime(`${config.jwt.expiresInSeconds}s`)
      .sign(secret)

    await this.repo.recordEvent({ userId: user.user_id, ip, userAgent, outcome: 'success' })

    logger.info('OTP login successful', { user_id: user.user_id, is_new_user: isNewUser })

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
