/**
 * SPIS IAM Service — OTP Login Service
 *
 * Flow for OTP-based login (no password required):
 *   1. User provides national_id → search in users table first
 *   2. If not found in users → search in family_member table (via Registry service)
 *   3. Generate OTP, send via Email Service
 *   4. User submits OTP → verify → generate JWT token
 *   5. If user was found in family_member but not in users → create user in users table
 */

import { SignJWT } from 'jose'
import { config } from '../config.js'
import { logger } from '../lib/logger.js'
import { generateOtp, hashOtp, verifyOtp, hashNationalId } from '../lib/crypto.js'
import { sendOtpEmail } from '../lib/emailClient.js'
import { lookupByNationalId } from '../lib/registryClient.js'
import {
  getUserByNationalIdHash,
  createUser,
  updateUserStatus,
  getUserRoles,
  getUserPermissions,
  recordLoginEvent,
  addRole,
  createOtpToken,
  getActiveOtpToken,
  incrementOtpAttempt,
  markOtpUsed,
} from '../db/repository.js'

export interface OtpLoginRequestResult {
  message: string
  otp_id: string
  user_exists_in_iam: boolean
}

export interface OtpLoginVerifyResult {
  access_token: string
  token_type: 'Bearer'
  expires_in: number
  user_id: string
  email: string
  roles: string[]
  permissions: string[]
  registry_id: string | null
  is_new_user: boolean
}

/**
 * Step 1: Request OTP for login by national_id.
 *
 * - Search in users table first (by national_id hash)
 * - If not found, search in family_member table (via Registry service)
 * - Generate OTP, store hashed, send via Email Service
 */
export async function requestOtpLogin(nationalId: string): Promise<OtpLoginRequestResult> {
  const nationalIdHash = hashNationalId(nationalId)

  // 1. Check if user exists in IAM users table
  let user = await getUserByNationalIdHash(nationalIdHash)
  let userExistsInIam = !!user
  let email: string | null = null
  let registryId: string | null = null

  if (user) {
    // User exists in IAM
    email = user.email
    registryId = user.registry_id
    logger.info('OTP login request - user found in IAM', { user_id: user.user_id })
  } else {
    // 2. User not in IAM - lookup in Registry (family_member table)
    const registryResult = await lookupByNationalId(nationalId)
    
    if (!registryResult) {
      const err = new Error('National ID not found in system')
      ;(err as Error & { statusCode: number }).statusCode = 404
      throw err
    }

    email = registryResult.email

    if (!email) {
      const err = new Error('No email registered for this national ID')
      ;(err as Error & { statusCode: number }).statusCode = 409
      throw err
    }

    // Create pending user (will be activated after OTP verification)
    user = await createUser({
      email,
      registryId: registryResult.registry_id || undefined,
      nationalIdHash,
      status: 'pending',
    })

    // Assign default Citizen role
    await addRole(user.user_id, 'Citizen')

    logger.info('OTP login request - user created from family_member', {
      user_id: user.user_id,
      registry_id: registryId,
    })
  }

  // 3. Generate OTP
  const otp = generateOtp()
  const otpHash = hashOtp(otp)
  const expiresAt = new Date(Date.now() + config.otp.ttlMinutes * 60 * 1000)

  const token = await createOtpToken({
    userId: user.user_id,
    otpHash,
    purpose: 'otp_login',
    expiresAt,
    maxAttempts: config.otp.maxAttempts,
  })

  // 4. Send OTP via Email Service
  try {
    await sendOtpEmail({
      to_email: email,
      otp_code: otp,
      expires_at: expiresAt.toISOString(),
      purpose: 'login',
    })
  } catch {
    const err = new Error('Email Service unavailable — please try again later')
    ;(err as Error & { statusCode: number }).statusCode = 503
    throw err
  }

  logger.info('OTP login request sent', {
    user_id: user.user_id,
    otp_id: token.id,
    user_exists_in_iam: userExistsInIam,
  })

  return {
    message: 'OTP sent to your registered email address',
    otp_id: token.id,
    user_exists_in_iam: userExistsInIam,
  }
}

/**
 * Step 2: Verify OTP and login.
 *
 * - Verify OTP (TTL 10m, max 5 attempts)
 * - Activate user if pending
 * - Generate JWT token with user info + roles
 */
export async function verifyOtpLogin(params: {
  nationalId: string
  otp: string
  ip: string
  userAgent: string
}): Promise<OtpLoginVerifyResult> {
  const { nationalId, otp, ip, userAgent } = params

  // 1. Find user by national_id hash
  const nationalIdHash = hashNationalId(nationalId)
  const user = await getUserByNationalIdHash(nationalIdHash)
  
  if (!user) {
    const err = new Error('No OTP login in progress for this national ID')
    ;(err as Error & { statusCode: number }).statusCode = 404
    throw err
  }

  // 2. Find active OTP token
  const token = await getActiveOtpToken(user.user_id, 'otp_login')
  
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

  // 6. Check if this is a new user (was pending)
  const isNewUser = user.status === 'pending'

  // 7. Activate user if pending
  if (user.status === 'pending') {
    await updateUserStatus(user.user_id, 'active')
  }

  // 8. Get user roles and permissions
  const roleRows = await getUserRoles(user.user_id)
  const roles = roleRows.map(r => r.role_name)
  const permissions = await getUserPermissions(user.user_id)

  // 9. Generate JWT token with national_id for family service
  const secret = new TextEncoder().encode(config.jwt.secret)
  const token_jwt = await new SignJWT({
    sub: user.user_id,
    email: user.email,
    roles,
    permissions,
    registry_id: user.registry_id || undefined,
    national_id: nationalId, // Add national_id to JWT for family service /auth/me endpoint
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(config.jwt.issuer)
    .setAudience(config.jwt.audience)
    .setExpirationTime(`${config.jwt.expiresInSeconds}s`)
    .sign(secret)

  // 10. Record login event
  await recordLoginEvent({
    userId: user.user_id,
    ip,
    userAgent,
    outcome: 'success',
  })

  logger.info('OTP login successful', { 
    user_id: user.user_id,
    is_new_user: isNewUser,
  })

  return {
    access_token: token_jwt,
    token_type: 'Bearer',
    expires_in: 86400, // 24 hours
    user_id: user.user_id,
    email: user.email,
    roles,
    permissions,
    registry_id: user.registry_id || null,
    is_new_user: isNewUser,
  }
}
