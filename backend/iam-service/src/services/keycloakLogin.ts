/**
 * SPIS IAM Service — Keycloak-Only Login Service
 *
 * Authenticates users via Keycloak using Resource Owner Password Grant,
 * then issues a LOCAL HS256 JWT (same format as OTP login tokens).
 * NO LOCAL FALLBACK - fully dependent on Keycloak availability.
 *
 * Flow:
 *   1. User provides national_id + password
 *   2. Lookup user in local IAM DB (for account status checks)
 *   3. Authenticate via Keycloak password grant (REQUIRED)
 *   4. On success: generate LOCAL HS256 JWT with user info + permissions
 *   5. Return local token to frontend (NOT the Keycloak RS256 token)
 *
 * WHY LOCAL HS256 TOKENS:
 *   - Family-service requireAuth middleware already verifies HS256
 *   - OTP login also issues HS256 tokens — keeps token format consistent
 *   - JWT payload includes national_id, permissions, roles — all needed by /auth/me
 *   - No changes needed in family-service or frontend
 */

import { SignJWT } from 'jose'
import { config } from '../config.js'
import { logger } from '../lib/logger.js'
import { hashNationalId } from '../lib/crypto.js'
import {
  authenticateUser as keycloakAuth,
  verifyKeycloakToken,
} from '../lib/keycloak.js'
import {
  getUserByNationalIdHash,
  getUserRoles,
  getUserPermissions,
  recordLoginEvent,
  incrementFailedLogins,
  resetFailedLogins,
  lockUser,
} from '../db/repository.js'

export interface KeycloakLoginResult {
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
 * Authenticate a user via Keycloak, then issue a LOCAL HS256 JWT.
 *
 * The flow:
 * 1. Hash national_id → find user in local IAM DB (for status checks)
 * 2. Send credentials to Keycloak token endpoint (password validation)
 * 3. Keycloak validates password → returns success
 * 4. Generate LOCAL HS256 JWT with sub, national_id, roles, permissions
 * 5. Return local token (same shape as old /iam/login response)
 */
export async function loginWithKeycloak(params: {
  nationalId: string
  password: string
  ip: string
  userAgent: string
}): Promise<KeycloakLoginResult> {
  const { nationalId, password, ip, userAgent } = params

  // 1. Find user in local DB by national_id hash (for status checks)
  const nationalIdHash = hashNationalId(nationalId)
  const localUser = await getUserByNationalIdHash(nationalIdHash)

  if (!localUser) {
    const err = new Error('Invalid credentials')
    ;(err as Error & { statusCode: number }).statusCode = 401
    throw err
  }

  // 2. Check user status in local DB
  if (localUser.status === 'disabled') {
    await recordLoginEvent({ userId: localUser.user_id, ip, userAgent, outcome: 'fail_disabled' })
    const err = new Error('Account is disabled. Contact support.')
    ;(err as Error & { statusCode: number }).statusCode = 403
    throw err
  }

  if (localUser.status === 'locked') {
    if (localUser.locked_until && new Date(localUser.locked_until) > new Date()) {
      await recordLoginEvent({ userId: localUser.user_id, ip, userAgent, outcome: 'fail_locked' })
      const err = new Error('Account is temporarily locked. Try again later.')
      ;(err as Error & { statusCode: number }).statusCode = 423
      throw err
    }
  }

  if (localUser.status === 'pending') {
    const err = new Error('Account is not yet activated. Please reset your password first.')
    ;(err as Error & { statusCode: number }).statusCode = 403
    throw err
  }

  // 3. Authenticate via Keycloak ONLY - no local fallback
  let keycloakSub = ''

  try {
    const keycloakTokens = await keycloakAuth(nationalId, password)

    // Optional: verify the Keycloak token to extract keycloak_sub for logging
    try {
      const decoded = await verifyKeycloakToken(keycloakTokens.access_token)
      keycloakSub = decoded.sub
    } catch {
      logger.debug('Could not verify Keycloak token (non-critical)', { user_id: localUser.user_id })
    }
  } catch (kcError: unknown) {
    // Keycloak authentication failed - increment failed attempts
    const failCount = await incrementFailedLogins(localUser.user_id)
    await recordLoginEvent({ userId: localUser.user_id, ip, userAgent, outcome: 'fail_password' })

    if (failCount >= config.lockout.threshold) {
      const lockUntil = new Date(Date.now() + config.lockout.durationMinutes * 60 * 1000)
      await lockUser(localUser.user_id, lockUntil)
      logger.warn('Account locked due to too many failed attempts', { user_id: localUser.user_id })
      const err = new Error(`Account locked for ${config.lockout.durationMinutes} minutes due to too many failed attempts`)
      ;(err as Error & { statusCode: number }).statusCode = 423
      throw err
    }

    // Log the specific error for debugging
    logger.warn('Keycloak authentication failed', {
      user_id: localUser.user_id,
      error: kcError instanceof Error ? kcError.message : String(kcError),
    })

    const err = new Error('Invalid credentials')
    ;(err as Error & { statusCode: number }).statusCode = 401
    throw err
  }

  await resetFailedLogins(localUser.user_id)

  // 5. Get roles and permissions from LOCAL DB
  const roleRows = await getUserRoles(localUser.user_id)
  const roles = roleRows.map(r => r.role_name)
  const permissions = await getUserPermissions(localUser.user_id)

  // 6. Generate LOCAL HS256 JWT (same format as OTP login tokens)
  const secret = new TextEncoder().encode(config.jwt.secret)
  const now = Math.floor(Date.now() / 1000)

  const accessToken = await new SignJWT({
    sub: localUser.user_id,
    email: localUser.email,
    national_id: nationalId,
    roles,
    permissions,
    registry_id: localUser.registry_id || undefined,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(now)
    .setExpirationTime(now + config.jwt.expiresInSeconds)
    .setIssuer(config.jwt.issuer)
    .setAudience(config.jwt.audience)
    .sign(secret)

  // 7. Record successful login
  await recordLoginEvent({ userId: localUser.user_id, ip, userAgent, outcome: 'success' })

  logger.info('User logged in via Keycloak (local HS256 token issued)', {
    user_id: localUser.user_id,
    keycloak_sub: keycloakSub,
    roles,
    permissions_count: permissions.length,
  })

  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: config.jwt.expiresInSeconds,
    user_id: localUser.user_id,
    email: localUser.email,
    roles,
    permissions,
    registry_id: localUser.registry_id || null,
  }
}

/**
 * EXPLANATION: Why we use Keycloak for password validation but issue local tokens
 *
 * KEYCLOAK handles:
 * - Primary password storage and validation
 * - User credential management
 *
 * LOCAL IAM DB handles:
 * - Account status (active, locked, disabled)
 * - Failed login tracking & lockout
 * - Fine-grained permissions (authz schema)
 * - National ID → User mapping
 * - Audit logging (login events)
 * - JWT issuance (HS256 — same key shared with family-service)
 *
 * LOCAL HS256 TOKENS (instead of Keycloak RS256) because:
 * - Family-service requireAuth middleware already verifies HS256
 * - OTP login also issues HS256 — consistent token format
 * - JWT payload includes national_id + permissions — needed by /auth/me
 * - No changes needed in family-service or frontend
 */
