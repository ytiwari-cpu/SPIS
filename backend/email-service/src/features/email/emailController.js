/**
 * EmailController — handles /email routes
 */

import { EmailService } from './emailService.js'
import { EmailRepository } from './emailRepository.js'
import { logger } from '../../lib/logger.js'
import { TooManyRequestsError } from '../../middleware/errorHandler.js'

export class EmailController {
  /** @param {import('../../../../base/apiContext.js').ApiContext} ctx */
  constructor(ctx) {
    this.ctx = ctx
    this.req = ctx.req
    this.res = ctx.res
    const repo = new EmailRepository()
    this.service = new EmailService(repo)
  }

  async sendOtp() {
    const { to_email, otp_code, expires_at, locale, purpose, request_id } = this.req.body
    const result = await this.service.sendOtp({ to_email, otp_code, expires_at, locale, purpose, request_id })
    if (result.rateLimited) throw new TooManyRequestsError('OTP rate limit exceeded', { limit: result.limit, resetAt: result.resetAt })

    logger.info('OTP email queued', { request_id: result.request_id, to_email, purpose })
    return this.res.status(202).json({ success: true, request_id: result.request_id, status: 'queued', message: 'OTP email queued for delivery' })
  }

  async sendInvite() {
    const { to_email, invite_link, locale, request_id } = this.req.body
    const result = await this.service.sendInvite({ to_email, invite_link, locale, request_id })
    if (result.rateLimited) throw new TooManyRequestsError('Invite rate limit exceeded', { limit: result.limit, resetAt: result.resetAt })

    logger.info('Invite email queued', { request_id: result.request_id, to_email })
    return this.res.status(202).json({ success: true, request_id: result.request_id, status: 'queued', message: 'Invite email queued for delivery' })
  }

  async sendNotify() {
    const { to_email, template_code, variables, locale, request_id } = this.req.body
    const result = await this.service.sendNotify({ to_email, template_code, variables, locale, request_id })
    if (result.rateLimited) throw new TooManyRequestsError('Global rate limit exceeded', { limit: result.limit, resetAt: result.resetAt })

    logger.info('Notify email queued', { request_id: result.request_id, to_email, template_code })
    return this.res.status(202).json({ success: true, request_id: result.request_id, status: 'queued', message: 'Notification email queued for delivery' })
  }
}

