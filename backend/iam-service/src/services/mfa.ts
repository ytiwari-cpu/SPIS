/**
 * SPIS IAM Service — MFA Service
 *
 * TOTP enrollment / verification (otpauth library)
 * Email OTP send / verify via Email Service
 */

import * as OTPAuth from 'otpauth'
import * as QRCode from 'qrcode'
import { config } from '../config.js'
import { createLogger } from '../../../base/logger.js'
const logger = createLogger('iam-service')
import { generateOtp, hashOtp, verifyOtp, generateTotpSecret } from '../lib/crypto.js'
import { sendOtpEmail } from '../lib/emailClient.js'
import {
  getUserById, updateUserMfa,
  createMfaFactor, getActiveMfaFactor, updateMfaFactorStatus,
  getMfaFactors, createOtpToken, getActiveOtpToken,
  incrementOtpAttempt, markOtpUsed,
} from '../db/repository.js'
import { publishMfaEnabled } from '../bus/rabbitmq.js'
import type { TotpEnrollResponse, OtpPurpose } from '../types.js'

// ═══════════════════════════════════════════════════════════════
// TOTP ENROLLMENT
// ═══════════════════════════════════════════════════════════════

/**
 * Start TOTP enrollment for a user.
 * Returns provisioning URI + QR code data URI + base32 secret.
 */
export async function enrollTotp(userId: string): Promise<TotpEnrollResponse> {
  const user = await getUserById(userId)
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 })

  // Generate secret
  const hexSecret = generateTotpSecret()

  // Create TOTP instance
  const totp = new OTPAuth.TOTP({
    issuer: config.totp.issuer,
    label: user.email,
    algorithm: config.totp.algorithm,
    digits: config.totp.digits,
    period: config.totp.period,
    secret: OTPAuth.Secret.fromHex(hexSecret),
  })

  const provisioningUri = totp.toString()
  const qrCode = await QRCode.toDataURL(provisioningUri)

  // Store pending MFA factor
  await createMfaFactor({
    userId,
    factorType: 'totp',
    secret: hexSecret,
    status: 'pending',
  })

  logger.info('TOTP enrollment started', { user_id: userId })

  return {
    provisioning_uri: provisioningUri,
    qr_code: qrCode,
    secret: totp.secret.base32,
  }
}

/**
 * Verify TOTP code to complete enrollment.
 * On success: activates the factor, enables MFA on user.
 */
export async function verifyTotpEnrollment(userId: string, code: string): Promise<{ message: string }> {
  const user = await getUserById(userId)
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 })

  // Get pending TOTP factor
  const factors = await getMfaFactors(userId)
  const pendingTotp = factors.find(f => f.factor_type === 'totp' && f.status === 'pending')
  if (!pendingTotp || !pendingTotp.secret) {
    throw Object.assign(new Error('No pending TOTP enrollment found'), { statusCode: 400 })
  }

  // Verify the code
  const totp = new OTPAuth.TOTP({
    issuer: config.totp.issuer,
    label: user.email,
    algorithm: config.totp.algorithm,
    digits: config.totp.digits,
    period: config.totp.period,
    secret: OTPAuth.Secret.fromHex(pendingTotp.secret),
  })

  const delta = totp.validate({ token: code, window: 1 })
  if (delta === null) {
    throw Object.assign(new Error('Invalid TOTP code'), { statusCode: 400 })
  }

  // Activate factor
  await updateMfaFactorStatus(pendingTotp.id, 'active')
  await updateUserMfa(userId, true, pendingTotp.secret)

  // Publish event
  publishMfaEnabled({
    user_id: userId,
    factor_type: 'totp',
    timestamp: new Date().toISOString(),
  })

  logger.info('TOTP enrollment verified', { user_id: userId })
  return { message: 'TOTP MFA enabled successfully' }
}

/**
 * Validate a TOTP code for an already-enrolled user (login step-up).
 */
export async function validateTotpCode(userId: string, code: string): Promise<boolean> {
  const user = await getUserById(userId)
  if (!user?.mfa_secret) return false

  const totp = new OTPAuth.TOTP({
    issuer: config.totp.issuer,
    label: user.email,
    algorithm: config.totp.algorithm,
    digits: config.totp.digits,
    period: config.totp.period,
    secret: OTPAuth.Secret.fromHex(user.mfa_secret),
  })

  const delta = totp.validate({ token: code, window: 1 })
  return delta !== null
}

// ═══════════════════════════════════════════════════════════════
// EMAIL OTP (fallback MFA)
// ═══════════════════════════════════════════════════════════════

/**
 * Send an email OTP for MFA verification.
 */
export async function sendEmailOtp(userId: string, purpose: OtpPurpose): Promise<{ message: string }> {
  const user = await getUserById(userId)
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 })

  const otp = generateOtp()
  const otpHash = hashOtp(otp)
  const expiresAt = new Date(Date.now() + config.otp.ttlMinutes * 60 * 1000)

  await createOtpToken({
    userId,
    otpHash,
    purpose,
    expiresAt,
    maxAttempts: config.otp.maxAttempts,
  })

  // Ensure email MFA factor exists
  const existingFactor = await getActiveMfaFactor(userId, 'email')
  if (!existingFactor) {
    await createMfaFactor({
      userId,
      factorType: 'email',
      email: user.email,
      status: 'active',
    })
  }

  try {
    await sendOtpEmail({ 
      to_email: user.email, 
      otp_code: otp,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes
    })
  } catch {
    throw Object.assign(
      new Error('Email Service unavailable — please try again later'),
      { statusCode: 503 },
    )
  }

  logger.info('Email OTP sent', { user_id: userId, purpose })
  return { message: 'OTP sent to your email' }
}

/**
 * Verify an email OTP code.
 */
export async function verifyEmailOtp(userId: string, code: string, purpose: OtpPurpose): Promise<boolean> {
  const token = await getActiveOtpToken(userId, purpose)
  if (!token) return false

  const attempts = await incrementOtpAttempt(token.id)
  if (attempts > token.max_attempts) return false

  if (!verifyOtp(code, token.otp_hash)) return false

  await markOtpUsed(token.id)

  // If this was mfa_email purpose and user doesn't have MFA enabled, enable it
  if (purpose === 'mfa_email') {
    const user = await getUserById(userId)
    if (user && !user.mfa_enabled) {
      await updateUserMfa(userId, true)
      publishMfaEnabled({
        user_id: userId,
        factor_type: 'email',
        timestamp: new Date().toISOString(),
      })
    }
  }

  logger.info('Email OTP verified', { user_id: userId, purpose })
  return true
}
