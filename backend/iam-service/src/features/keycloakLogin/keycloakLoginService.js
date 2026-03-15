/**
 * IAM — Keycloak Login Service
 *
 * Authenticates users via Keycloak using Resource Owner Password Grant,
 * then issues a LOCAL HS256 JWT (same format as OTP login tokens).
 * NO LOCAL FALLBACK — fully dependent on Keycloak availability.
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
 *
 * KEYCLOAK handles: primary password storage and validation, credential management.
 * LOCAL IAM DB handles: account status, failed login tracking & lockout, fine-grained
 *   permissions, national_id → user mapping, audit logging, HS256 JWT issuance.
 */

import { BaseService }          from '../../../../base/baseService.js'
import { ApplicationError }    from '../../../../base/applicationError.js'
import { signToken }           from '../../../../base/auth/signToken.js'
import { config }               from '../../config.js'
import { hashNationalId }       from '../../lib/crypto.js'
import {
  authenticateUser as keycloakAuth,
  verifyKeycloakToken,
} from '../../lib/keycloak.js'
import bcrypt from 'bcrypt'
import { KeycloakLoginRepository } from './keycloakLoginRepository.js'

export class KeycloakLoginService extends BaseService {
  /**
   * @param {import('../../../../base/apiContext.js').ApiContext} context
   */
  constructor(context) {
    super(context)
    this.keycloakLoginRepository = new KeycloakLoginRepository(context)
  }

  /**
   * Authenticate a user via Keycloak, then issue a LOCAL HS256 JWT.
   *
   * @param {{ nationalId: string, password: string, ip: string, userAgent: string }} params
   * @returns {Promise<KeycloakLoginResult>}
   */
  async loginWithKeycloak({ nationalId, password, ip, userAgent }) {
    // 1. Find user in local DB by national_id hash (for status checks)
    const nationalIdHash = hashNationalId(nationalId)
    const localUser = await this.keycloakLoginRepository.findByNationalIdHash(nationalIdHash)

    if (!localUser) {
      // Timing attack prevention: simulate bcrypt work even when user not found
      const DUMMY_HASH = '$2b$12$invalidhashthatisjustpaddingXXXXXXXXXXXXXXXXXXXXXXXXXX'
      await bcrypt.compare(password, DUMMY_HASH)
      throw ApplicationError.unauthorized('Invalid credentials')
    }

    // 2. Check user status in local DB
    if (localUser.status === 'disabled') {
      await this.keycloakLoginRepository.recordEvent({ userId: localUser.user_id, ip, userAgent, outcome: 'fail_disabled' })
      throw ApplicationError.forbidden('Account is disabled. Contact support.')
    }

    if (localUser.status === 'locked') {
      if (localUser.locked_until && new Date(localUser.locked_until) > new Date()) {
        await this.keycloakLoginRepository.recordEvent({ userId: localUser.user_id, ip, userAgent, outcome: 'fail_locked' })
        throw ApplicationError.create(423, { message: 'Account is temporarily locked. Try again later.' })
      }
    }

    if (localUser.status === 'pending') {
      throw ApplicationError.forbidden('Account is not yet activated. Please reset your password first.')
    }

    // 3. Authenticate via Keycloak ONLY — no local fallback
    let keycloakSub = ''

    try {
      const keycloakTokens = await keycloakAuth(nationalId, password)

      // Optional: verify the Keycloak token to extract keycloak_sub for logging
      try {
        const decoded = await verifyKeycloakToken(keycloakTokens.access_token)
        keycloakSub = decoded.sub
      } catch {
        this.log.debug('Could not verify Keycloak token (non-critical)', { user_id: localUser.user_id })
      }
    } catch (kcError) {
      // Keycloak authentication failed — increment failed attempts
      const failCount = await this.keycloakLoginRepository.incrementFailed(localUser.user_id)
      await this.keycloakLoginRepository.recordEvent({ userId: localUser.user_id, ip, userAgent, outcome: 'fail_password' })

      if (failCount >= config.lockout.threshold) {
        const lockUntil = new Date(Date.now() + config.lockout.durationMinutes * 60 * 1000)
        await this.keycloakLoginRepository.lock(localUser.user_id, lockUntil)
        this.log.warn('Account locked due to too many failed attempts', { user_id: localUser.user_id })
        throw ApplicationError.create(423, { message: `Account locked for ${config.lockout.durationMinutes} minutes due to too many failed attempts` })
      }

      const kcErrMessage = kcError instanceof Error ? kcError.message : String(kcError)
      const kcErrDetail  = kcError?.response?.data ?? kcError?.cause ?? null
      this.log.error('Keycloak authentication failed — check Keycloak connectivity and realm config', {
        user_id:      localUser.user_id,
        keycloak_url: `${config.keycloak.baseUrl}/realms/${config.keycloak.realm}`,
        error:        kcErrMessage,
        detail:       kcErrDetail,
      })

      throw ApplicationError.unauthorized('Invalid credentials')
    }

    await this.keycloakLoginRepository.resetFailed(localUser.user_id)

    // 4. Get roles and permissions from LOCAL DB
    const roleRows    = await this.keycloakLoginRepository.getRoles(localUser.user_id)
    const roles       = roleRows.map(r => r.role_name)
    const permissions = await this.keycloakLoginRepository.getPermissions(localUser.user_id)

    // 5. Generate LOCAL HS256 JWT (national_id intentionally omitted — PII, never in JWT)
    const accessToken = await signToken(
      {
        userId: localUser.user_id, email: localUser.email,
        roles, permissions, registryId: localUser.registry_id || undefined,
      },
      {
        secret: config.jwt.secret, expiresInSeconds: config.jwt.expiresInSeconds,
        issuer: config.jwt.issuer, audience: config.jwt.audience,
      },
    )

    // 6. Record successful login
    await this.keycloakLoginRepository.recordEvent({ userId: localUser.user_id, ip, userAgent, outcome: 'success' })

    this.log.info('User logged in via Keycloak (local HS256 token issued)', {
      user_id:           localUser.user_id,
      keycloak_sub:      keycloakSub,
      roles,
      permissions_count: permissions.length,
    })

    return {
      access_token: accessToken,
      token_type:   'Bearer',
      expires_in:   config.jwt.expiresInSeconds,
      user_id:      localUser.user_id,
      email:        localUser.email,
      roles,
      permissions,
      registry_id:  localUser.registry_id || null,
    }
  }
}
