/**
 * IAM — MFA Service
 *
 * TOTP enrollment/verification and Email OTP send/verify.
 */

import * as OTPAuth from 'otpauth'
import * as QRCode from 'qrcode'
import { BaseService } from '../../../../base/baseService.js'
import { config } from '../../config.js'
import { logger } from '../../lib/logger.js'
import { generateOtp, hashOtp, verifyOtp, generateTotpSecret } from '../../lib/crypto.js'
import { sendOtpEmail } from '../../lib/emailClient.js'
import { publishMfaEnabled } from '../../bus/rabbitmq.js'
import { MfaRepository } from './mfaRepository.js'

export class MfaService extends BaseService {
  /** @param {MfaRepository} repo */
  constructor(repo) {
    super(repo.context)
    this.repo = repo
  }

  // ── TOTP ─────────────────────────────────────────────────────────────

  /** Begin TOTP enrollment — returns provisioning URI, QR data URL, and base32 secret. */
  async enrollTotp(userId) {
    const user = await this.repo.getUser(userId)
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 })

    const hexSecret = generateTotpSecret()
    const totp = new OTPAuth.TOTP({
      issuer: config.totp.issuer, label: user.email,
      algorithm: config.totp.algorithm, digits: config.totp.digits,
      period: config.totp.period, secret: OTPAuth.Secret.fromHex(hexSecret),
    })

    const provisioningUri = totp.toString()
    const qrCode = await QRCode.toDataURL(provisioningUri)

    await this.repo.createFactor({ userId, factorType: 'totp', secret: hexSecret, status: 'pending' })

    logger.info('TOTP enrollment started', { user_id: userId })
    return { provisioning_uri: provisioningUri, qr_code: qrCode, secret: totp.secret.base32 }
  }

  /** Verify TOTP code to complete enrollment — activates factor, enables MFA on user. */
  async verifyTotpEnrollment(userId, code) {
    const user = await this.repo.getUser(userId)
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 })

    const factors = await this.repo.getFactors(userId)
    const pendingTotp = factors.find(f => f.factor_type === 'totp' && f.status === 'pending')
    if (!pendingTotp?.secret) {
      throw Object.assign(new Error('No pending TOTP enrollment found'), { statusCode: 400 })
    }

    const totp = new OTPAuth.TOTP({
      issuer: config.totp.issuer, label: user.email,
      algorithm: config.totp.algorithm, digits: config.totp.digits,
      period: config.totp.period, secret: OTPAuth.Secret.fromHex(pendingTotp.secret),
    })
    const delta = totp.validate({ token: code, window: 1 })
    if (delta === null) throw Object.assign(new Error('Invalid TOTP code'), { statusCode: 400 })

    await this.repo.updateFactorStatus(pendingTotp.id, 'active')
    await this.repo.updateUserMfa(userId, true, pendingTotp.secret)

    publishMfaEnabled({ user_id: userId, factor_type: 'totp', timestamp: new Date().toISOString() })

    logger.info('TOTP enrollment verified', { user_id: userId })
    return { message: 'TOTP MFA enabled successfully' }
  }

  // ── Email OTP ─────────────────────────────────────────────────────────

  /** Send an email OTP for MFA. */
  async sendEmailOtp(userId, purpose) {
    const user = await this.repo.getUser(userId)
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 })

    const otp       = generateOtp()
    const otpHash   = hashOtp(otp)
    const expiresAt = new Date(Date.now() + config.otp.ttlMinutes * 60 * 1000)

    await this.repo.createOtpToken({ userId, otpHash, purpose, expiresAt, maxAttempts: config.otp.maxAttempts })

    const existingFactor = await this.repo.getActiveFactor(userId, 'email')
    if (!existingFactor) {
      await this.repo.createFactor({ userId, factorType: 'email', email: user.email, status: 'active' })
    }

    try {
      await sendOtpEmail({ to_email: user.email, otp_code: otp, expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() })
    } catch {
      throw Object.assign(new Error('Email Service unavailable — please try again later'), { statusCode: 503 })
    }

    logger.info('Email OTP sent', { user_id: userId, purpose })
    return { message: 'OTP sent to your email' }
  }

  /** Verify an email OTP code. Returns true if valid. */
  async verifyEmailOtp(userId, code, purpose) {
    const token = await this.repo.getActiveOtpToken(userId, purpose)
    if (!token) return false

    const attempts = await this.repo.incrementOtpAttempt(token.id)
    if (attempts > token.max_attempts) return false
    if (!verifyOtp(code, token.otp_hash)) return false

    await this.repo.markOtpUsed(token.id)

    if (purpose === 'mfa_email') {
      const user = await this.repo.getUser(userId)
      if (user && !user.mfa_enabled) {
        await this.repo.updateUserMfa(userId, true)
        publishMfaEnabled({ user_id: userId, factor_type: 'email', timestamp: new Date().toISOString() })
      }
    }

    logger.info('Email OTP verified', { user_id: userId, purpose })
    return true
  }
}
