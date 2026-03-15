/**
 * emailService.js — business logic for the email feature
 *
 * Handles OTP, invite, and notification email sending.
 * Application-level rate limiting (per-email/purpose DB-backed quotas)
 * is checked before queueing via EmailRepository.
 */

import { publishEmailSend } from '../../bus/rabbitmq.js'
import { EmailRepository }  from './emailRepository.js'
import { BaseService }      from '../../../../base/baseService.js'
import { config }           from '../../config.js'
import { createLogger }     from '../../../../base/logger.js'

const logger = createLogger('email-rate-limit')

export class EmailService extends BaseService {
  constructor(context) {
    super(context)
    this.emailRepository = new EmailRepository(context)
  }

  /**
   * Check + record a single rate-limit key.
   * Orchestrates repo calls: count usage → check limit → insert or increment entry.
   */
  async #checkRateLimit(key, windowSeconds, maxCount) {
    const now = new Date()
    const windowStart = new Date(now.getTime() - windowSeconds * 1000).toISOString()

    const currentCount = await this.emailRepository.getRateLimitUsage(key, windowStart)
    if (currentCount >= maxCount) {
      const resetAt = new Date(now.getTime() + windowSeconds * 1000).toISOString()
      return { allowed: false, remaining: 0, resetAt }
    }

    const expiresAt = new Date(now.getTime() + windowSeconds * 1000).toISOString()
    const windowNow = now.toISOString()

    const isEntryExists = await this.emailRepository.isRateLimitEntryExists(key, windowNow)
    if (isEntryExists) {
      const entry    = await this.emailRepository.getRateLimitEntry(key, windowNow)
      const newCount = (entry?.count ?? 0) + 1
      await this.emailRepository.updateRateLimitCount(key, windowNow, newCount)
    } else {
      await this.emailRepository.insertRateLimitEntry({ key, window_start: windowNow, count: 1, expires_at: expiresAt })
    }

    return { allowed: true, remaining: maxCount - currentCount - 1, resetAt: expiresAt }
  }

  async #enforceRateLimits({ to_email, purpose }) {
    // Clean up expired entries first
    await this.emailRepository.deleteExpiredRateLimits()

    const globalResult = await this.#checkRateLimit('global:daily', 86400, config.rateLimits.globalPerDay)
    if (!globalResult.allowed) {
      logger.warn('Global daily rate limit exceeded', { key: 'global:daily' })
      return { allowed: false, remaining: 0, resetAt: globalResult.resetAt, limitName: 'global_daily' }
    }

    if (purpose === 'otp') {
      const key = `otp:${to_email}`
      const result = await this.#checkRateLimit(key, 3600, config.rateLimits.otpPerEmailPerHour)
      if (!result.allowed) {
        logger.warn('OTP rate limit exceeded', { to_email, key })
        return { allowed: false, remaining: 0, resetAt: result.resetAt, limitName: 'otp_per_email_per_hour' }
      }
      return { allowed: true, remaining: result.remaining, resetAt: result.resetAt, limitName: 'otp' }
    }

    if (purpose === 'invite') {
      const key = `invite:${to_email}`
      const result = await this.#checkRateLimit(key, 86400, config.rateLimits.invitePerEmailPerDay)
      if (!result.allowed) {
        logger.warn('Invite rate limit exceeded', { to_email, key })
        return { allowed: false, remaining: 0, resetAt: result.resetAt, limitName: 'invite_per_email_per_day' }
      }
      return { allowed: true, remaining: result.remaining, resetAt: result.resetAt, limitName: 'invite' }
    }

    return { allowed: true, remaining: globalResult.remaining, resetAt: globalResult.resetAt, limitName: 'global' }
  }

  async sendOtp({ to_email, otp_code, expires_at, locale, purpose, request_id }) {
    const rl = await this.#enforceRateLimits({ to_email, purpose: 'otp' })
    if (!rl.allowed) {
      return { rateLimited: true, limit: rl.limitName, resetAt: rl.resetAt }
    }

    const reqId        = request_id || EmailService.generateUUID()
    const templateCode = purpose === 'password_reset' ? 'password_reset' : 'iam_otp'

    // Idempotent insert: check if request_id already exists
    if (request_id) {
      const existing = await this.emailRepository.findByRequestId(request_id)
      if (existing) {
        return { request_id: existing.request_id }
      }
    }

    await this.emailRepository.createRequest({
      request_id:    reqId,
      to_email,
      template_code: templateCode,
      payload_json:  JSON.stringify({ otp_code, expires_at, locale, purpose }),
    })

    publishEmailSend({
      request_id:    reqId,
      to_email,
      template_code: templateCode,
      variables:     { otp_code, expires_at, purpose },
      locale:        locale || 'en',
      attempt:       1,
    })

    return { request_id: reqId }
  }

  async sendInvite({ to_email, invite_link, locale, request_id }) {
    const rl = await this.#enforceRateLimits({ to_email, purpose: 'invite' })
    if (!rl.allowed) {
      return { rateLimited: true, limit: rl.limitName, resetAt: rl.resetAt }
    }

    const reqId = request_id || EmailService.generateUUID()

    if (request_id) {
      const existing = await this.emailRepository.findByRequestId(request_id)
      if (existing) {
        return { request_id: existing.request_id }
      }
    }

    await this.emailRepository.createRequest({
      request_id:    reqId,
      to_email,
      template_code: 'invite',
      payload_json:  JSON.stringify({ invite_link, locale }),
    })

    publishEmailSend({
      request_id:    reqId,
      to_email,
      template_code: 'invite',
      variables:     { invite_link },
      locale:        locale || 'en',
      attempt:       1,
    })

    return { request_id: reqId }
  }

  async sendNotify({ to_email, template_code, variables, locale, request_id }) {
    const rl = await this.#enforceRateLimits({ to_email, purpose: 'notify' })
    if (!rl.allowed) {
      return { rateLimited: true, limit: rl.limitName, resetAt: rl.resetAt }
    }

    const reqId = request_id || EmailService.generateUUID()

    if (request_id) {
      const existing = await this.emailRepository.findByRequestId(request_id)
      if (existing) {
        return { request_id: existing.request_id }
      }
    }

    await this.emailRepository.createRequest({
      request_id:   reqId,
      to_email,
      template_code,
      payload_json: JSON.stringify({ ...variables, locale }),
    })

    publishEmailSend({
      request_id: reqId,
      to_email,
      template_code,
      variables,
      locale:     locale || 'en',
      attempt:    1,
    })

    return { request_id: reqId }
  }
}
