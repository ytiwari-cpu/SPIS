/**
 * SPIS IAM Service — Keycloak Login Service
 *
 * Authenticates users via Keycloak using Resource Owner Password Grant.
 * 
 * Flow:
 *   1. User provides national_id + password
 *   2. Lookup user in local IAM DB (for account status checks)
 *   3. Authenticate via Keycloak (password grant)
 *   4. Keycloak returns RS256 signed JWT
 *   5. Extract roles from Keycloak token
 *   6. Return token to frontend
 */

import { config } from '../config.js'
import { logger } from '../lib/logger.js'
import { hashNationalId } from '../lib/crypto.js'
import {
  authenticateUser as keycloakAuth,
  verifyKeycloakToken,
} from '../lib/keycloak.js'
import {
  getUserByNationalIdHash,
  getUserPermissions,
  recordLoginEvent,
  incrementFailedLogins,
  resetFailedLogins,
  lockUser,
} from '../db/repository.js'

export interface KeycloakLoginResult {
  access_token: string
  refresh_token?: string
  token_type: 'Bearer'
  expires_in: number
  user_id: string
  email: string
  roles: string[]
  permissions: string[]
  keycloak_sub: string  // Keycloak user ID
  registry_id: string | null
}

/**
 * Authenticate a user via Keycloak.
 * 
 * The flow:
 * 1. Hash national_id → find user in local IAM DB (for status checks)
 * 2. Send credentials to Keycloak token endpoint
 * 3. Keycloak validates password and returns RS256 signed token
 * 4. Token is signed with Keycloak's PRIVATE KEY
 * 5. Backend can verify token using PUBLIC KEY from JWKS endpoint
 * 6. Return Keycloak token + local permissions to frontend
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

  // 3. Authenticate via Keycloak (password grant)
  // Keycloak will:
  //   a. Validate username (national_id) and password
  //   b. Generate JWT payload with user info + roles
  //   c. Sign JWT with PRIVATE KEY (RS256)
  //   d. Return access_token + refresh_token
  try {
    const keycloakTokens = await keycloakAuth(nationalId, password)

    // 4. Verify the token (optional - validates signature with PUBLIC KEY)
    // This proves the token came from Keycloak and wasn't tampered with
    const decodedToken = await verifyKeycloakToken(keycloakTokens.access_token)

    // 5. Reset failed login counter on success
    await resetFailedLogins(localUser.user_id)

    // 6. Get roles from Keycloak token
    const keycloakRoles = decodedToken.realm_access?.roles || []
    
    // 7. Also get local permissions from our DB
    // (Keycloak manages roles, we manage fine-grained permissions)
    const localPermissions = await getUserPermissions(localUser.user_id)

    // 8. Record successful login
    await recordLoginEvent({ userId: localUser.user_id, ip, userAgent, outcome: 'success' })

    logger.info('User logged in via Keycloak', {
      user_id: localUser.user_id,
      keycloak_sub: decodedToken.sub,
      roles: keycloakRoles,
      permissions_count: localPermissions.length,
    })

    return {
      access_token: keycloakTokens.access_token,
      refresh_token: keycloakTokens.refresh_token,
      token_type: 'Bearer',
      expires_in: keycloakTokens.expires_in,
      user_id: localUser.user_id,
      email: localUser.email,
      roles: keycloakRoles,
      permissions: localPermissions,
      keycloak_sub: decodedToken.sub,
      registry_id: localUser.registry_id || null,
    }
  } catch (error) {
    // Keycloak authentication failed
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

    const err = new Error('Invalid credentials')
    ;(err as Error & { statusCode: number }).statusCode = 401
    throw err
  }
}

/**
 * EXPLANATION: Why we use both Keycloak AND local DB
 * 
 * KEYCLOAK handles:
 * - User credentials (password hashing with bcrypt/argon2)
 * - Token issuance (RS256 signed JWTs)
 * - Role management (realm roles)
 * - Token refresh
 * - Session management
 * 
 * LOCAL IAM DB handles:
 * - Account status (active, locked, disabled)
 * - Failed login tracking & lockout
 * - Fine-grained permissions
 * - National ID → User mapping
 * - Audit logging (login events)
 * - Business-specific user attributes
 * 
 * This hybrid approach gives us:
 * - Security of Keycloak's battle-tested auth
 * - Flexibility of custom business logic
 * - RS256 tokens that any service can verify
 */
