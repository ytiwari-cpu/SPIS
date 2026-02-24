/**
 * SPIS IAM Service — Password Reset Service
 *
 * Flow A from the prompt:
 *   1. User provides national_id → lookup in Registry
 *   2. If found → generate OTP, hash it, store token, send via Email Service
 *   3. User submits OTP + new_password → verify → set in Keycloak → activate user
 */

import { config } from '../config.js'
import { logger } from '../lib/logger.js'
import { generateOtp, hashOtp, verifyOtp, hashNationalId } from '../lib/crypto.js'
import { sendOtpEmail } from '../lib/emailClient.js'
import {
  getUserByNationalIdHash, updateUserStatus,
  createOtpToken, getActiveOtpToken,
  incrementOtpAttempt, markOtpUsed,
} from '../db/repository.js'
import { publishPasswordResetRequested } from '../bus/rabbitmq.js'
import {
  getKeycloakUserByUsername,
  createKeycloakUser,
  updateKeycloakPassword,
} from '../lib/keycloak.js'

/**
 * Step 1: Request password reset by national_id.
 *
 * - Look up national_id ONLY in users table (not family_member)
 * - If not found, return error suggesting OTP login
 * - Generate OTP, store hashed, send via Email Service
 */
export async function requestPasswordReset(nationalId: string): Promise<{
  message: string
  otp_id: string
}> {
  // 1. Hash the national_id for lookup
  const nationalIdHash = hashNationalId(nationalId)

  // 2. Look up ONLY in users table (not Registry/family_member)
  const user = await getUserByNationalIdHash(nationalIdHash)
  if (!user) {
    // User not found in users table - suggest OTP login
    const err = new Error('User not found. Please try to login with OTP.')
    ;(err as Error & { statusCode: number }).statusCode = 404
    throw err
  }

  const email = user.email
  if (!email) {
    const err = new Error('No email is registered for this user')
    ;(err as Error & { statusCode: number }).statusCode = 409
    throw err
  }

  // 3. Generate OTP
  const otp = generateOtp()
  const otpHash = hashOtp(otp)
  const expiresAt = new Date(Date.now() + config.otp.ttlMinutes * 60 * 1000)

  const token = await createOtpToken({
    userId: user.user_id,
    otpHash,
    purpose: 'password_reset',
    expiresAt,
    maxAttempts: config.otp.maxAttempts,
  })

  // 4. Send OTP via Email Service
  try {
    await sendOtpEmail({ 
      to_email: email, 
      otp_code: otp,
      expires_at: expiresAt.toISOString(),
      purpose: 'password_reset'
    })
  } catch {
    // Degraded mode — Email Service unavailable
    const err = new Error('Email Service unavailable — please try again later')
    ;(err as Error & { statusCode: number }).statusCode = 503
    throw err
  }

  // 5. Publish event
  publishPasswordResetRequested({
    user_id: user.user_id,
    registry_id: user.registry_id || '',
    channel: 'email',
    otp_id: token.id,
  })

  logger.info('Password reset OTP sent', {
    user_id: user.user_id,
    otp_id: token.id,
  })

  return {
    message: 'OTP sent to your registered email address',
    otp_id: token.id,
  }
}

/**
 * Step 2: Confirm password reset with OTP + new password.
 *
 * - Verify OTP (TTL 10m, max 5 attempts)
 * - Hash password with bcrypt and store in IAM DB
 * - Activate IAM user
 */
export async function confirmPasswordReset(params: {
  nationalId: string
  otp: string
  newPassword: string
}): Promise<{ message: string; user_id: string }> {
  const { nationalId, otp, newPassword } = params

  // Validate password length
  if (newPassword.length < config.passwordMinLength) {
    const err = new Error(`Password must be at least ${config.passwordMinLength} characters`)
    ;(err as Error & { statusCode: number }).statusCode = 400
    throw err
  }

  // 1. Find user by national_id hash
  const nationalIdHash = hashNationalId(nationalId)
  const user = await getUserByNationalIdHash(nationalIdHash)
  if (!user) {
    const err = new Error('No password reset in progress for this national ID')
    ;(err as Error & { statusCode: number }).statusCode = 404
    throw err
  }

  // 2. Find active OTP token
  const token = await getActiveOtpToken(user.user_id, 'password_reset')
  if (!token) {
    const err = new Error('OTP expired or not found — please request a new one')
    ;(err as Error & { statusCode: number }).statusCode = 400
    throw err
  }

  // 3. Increment attempt and check limit
  const attempts = await incrementOtpAttempt(token.id)
  if (attempts > token.max_attempts) {
    const err = new Error('Maximum OTP attempts exceeded — please request a new code')
    ;(err as Error & { statusCode: number }).statusCode = 429
    throw err
  }

  // 4. Verify OTP
  if (!verifyOtp(otp, token.otp_hash)) {
    const remaining = token.max_attempts - attempts
    const err = new Error(`Invalid OTP code. ${remaining} attempt(s) remaining.`)
    ;(err as Error & { statusCode: number }).statusCode = 400
    throw err
  }

  // 5. Mark OTP as used
  await markOtpUsed(token.id)

  // 6. Set password in Keycloak and save hash to IAM DB for cross-developer sync
  try {
    const keycloakUser = await getKeycloakUserByUsername(nationalId)

    if (keycloakUser) {
      // User exists in Keycloak — update password
      await updateKeycloakPassword(keycloakUser.id, newPassword)
      logger.info('Password updated in Keycloak', { user_id: user.user_id })
    } else {
      // User not in Keycloak — create with the new password
      await createKeycloakUser({
        username: nationalId,
        email: user.email,
        password: newPassword,
        enabled: true,
      })
      logger.info('User created in Keycloak with password', { user_id: user.user_id })
    }

  } catch (keycloakError) {
    // If Keycloak fails, the password reset fails completely
    logger.error('Failed to set password in Keycloak', {
      user_id: user.user_id,
      error: (keycloakError as Error).message,
    })
    const err = new Error('Password reset failed. Please try again.')
    ;(err as Error & { statusCode: number }).statusCode = 500
    throw err
  }

  // 7. Activate IAM user
  await updateUserStatus(user.user_id, 'active')

  logger.info('Password reset confirmed - user created/updated in Keycloak only', { user_id: user.user_id })

  return {
    message: 'Password set successfully. You can now log in.',
    user_id: user.user_id,
  }
}
