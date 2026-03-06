/**
 * emailController.js — handles /email routes
 *
 * Extracts request data, calls EmailService, returns responses.
 */

import { BaseController } from '../../../../../base/baseController.js'
import { ApplicationError } from '../../../../../base/applicationError.js'
import { EmailService } from './emailService.js'
import { EmailRepository } from './emailRepository.js'

export class EmailController extends BaseController {
  /** @param {import('../../../../../base/apiContext.js').ApiContext} ctx */
  constructor(ctx) {
    super(ctx)
    const repo = new EmailRepository()
    this.service = new EmailService(repo)
  }

  async sendOtp() {
    const { to_email, otp_code, expires_at, locale, purpose, request_id } = this.context.req.body
    const result = await this.service.sendOtp({ to_email, otp_code, expires_at, locale, purpose, request_id })
    if (result.rateLimited) throw ApplicationError.tooManyRequests('OTP rate limit exceeded')

    this.log.info('OTP email queued', { request_id: result.request_id, to_email, purpose })
    return this.context.res.status(202).json({ success: true, request_id: result.request_id, status: 'queued', message: 'OTP email queued for delivery' })
  }

  async sendInvite() {
    const { to_email, invite_link, locale, request_id } = this.context.req.body
    const result = await this.service.sendInvite({ to_email, invite_link, locale, request_id })
    if (result.rateLimited) throw ApplicationError.tooManyRequests('Invite rate limit exceeded')

    this.log.info('Invite email queued', { request_id: result.request_id, to_email })
    return this.context.res.status(202).json({ success: true, request_id: result.request_id, status: 'queued', message: 'Invite email queued for delivery' })
  }

  async sendNotify() {
    const { to_email, template_code, variables, locale, request_id } = this.context.req.body
    const result = await this.service.sendNotify({ to_email, template_code, variables, locale, request_id })
    if (result.rateLimited) throw ApplicationError.tooManyRequests('Global rate limit exceeded')

    this.log.info('Notify email queued', { request_id: result.request_id, to_email, template_code })
    return this.context.res.status(202).json({ success: true, request_id: result.request_id, status: 'queued', message: 'Notification email queued for delivery' })
  }
}
