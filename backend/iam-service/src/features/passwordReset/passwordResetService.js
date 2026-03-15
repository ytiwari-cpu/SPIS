/**
 * IAM — Password Reset Service
 *
 * Step 1: requestReset  — look up user in IAM only, generate OTP, send email.
 * Step 2: confirmReset  — verify OTP, hash new password, activate user.
 */

import bcrypt from 'bcrypt'
import { BaseService } from '../../../../base/baseService.js'
import { ApplicationError } from '../../../../base/applicationError.js'
import { config } from '../../config.js'
import { generateOtp, hashOtp, verifyOtp, hashNationalId } from '../../lib/crypto.js'
import { sendOtpEmail } from '../../lib/emailClient.js'
import { publishPasswordResetRequested } from '../../bus/rabbitmq.js'
import { PasswordResetRepository } from './passwordResetRepository.js'

export class PasswordResetService extends BaseService {
  /**
   * @param {import('../../../../base/apiContext.js').ApiContext} ctx
   * @param {import('./passwordResetRepository.js').PasswordResetRepository} repo
   */
  constructor(context) {
    super(context)
    this.passwordResetRepository = new PasswordResetRepository(context)
  }

  /**
   * Step 1 — Request OTP for password reset.
   * Only looks up user in the IAM users table (not Registry).
   */
  async requestReset(nationalId) {
    const nationalIdHash = hashNationalId(nationalId)
    const user = await this.passwordResetRepository.findByNationalIdHash(nationalIdHash)

    if (!user) {
      throw ApplicationError.notFound('User not found. Please try to login with OTP.')
    }
    if (!user.email) {
      throw ApplicationError.conflict('No email is registered for this user')
    }

    const otp       = generateOtp()
    const otpHash   = hashOtp(otp)
    const expiresAt = new Date(Date.now() + config.otp.ttlMinutes * 60 * 1000)

    const tokenId = PasswordResetService.generateUUID()
    await this.passwordResetRepository.createOtpToken({
      id:          tokenId,
      userId:      user.user_id,
      otpHash,
      purpose:     'password_reset',
      expiresAt,
      maxAttempts: config.otp.maxAttempts,
    })

    try {
      await sendOtpEmail({ to_email: user.email, otp_code: otp, expires_at: expiresAt.toISOString(), purpose: 'password_reset' })
    } catch {
      throw ApplicationError.serviceUnavailable('Email Service unavailable — please try again later')
    }

    // Publish event (fire and forget)
    publishPasswordResetRequested({
      user_id:     user.user_id,
      registry_id: user.registry_id || '',
      channel:     'email',
      otp_id:      tokenId,
    })

    this.log.info('Password reset OTP sent', { user_id: user.user_id, otp_id: tokenId })

    return { message: 'OTP sent to your registered email address', otp_id: tokenId }
  }

  /**
   * Step 2 — Confirm OTP + set new password.
   */
  async confirmReset({ nationalId, otp, newPassword }) {
    if (newPassword.length < config.passwordMinLength) {
      throw ApplicationError.badRequest(`Password must be at least ${config.passwordMinLength} characters`)
    }

    const nationalIdHash = hashNationalId(nationalId)
    const user = await this.passwordResetRepository.findByNationalIdHash(nationalIdHash)
    if (!user) {
      throw ApplicationError.notFound('No password reset in progress for this national ID')
    }

    const token = await this.passwordResetRepository.getActiveOtpToken(user.user_id, 'password_reset')
    if (!token) {
      throw ApplicationError.badRequest('OTP expired or not found — please request a new one')
    }

    const attempts = await this.passwordResetRepository.incrementOtpAttempt(token.id)
    if (attempts > token.max_attempts) {
      throw ApplicationError.tooManyRequests('Maximum OTP attempts exceeded — please request a new code')
    }

    if (!verifyOtp(otp, token.otp_hash)) {
      const remaining = token.max_attempts - attempts
      throw ApplicationError.badRequest(`Invalid OTP code. ${remaining} attempt(s) remaining.`)
    }

    await this.passwordResetRepository.markOtpUsed(token.id)

    // Hash and store new password
    const passwordHash = await bcrypt.hash(newPassword, 10)
    await this.passwordResetRepository.updatePassword(user.user_id, {
      password_hash: passwordHash, updated_at: new Date().toISOString(),
    })
    await this.passwordResetRepository.updateStatus(user.user_id, 'active')

    this.log.info('Password reset confirmed', { user_id: user.user_id })

    return { message: 'Password set successfully. You can now log in.', user_id: user.user_id }
  }
}
