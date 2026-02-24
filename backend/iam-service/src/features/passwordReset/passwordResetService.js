/**
 * IAM — Password Reset Service
 *
 * Step 1: requestReset  — look up user in IAM only, generate OTP, send email.
 * Step 2: confirmReset  — verify OTP, hash new password, activate user.
 */

import bcrypt from 'bcrypt'
import { BaseService } from '../../../../base/baseService.js'
import { config } from '../../config.js'
import { logger } from '../../lib/logger.js'
import { generateOtp, hashOtp, verifyOtp, hashNationalId } from '../../lib/crypto.js'
import { sendOtpEmail } from '../../lib/emailClient.js'
import { publishPasswordResetRequested } from '../../bus/rabbitmq.js'
import { PasswordResetRepository } from './passwordResetRepository.js'

export class PasswordResetService extends BaseService {
  /** @param {PasswordResetRepository} repo */
  constructor(repo) {
    super(repo.context)
    this.repo = repo
  }

  /**
   * Step 1 — Request OTP for password reset.
   * Only looks up user in the IAM users table (not Registry).
   */
  async requestReset(nationalId) {
    const nationalIdHash = hashNationalId(nationalId)
    const user = await this.repo.findByNationalIdHash(nationalIdHash)

    if (!user) {
      throw Object.assign(new Error('User not found. Please try to login with OTP.'), { statusCode: 404 })
    }
    if (!user.email) {
      throw Object.assign(new Error('No email is registered for this user'), { statusCode: 409 })
    }

    const otp       = generateOtp()
    const otpHash   = hashOtp(otp)
    const expiresAt = new Date(Date.now() + config.otp.ttlMinutes * 60 * 1000)

    const token = await this.repo.createOtpToken({
      userId:      user.user_id,
      otpHash,
      purpose:     'password_reset',
      expiresAt,
      maxAttempts: config.otp.maxAttempts,
    })

    try {
      await sendOtpEmail({ to_email: user.email, otp_code: otp, expires_at: expiresAt.toISOString(), purpose: 'password_reset' })
    } catch {
      throw Object.assign(new Error('Email Service unavailable — please try again later'), { statusCode: 503 })
    }

    // Publish event (fire and forget)
    publishPasswordResetRequested({
      user_id:     user.user_id,
      registry_id: user.registry_id || '',
      channel:     'email',
      otp_id:      token.id,
    })

    logger.info('Password reset OTP sent', { user_id: user.user_id, otp_id: token.id })

    return { message: 'OTP sent to your registered email address', otp_id: token.id }
  }

  /**
   * Step 2 — Confirm OTP + set new password.
   */
  async confirmReset({ nationalId, otp, newPassword }) {
    if (newPassword.length < config.passwordMinLength) {
      throw Object.assign(
        new Error(`Password must be at least ${config.passwordMinLength} characters`),
        { statusCode: 400 },
      )
    }

    const nationalIdHash = hashNationalId(nationalId)
    const user = await this.repo.findByNationalIdHash(nationalIdHash)
    if (!user) {
      throw Object.assign(new Error('No password reset in progress for this national ID'), { statusCode: 404 })
    }

    const token = await this.repo.getActiveOtpToken(user.user_id, 'password_reset')
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

    // Hash and store new password
    const passwordHash = await bcrypt.hash(newPassword, 10)
    await this.repo.updatePassword(user.user_id, passwordHash)
    await this.repo.updateStatus(user.user_id, 'active')

    logger.info('Password reset confirmed', { user_id: user.user_id })

    return { message: 'Password set successfully. You can now log in.', user_id: user.user_id }
  }
}
