/**
 * IAM — MFA Service
 *
 * TOTP enrollment/verification and Email OTP send/verify.
 */

import * as OTPAuth from 'otpauth'
import * as QRCode from 'qrcode'
import { BaseService } from '../../../../base/baseService.js'
import { ApplicationError } from '../../../../base/applicationError.js'
import { config } from '../../config.js'
import { generateOtp, hashOtp, verifyOtp, generateTotpSecret } from '../../lib/crypto.js'
import { sendOtpEmail } from '../../lib/emailClient.js'
import { publishMfaEnabled } from '../../bus/rabbitmq.js'
import { encryptSecret, decryptSecret, isEncrypted } from '../../../../base/auth/mfaCipher.js'
import { MfaRepository } from './mfaRepository.js'

export class MfaService extends BaseService {
  /**
   * @param {import('../../../../base/apiContext.js').ApiContext} ctx
   * @param {import('./mfaRepository.js').MfaRepository} repo
   */
  constructor(context) {
    super(context)
    this.mfaRepository = new MfaRepository(context)
  }

  // ── TOTP ─────────────────────────────────────────────────────────────

  /** Begin TOTP enrollment — returns provisioning URI, QR data URL, and base32 secret. */
  async enrollTotp(userId) {
    const user = await this.mfaRepository.getUser(userId)
    if (!user) {
      throw ApplicationError.notFound('User not found')
    }

    const hexSecret = generateTotpSecret()
    const totp = new OTPAuth.TOTP({
      issuer:    config.totp.issuer, label:     user.email,
      algorithm: config.totp.algorithm, digits:    config.totp.digits,
      period:    config.totp.period, secret:    OTPAuth.Secret.fromHex(hexSecret),
    })

    const provisioningUri = totp.toString()
    const qrCode = await QRCode.toDataURL(provisioningUri)

    // Encrypt the TOTP secret before storing in DB
    const encryptedSecret = encryptSecret(hexSecret)
    await this.mfaRepository.createFactor({ userId, factorType: 'totp', secret: encryptedSecret, status: 'pending' })

    this.log.info('TOTP enrollment started', { user_id: userId })
    return { provisioning_uri: provisioningUri, qr_code: qrCode, secret: totp.secret.base32 }
  }

  /** Verify TOTP code to complete enrollment — activates factor, enables MFA on user. */
  async verifyTotpEnrollment(userId, code) {
    const user = await this.mfaRepository.getUser(userId)
    if (!user) {
      throw ApplicationError.notFound('User not found')
    }

    const factors = await this.mfaRepository.getFactors(userId)
    const pendingTotp = factors.find(f => f.factor_type === 'totp' && f.status === 'pending')
    if (!pendingTotp?.secret) {
      throw ApplicationError.badRequest('No pending TOTP enrollment found')
    }

    // Decrypt the stored secret (transparent migration: if not encrypted, use as-is)
    const rawSecret = isEncrypted(pendingTotp.secret) ? decryptSecret(pendingTotp.secret) : pendingTotp.secret

    const totp = new OTPAuth.TOTP({
      issuer:    config.totp.issuer, label:     user.email,
      algorithm: config.totp.algorithm, digits:    config.totp.digits,
      period:    config.totp.period, secret:    OTPAuth.Secret.fromHex(rawSecret),
    })
    const delta = totp.validate({ token: code, window: 1 })
    if (delta === null) {
      throw ApplicationError.badRequest('Invalid TOTP code')
    }

    // Re-encrypt and store (covers migration of plaintext secrets)
    const encryptedSecret = isEncrypted(pendingTotp.secret) ? pendingTotp.secret : encryptSecret(rawSecret)
    await this.mfaRepository.updateFactorStatus(pendingTotp.id, 'active')
    await this.mfaRepository.updateUserMfa(userId, true, encryptedSecret)

    publishMfaEnabled({ user_id: userId, factor_type: 'totp', timestamp: new Date().toISOString() })

    this.log.info('TOTP enrollment verified', { user_id: userId })
    return { message: 'TOTP MFA enabled successfully' }
  }

  // ── Email OTP ─────────────────────────────────────────────────────────

  /** Send an email OTP for MFA. */
  async sendEmailOtp(userId, purpose) {
    const user = await this.mfaRepository.getUser(userId)
    if (!user) {
      throw ApplicationError.notFound('User not found')
    }

    const otp       = generateOtp()
    const otpHash   = hashOtp(otp)
    const expiresAt = new Date(Date.now() + config.otp.ttlMinutes * 60 * 1000)

    const tokenId = MfaService.generateUUID()
    await this.mfaRepository.createOtpToken({
      id: tokenId, userId, otpHash, purpose, expiresAt, maxAttempts: config.otp.maxAttempts,
    })

    const existingFactor = await this.mfaRepository.getActiveFactor(userId, 'email')
    if (!existingFactor) {
      await this.mfaRepository.createFactor({ userId, factorType: 'email', email: user.email, status: 'active' })
    }

    try {
      await sendOtpEmail({
        to_email: user.email, otp_code: otp,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      })
    } catch {
      throw ApplicationError.serviceUnavailable('Email Service unavailable — please try again later')
    }

    this.log.info('Email OTP sent', { user_id: userId, purpose })
    return { message: 'OTP sent to your email' }
  }

  /** Verify an email OTP code. Returns true if valid. */
  async verifyEmailOtp(userId, code, purpose) {
    const token = await this.mfaRepository.getActiveOtpToken(userId, purpose)
    if (!token) {
      return false
    }

    const attempts = await this.mfaRepository.incrementOtpAttempt(token.id)
    if (attempts > token.max_attempts) {
      return false
    }
    if (!verifyOtp(code, token.otp_hash)) {
      return false
    }

    await this.mfaRepository.markOtpUsed(token.id)

    if (purpose === 'mfa_email') {
      const user = await this.mfaRepository.getUser(userId)
      if (user && !user.mfa_enabled) {
        await this.mfaRepository.updateUserMfa(userId, true)
        publishMfaEnabled({ user_id: userId, factor_type: 'email', timestamp: new Date().toISOString() })
      }
    }

    this.log.info('Email OTP verified', { user_id: userId, purpose })
    return true
  }
}
