/**
 * IAM — Login Service
 *
 * Business logic for national_id + password authentication.
 * Extracts all logic from the monolithic services/login.ts.
 */

import bcrypt from 'bcrypt'
import { BaseService } from '../../../../base/baseService.js'
import { ApplicationError } from '../../../../base/applicationError.js'
import { signToken } from '../../../../base/auth/signToken.js'
import { config } from '../../config.js'
import { hashNationalId } from '../../lib/crypto.js'
import { LoginRepository } from './loginRepository.js'

export class LoginService extends BaseService {
  /**
   * @param {import('../../../../base/apiContext.js').ApiContext} ctx
   * @param {import('./loginRepository.js').LoginRepository} repo
   * @param {import('ioredis').default} [redisClient]
   */
  constructor(context) {
    super(context)
    this.redis = context.extras?.redisClient || null
    this.loginRepository = new LoginRepository(context)
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

    const user = await this.loginRepository.findByNationalIdHash(nationalIdHash)

    // ── Redis-based per-account lockout check (fail-open if Redis is down) ──
    // Runs AFTER fetching user so we can cross-verify DB locked_until and clear
    // stale Redis keys when the DB lock has already expired.
    if (this.redis) {
      try {
        const isLocked = await this.redis.get(`login:locked:${nationalIdHash}`)
        if (isLocked) {
          // Cross-check: if the DB lock has already expired, clear Redis and proceed
          const dbLockExpired = !user || !user.locked_until || new Date(user.locked_until) <= new Date()
          if (dbLockExpired) {
            await this.redis.del(`login:locked:${nationalIdHash}`)
            await this.redis.del(`login:fail:${nationalIdHash}`)
            if (user) {
              await this.loginRepository.unlock(user.user_id)
            }
          } else {
            // Use DB locked_until for accuracy (Redis TTL is approximate)
            const msLeft = new Date(user.locked_until).getTime() - Date.now()
            const minutesLeft = Math.max(1, Math.ceil(msLeft / 60000))
            throw ApplicationError.create(429, {
              message: `Account temporarily locked — try again in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.`,
              code:    'ACCOUNT_LOCKED',
              details: { locked_until: user.locked_until },
            })
          }
        }
      } catch (err) {
        if (err instanceof ApplicationError) {
          throw err
        }
        this.log.warn('Redis lockout check failed — skipping', { error: err.message })
      }
    }

    // Timing attack prevention: always run bcrypt even when user not found
    const DUMMY_HASH = '$2b$12$invalidhashthatisjustpaddingXXXXXXXXXXXXXXXXXXXXXXXXXX'
    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH)
      throw ApplicationError.unauthorized('Invalid credentials')
    }

    // 2. Check user status
    if (user.status === 'disabled') {
      await this.loginRepository.recordEvent({ userId: user.user_id, ip, userAgent, outcome: 'fail_disabled' })
      throw ApplicationError.forbidden('Account is disabled. Contact support.')
    }

    if (user.status === 'locked') {
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        await this.loginRepository.recordEvent({ userId: user.user_id, ip, userAgent, outcome: 'fail_locked' })
        throw ApplicationError.create(423, {
          message: 'Account is temporarily locked. Try again later.',
          code:    'ACCOUNT_LOCKED',
          details: { locked_until: user.locked_until },
        })
      }
      // Lock expired — reset DB state and Redis counters so threshold starts fresh
      await this.loginRepository.unlock(user.user_id)
      if (this.redis) {
        try {
          await this.redis.del(`login:locked:${nationalIdHash}`)
          await this.redis.del(`login:fail:${nationalIdHash}`)
        } catch (err) {
          this.log.warn('Redis lockout reset (expiry) failed', { error: err.message })
        }
      }
    }

    if (user.status === 'pending') {
      throw ApplicationError.forbidden('Account is not yet activated. Please reset your password first.')
    }

    // 3. Verify password
    if (!user.password_hash) {
      throw ApplicationError.unauthorized('No password set. Please use "Forgot Password" to create one.')
    }

    const passwordValid = await bcrypt.compare(password, user.password_hash)
    if (!passwordValid) {
      const failCount = await this.loginRepository.incrementFailed(user.user_id)
      await this.loginRepository.recordEvent({ userId: user.user_id, ip, userAgent, outcome: 'fail_password' })

      // Redis-based per-account lockout (fail-open on Redis errors)
      if (this.redis) {
        try {
          const fails = await this.redis.incr(`login:fail:${nationalIdHash}`)
          if (fails === 1) {
            await this.redis.expire(`login:fail:${nationalIdHash}`, 900)
          }
          if (fails >= config.lockout.threshold) {
            const lockTtlSeconds = config.lockout.durationMinutes * 60
            await this.redis.setex(`login:locked:${nationalIdHash}`, lockTtlSeconds, '1')
          }
        } catch (err) {
          this.log.warn('Redis lockout increment failed', { error: err.message })
        }
      }

      if (failCount >= config.lockout.threshold) {
        const lockUntil = new Date(Date.now() + config.lockout.durationMinutes * 60 * 1000)
        await this.loginRepository.lock(user.user_id, lockUntil)
        this.log.warn('Account locked due to too many failed attempts', { user_id: user.user_id })
        throw ApplicationError.create(423, {
          message: `Account locked for ${config.lockout.durationMinutes} minutes due to too many failed attempts.`,
          code:    'ACCOUNT_LOCKED',
          details: { locked_until: lockUntil.toISOString() },
        })
      }

      throw ApplicationError.unauthorized('Invalid credentials')
    }

    // 4. Reset failed login counter
    await this.loginRepository.resetFailed(user.user_id)

    // Reset Redis lockout counters on success
    if (this.redis) {
      try {
        await this.redis.del(`login:fail:${nationalIdHash}`)
        await this.redis.del(`login:locked:${nationalIdHash}`)
      } catch (err) {
        this.log.warn('Redis lockout reset failed', { error: err.message })
      }
    }

    // 5. Fetch roles + permissions
    const roleRows   = await this.loginRepository.getRoles(user.user_id)
    const roles      = roleRows.map(r => r.role_name)
    const permissions = await this.loginRepository.getPermissions(user.user_id)

    this.log.info('User authenticated', { user_id: user.user_id, roles })

    // 6. Generate JWT (includes national_id so /auth/me can resolve family)
    const accessToken = await signToken(
      { userId: user.user_id, email: user.email, nationalId, roles, permissions, registryId: user.registry_id || undefined },
      {
        secret: config.jwt.secret, expiresInSeconds: config.jwt.expiresInSeconds,
        issuer: config.jwt.issuer, audience: config.jwt.audience,
      },
    )

    // 7. Record success event
    await this.loginRepository.recordEvent({ userId: user.user_id, ip, userAgent, outcome: 'success' })

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
