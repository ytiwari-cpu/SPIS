/**
 * backend/base/middleware/rateLimiter.js
 *
 * Redis-based sliding-window rate limiter.
 *
 * Extracted from iam-service/src/middleware/rateLimiter.ts and generalized:
 * - Redis client is injected per service (no hardcoded import)
 * - Pre-configured factory methods for common patterns
 * - Fail-open: if Redis is unavailable, requests are allowed through
 *
 * Usage:
 *   import { rateLimit, createRateLimiters } from '../../../../base/middleware/rateLimiter.js'
 *
 *   // Generic
 *   app.use('/api/v1/auth', rateLimit({ prefix: 'auth', maxRequests: 10, windowSec: 900, redisClient }))
 *
 *   // Pre-configured
 *   const rateLimiters = createRateLimiters(redisClient)
 *   app.use('/api/v1/auth/login', rateLimiters.loginAttempt)
 */

/**
 * Generic rate limiter middleware factory.
 *
 * @param {{
 *   prefix: string,
 *   maxRequests: number,
 *   windowSec: number,
 *   keyFn?: (req: import('express').Request) => string,
 *   redisClient: import('ioredis').default,
 *   logger?: { warn: Function, error: Function },
 * }} options
 * @returns {import('express').RequestHandler}
 */
export function rateLimit(options) {
  const { prefix, maxRequests, windowSec, keyFn, redisClient, logger } = options

  const log = logger || {
    warn:  (msg, meta) => console.warn(`[WARN] ${msg}`, meta ?? ''),
    error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta ?? ''),
  }

  return async (req, res, next) => {
    if (!redisClient) {
      // No Redis configured → skip rate limiting
      return next()
    }

    const identifier = keyFn ? keyFn(req) : (req.ip || 'unknown')
    const key = `rl:${prefix}:${identifier}`

    try {
      const count = await redisClient.incr(key)

      // Set TTL on first increment
      if (count === 1) {
        await redisClient.expire(key, windowSec)
      }

      // Set informational headers
      res.setHeader('X-RateLimit-Limit', maxRequests)
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - count))

      if (count > maxRequests) {
        const ttl = await redisClient.ttl(key)
        res.setHeader('Retry-After', ttl > 0 ? ttl : windowSec)

        log.warn('Rate limit exceeded', { prefix, key, count, max: maxRequests })

        res.status(429).json({
          success: false,
          error:   {
            code:    'RATE_LIMITED',
            message: `Too many requests. Try again in ${ttl > 0 ? ttl : windowSec} seconds.`,
          },
        })
        return
      }
    } catch (err) {
      // Fail-open: if Redis is down, allow the request through
      log.error('Rate limiter Redis error — allowing request', {
        error: err.message,
        prefix,
      })
    }

    next()
  }
}

/**
 * Create pre-configured rate limiters for common patterns.
 *
 * @param {import('ioredis').default} redisClient
 * @param {{ warn: Function, error: Function }} [logger]
 * @returns {Record<string, import('express').RequestHandler>}
 */
export function createRateLimiters(redisClient, logger) {
  return {
    /** Login: 10 per IP per 15 min */
    loginAttempt:  rateLimit({ prefix: 'login',       maxRequests: 10,  windowSec: 900,  redisClient, logger }),
    /** Password reset: 5 per IP per 15 min */
    passwordReset: rateLimit({ prefix: 'pw-reset',   maxRequests: 5,   windowSec: 900,  redisClient, logger }),
    /** OTP request: 5 per IP per 15 min */
    otpRequest:    rateLimit({ prefix: 'otp-req',       maxRequests: 5,   windowSec: 900,  redisClient, logger }),
    /** General API: 100 per IP per 1 min */
    apiGeneral:    rateLimit({ prefix: 'api-gen',       maxRequests: 100, windowSec: 60,   redisClient, logger }),
    /** Heavy API: 20 per IP per 1 min */
    apiHeavy:      rateLimit({ prefix: 'api-heavy',       maxRequests: 20,  windowSec: 60,   redisClient, logger }),
    /** Bulk import: 5 per IP per 10 min */
    bulkImport:    rateLimit({ prefix: 'bulk-import',   maxRequests: 5,   windowSec: 600,  redisClient, logger }),
    /** Email send: 50 per IP per 1 min */
    emailSend:     rateLimit({ prefix: 'email-send',     maxRequests: 50,  windowSec: 60,   redisClient, logger }),
    /** File upload: 10 per IP per 1 min */
    fileUpload:    rateLimit({ prefix: 'file-upload',   maxRequests: 10,  windowSec: 60,   redisClient, logger }),
    /** Registration: 30 per IP per 1 min */
    registration:  rateLimit({ prefix: 'registration', maxRequests: 30, windowSec: 60,   redisClient, logger }),
    /** MFA operations: 10 per user per 5 min */
    mfaOperation:  rateLimit({
      prefix:      'mfa-op', maxRequests: 10, windowSec:   300, redisClient, logger,
      keyFn:       (req) => req.user?.sub || req.ip || 'unknown',
    }),
    /** Invite: 20 per IP per 1 hour */
    invite: rateLimit({ prefix: 'invite', maxRequests: 20, windowSec: 3600, redisClient, logger }),
    /** Write operations (POST/PATCH/PUT/DELETE): 60 per IP per 1 min */
    write:  rateLimit({ prefix: 'write', maxRequests: 60, windowSec: 60, redisClient, logger }),
    /** Read operations (GET): 120 per IP per 1 min */
    read:   rateLimit({ prefix: 'read', maxRequests: 120, windowSec: 60, redisClient, logger }),
  }
}
