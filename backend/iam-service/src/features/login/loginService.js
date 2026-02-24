/**
 * IAM — Login Service
 *
 * Business logic for national_id + password authentication.
 * Extracts all logic from the monolithic services/login.ts.
 */

import bcrypt from 'bcrypt'
import { SignJWT } from 'jose'
import { BaseService } from '../../../../base/baseService.js'
import { config } from '../../config.js'
import { logger } from '../../lib/logger.js'
import { hashNationalId } from '../../lib/crypto.js'
import { LoginRepository } from './loginRepository.js'

export class LoginService extends BaseService {
  /** @param {LoginRepository} repo */
  constructor(repo) {
    super(repo.context)
    this.repo = repo
  }

  /**
   * Authenticate a user by national_id + password.
   * Returns a signed JWT + user info on success.
   *
   * @param {{ nationalId: string, password: string, ip: string, userAgent: string }} params
   */
  async loginWithCredentials({ nationalId, password, ip, userAgent }) {
    // 1. Hash national_id → lookup user
    const nationalIdHash = hashNationalId(nationalId)
    const user = await this.repo.findByNationalIdHash(nationalIdHash)

    if (!user) {
      const err = Object.assign(new Error('Invalid credentials'), { statusCode: 401 })
      throw err
    }

    // 2. Check user status
    if (user.status === 'disabled') {
      await this.repo.recordEvent({ userId: user.user_id, ip, userAgent, outcome: 'fail_disabled' })
      throw Object.assign(new Error('Account is disabled. Contact support.'), { statusCode: 403 })
    }

    if (user.status === 'locked') {
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        await this.repo.recordEvent({ userId: user.user_id, ip, userAgent, outcome: 'fail_locked' })
        throw Object.assign(new Error('Account is temporarily locked. Try again later.'), { statusCode: 423 })
      }
      // Lock expired — allow attempt
    }

    if (user.status === 'pending') {
      throw Object.assign(
        new Error('Account is not yet activated. Please reset your password first.'),
        { statusCode: 403 },
      )
    }

    // 3. Verify password
    if (!user.password_hash) {
      throw Object.assign(
        new Error('No password set. Please use "Forgot Password" to create one.'),
        { statusCode: 401 },
      )
    }

    const passwordValid = await bcrypt.compare(password, user.password_hash)
    if (!passwordValid) {
      const failCount = await this.repo.incrementFailed(user.user_id)
      await this.repo.recordEvent({ userId: user.user_id, ip, userAgent, outcome: 'fail_password' })

      if (failCount >= config.lockout.threshold) {
        const lockUntil = new Date(Date.now() + config.lockout.durationMinutes * 60 * 1000)
        await this.repo.lock(user.user_id, lockUntil)
        logger.warn('Account locked due to too many failed attempts', { user_id: user.user_id })
        throw Object.assign(
          new Error(`Account locked for ${config.lockout.durationMinutes} minutes due to too many failed attempts`),
          { statusCode: 423 },
        )
      }

      throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 })
    }

    // 4. Reset failed login counter
    await this.repo.resetFailed(user.user_id)

    // 5. Fetch roles + permissions
    const roleRows   = await this.repo.getRoles(user.user_id)
    const roles      = roleRows.map(r => r.role_name)
    const permissions = await this.repo.getPermissions(user.user_id)

    logger.info('User authenticated', { user_id: user.user_id, roles })

    // 6. Generate JWT
    const secret = new TextEncoder().encode(config.jwt.secret)
    const now    = Math.floor(Date.now() / 1000)

    const accessToken = await new SignJWT({
      sub:         user.user_id,
      email:       user.email,
      national_id: nationalId,
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

    // 7. Record success event
    await this.repo.recordEvent({ userId: user.user_id, ip, userAgent, outcome: 'success' })

    return {
      access_token: accessToken,
      token_type:   'Bearer',
      expires_in:   config.jwt.expiresInSeconds,
      user_id:      user.user_id,
      email:        user.email,
      roles,
      permissions,
      registry_id:  user.registry_id || null,
    }
  }
}
