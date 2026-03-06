/**
 * SPIS Email Service — Rate Limiter
 *
 * Enforces per-email/purpose rate limits:
 *   - OTP: 5 per email per hour
 *   - Invite: 3 per email per day
 *   - Global: 100 per day (free tier guard)
 *
 * Returns 429 metadata when breached.
 */

import { config } from '../config.js'
import { checkRateLimit } from '../db/repository.js'
import { createLogger } from '../../../base/logger.js'
const logger = createLogger('email-service')

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: string
  limitName: string
}

/**
 * Check all applicable rate limits for an email send.
 * Returns the FIRST limit that is breached, or { allowed: true } if all pass.
 */
export async function enforceRateLimits(params: {
  to_email: string
  purpose: 'otp' | 'invite' | 'notify'
}): Promise<RateLimitResult> {
  const { to_email, purpose } = params

  // 1. Global daily limit (free-tier guard)
  const globalKey = 'global:daily'
  const globalResult = await checkRateLimit(globalKey, 86400, config.rateLimits.globalPerDay)
  if (!globalResult.allowed) {
    logger.warn('Global daily rate limit exceeded', { key: globalKey })
    return { allowed: false, remaining: 0, resetAt: globalResult.resetAt, limitName: 'global_daily' }
  }

  // 2. Purpose-specific limits
  if (purpose === 'otp') {
    const key = `otp:${to_email}`
    const result = await checkRateLimit(key, 3600, config.rateLimits.otpPerEmailPerHour)
    if (!result.allowed) {
      logger.warn('OTP rate limit exceeded', { to_email, key })
      return { allowed: false, remaining: 0, resetAt: result.resetAt, limitName: 'otp_per_email_per_hour' }
    }
    return { allowed: true, remaining: result.remaining, resetAt: result.resetAt, limitName: 'otp' }
  }

  if (purpose === 'invite') {
    const key = `invite:${to_email}`
    const result = await checkRateLimit(key, 86400, config.rateLimits.invitePerEmailPerDay)
    if (!result.allowed) {
      logger.warn('Invite rate limit exceeded', { to_email, key })
      return { allowed: false, remaining: 0, resetAt: result.resetAt, limitName: 'invite_per_email_per_day' }
    }
    return { allowed: true, remaining: result.remaining, resetAt: result.resetAt, limitName: 'invite' }
  }

  // For 'notify' — only global limit applies (already checked above)
  return { allowed: true, remaining: globalResult.remaining, resetAt: globalResult.resetAt, limitName: 'global' }
}
