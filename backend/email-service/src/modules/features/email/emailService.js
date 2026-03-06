/**
 * emailService.js - business logic for the email feature
 *
 * Handles OTP, invite, and notification email sending.
 * Rate limiting is checked before queueing.
 */

import { v4 as uuidv4 } from 'uuid'
import { enforceRateLimits } from '../../../services/rateLimiter.js'
import { publishEmailSend } from '../../../bus/rabbitmq.js'

export class EmailService {
  constructor(repo) {
    this.repo = repo
  }

  async sendOtp({ to_email, otp_code, expires_at, locale, purpose, request_id }) {
    const rl = await enforceRateLimits({ to_email, purpose: 'otp' })
    if (!rl.allowed) return { rateLimited: true, limit: rl.limitName, resetAt: rl.resetAt }

    const emailReq = await this.repo.createRequest({
      request_id:    request_id || uuidv4(),
      to_email,
      template_code: purpose === 'password_reset' ? 'password_reset' : 'iam_otp',
      payload_json:  { otp_code, expires_at, locale, purpose },
    })

    publishEmailSend({
      request_id:    emailReq.request_id,
      to_email,
      template_code: emailReq.template_code,
      variables:     { otp_code, expires_at, purpose },
      locale:        locale || 'en',
      attempt:       1,
    })

    return { request_id: emailReq.request_id }
  }

  async sendInvite({ to_email, invite_link, locale, request_id }) {
    const rl = await enforceRateLimits({ to_email, purpose: 'invite' })
    if (!rl.allowed) return { rateLimited: true, limit: rl.limitName, resetAt: rl.resetAt }

    const emailReq = await this.repo.createRequest({
      request_id:    request_id || uuidv4(),
      to_email,
      template_code: 'invite',
      payload_json:  { invite_link, locale },
    })

    publishEmailSend({
      request_id:    emailReq.request_id,
      to_email,
      template_code: 'invite',
      variables:     { invite_link },
      locale:        locale || 'en',
      attempt:       1,
    })

    return { request_id: emailReq.request_id }
  }

  async sendNotify({ to_email, template_code, variables, locale, request_id }) {
    const rl = await enforceRateLimits({ to_email, purpose: 'notify' })
    if (!rl.allowed) return { rateLimited: true, limit: rl.limitName, resetAt: rl.resetAt }

    const emailReq = await this.repo.createRequest({
      request_id:    request_id || uuidv4(),
      to_email,
      template_code,
      payload_json:  { ...variables, locale },
    })

    publishEmailSend({
      request_id:    emailReq.request_id,
      to_email,
      template_code,
      variables,
      locale:        locale || 'en',
      attempt:       1,
    })

    return { request_id: emailReq.request_id }
  }
}
