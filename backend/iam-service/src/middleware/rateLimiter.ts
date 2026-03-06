/**
 * SPIS IAM Service — Rate Limiter Middleware
 *
 * Uses Redis INCR + EXPIRE for sliding-window rate limiting.
 * Account lockout: 5 failed login attempts → 15m lock.
 */

import type { Request, Response, NextFunction } from 'express'
import { incrementRateCounter, getRateCounter } from '../lib/redis.js'
import { createLogger } from '../../../base/logger.js'
const logger = createLogger('iam-service')

interface RateLimitOptions {
  /** Unique key prefix (e.g. 'login', 'otp-request') */
  prefix: string
  /** Max requests per window */
  maxRequests: number
  /** Window in seconds */
  windowSec: number
  /** Key extractor — defaults to req.ip */
  keyFn?: (req: Request) => string
}

/**
 * Generic rate limiter middleware.
 */
export function rateLimit(options: RateLimitOptions) {
  const { prefix, maxRequests, windowSec, keyFn } = options

  return async (req: Request, res: Response, next: NextFunction) => {
    const key = `${prefix}:${keyFn ? keyFn(req) : req.ip}`

    try {
      const count = await incrementRateCounter(key, windowSec)

      // Set rate-limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests)
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - count))

      if (count > maxRequests) {
        logger.warn('Rate limit exceeded', { prefix, key, count, max: maxRequests })
        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: `Too many requests. Try again in ${windowSec} seconds.`,
          },
        })
        return
      }
    } catch (err) {
      // If Redis is down, allow the request through (fail-open for rate limiting)
      logger.error('Rate limiter Redis error — allowing request', {
        error: (err as Error).message,
      })
    }

    next()
  }
}

/**
 * Pre-configured rate limiters for common endpoints.
 */
export const rateLimiters = {
  /** Password reset request: 5 per IP per 15 minutes */
  passwordResetRequest: rateLimit({
    prefix: 'pw-reset-req',
    maxRequests: 5,
    windowSec: 900,
  }),

  /** Password reset confirm: 10 per IP per 15 minutes */
  passwordResetConfirm: rateLimit({
    prefix: 'pw-reset-cfm',
    maxRequests: 10,
    windowSec: 900,
  }),

  /** MFA operations: 10 per user per 5 minutes */
  mfaOperation: rateLimit({
    prefix: 'mfa-op',
    maxRequests: 10,
    windowSec: 300,
    keyFn: (req) => req.user?.sub || req.ip || 'unknown',
  }),

  /** Invite endpoint: 20 per IP per hour */
  invite: rateLimit({
    prefix: 'invite',
    maxRequests: 20,
    windowSec: 3600,
  }),
}
