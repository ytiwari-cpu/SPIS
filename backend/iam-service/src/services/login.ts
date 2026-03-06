// This file has been DEPRECATED and replaced by keycloakLogin.ts
// The old direct bcrypt authentication is no longer used.
// All password authentication now goes through Keycloak.

import { SignJWT } from 'jose'
import { config } from '../config.js'
import { createLogger } from '../../../base/logger.js'
const logger = createLogger('iam-service')
import { hashNationalId } from '../lib/crypto.js'
import {
  getUserByNationalIdHash,
  getUserRoles,
  getUserPermissions,
  recordLoginEvent,
  incrementFailedLogins,
  resetFailedLogins,
  lockUser,
} from '../db/repository.js'

export interface LoginResult {
  access_token: string
  token_type: 'Bearer'
  expires_in: number
  user_id: string
  email: string
  roles: string[]
  permissions: string[]
  registry_id: string | null
}

/**
 * Authenticate a user by national_id + password.
 * Returns a JWT token + user info on success.
 */
export async function loginWithCredentials(params: {
  nationalId: string
  password: string
  ip: string
  userAgent: string
}): Promise<LoginResult> {
  const { nationalId, password, ip, userAgent } = params

  // 1. Find user by national_id hash
  const nationalIdHash = hashNationalId(nationalId)
  const user = await getUserByNationalIdHash(nationalIdHash)

  if (!user) {
    const err = new Error('Invalid credentials')
    ;(err as Error & { statusCode: number }).statusCode = 401
    throw err
  }

  // 2. Check user status
  if (user.status === 'disabled') {
    await recordLoginEvent({ userId: user.user_id, ip, userAgent, outcome: 'fail_disabled' })
    const err = new Error('Account is disabled. Contact support.')
    ;(err as Error & { statusCode: number }).statusCode = 403
    throw err
  }

  if (user.status === 'locked') {
    // Check if lock has expired
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      await recordLoginEvent({ userId: user.user_id, ip, userAgent, outcome: 'fail_locked' })
      const err = new Error('Account is temporarily locked. Try again later.')
      ;(err as Error & { statusCode: number }).statusCode = 423
      throw err
    }
    // Lock expired — allow login attempt
  }

  if (user.status === 'pending') {
    const err = new Error('Account is not yet activated. Please reset your password first.')
    ;(err as Error & { statusCode: number }).statusCode = 403
    throw err
  }

  // 3. Verify password via Keycloak (this deprecated file used to check bcrypt directly)
  // Password verification is now handled by keycloakLogin.ts
  // Keeping this stub so the file still compiles for reference.
  const passwordValid = false // Always fail — use keycloakLogin.ts instead
  if (!passwordValid) {
    // Increment failed login counter
    const failCount = await incrementFailedLogins(user.user_id)
    await recordLoginEvent({ userId: user.user_id, ip, userAgent, outcome: 'fail_password' })

    if (failCount >= config.lockout.threshold) {
      const lockUntil = new Date(Date.now() + config.lockout.durationMinutes * 60 * 1000)
      await lockUser(user.user_id, lockUntil)
      logger.warn('Account locked due to too many failed attempts', { user_id: user.user_id })
      const err = new Error(`Account locked for ${config.lockout.durationMinutes} minutes due to too many failed attempts`)
      ;(err as Error & { statusCode: number }).statusCode = 423
      throw err
    }

    const err = new Error('Invalid credentials')
    ;(err as Error & { statusCode: number }).statusCode = 401
    throw err
  }

  // 4. Reset failed login counter on success
  await resetFailedLogins(user.user_id)

  // 5. Get user roles
  const roleRows = await getUserRoles(user.user_id)
  const roles = roleRows.map((r) => r.role_name)

  logger.info('User roles fetched', {
    user_id: user.user_id,
    email: user.email,
    roleCount: roleRows.length,
    roles,
  })

  // 6. Get user permissions
  const permissions = await getUserPermissions(user.user_id)

  logger.info('User permissions fetched', {
    user_id: user.user_id,
    permissionCount: permissions.length,
    firstFive: permissions.slice(0, 5),
  })

  // 7. Generate JWT with national_id for family service
  const secret = new TextEncoder().encode(config.jwt.secret)
  const now = Math.floor(Date.now() / 1000)

  const accessToken = await new SignJWT({
    sub: user.user_id,
    email: user.email,
    national_id: nationalId, // national_id included for family service /auth/me endpoint
    roles,
    permissions,
    registry_id: user.registry_id || undefined,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(now)
    .setExpirationTime(now + config.jwt.expiresInSeconds)
    .setIssuer(config.jwt.issuer)
    .setAudience(config.jwt.audience)
    .sign(secret)

  // 8. Record successful login event
  await recordLoginEvent({ userId: user.user_id, ip, userAgent, outcome: 'success' })

  logger.info('User logged in successfully', {
    user_id: user.user_id,
    roles,
    permissions: permissions.length,
  })

  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: config.jwt.expiresInSeconds,
    user_id: user.user_id,
    email: user.email,
    roles,
    permissions,
    registry_id: user.registry_id || null,
  }
}
