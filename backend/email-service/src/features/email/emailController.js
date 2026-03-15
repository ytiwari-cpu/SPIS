/**
 * emailController.js — handles /email routes
 *
 * Extracts request data, calls EmailService, returns responses.
 */

import { BaseController } from '../../../../base/baseController.js'
import { ApplicationError } from '../../../../base/applicationError.js'
import { EmailService } from './emailService.js'

export class EmailController extends BaseController {
  /** @param {import('../../../../base/apiContext.js').ApiContext} context */
  constructor(context) {
    super(context)
    this.emailService = new EmailService(context)
  }

  async sendOtp(body) {
    const result = await this.emailService.sendOtp(body)
    if (result.rateLimited) {
      throw ApplicationError.tooManyRequests('OTP rate limit exceeded')
    }
    this.log.info('OTP email queued', { request_id: result.request_id, to_email: body.to_email, purpose: body.purpose })
    return this.context.response.status(202).json({ success: true, request_id: result.request_id, status: 'queued', message: 'OTP email queued for delivery' })
  }

  async sendInvite(body) {
    const result = await this.emailService.sendInvite(body)
    if (result.rateLimited) {
      throw ApplicationError.tooManyRequests('Invite rate limit exceeded')
    }
    this.log.info('Invite email queued', { request_id: result.request_id, to_email: body.to_email })
    return this.context.response.status(202).json({ success: true, request_id: result.request_id, status: 'queued', message: 'Invite email queued for delivery' })
  }

  async sendNotify(body) {
    const result = await this.emailService.sendNotify(body)
    if (result.rateLimited) {
      throw ApplicationError.tooManyRequests('Global rate limit exceeded')
    }
    this.log.info('Notify email queued', { request_id: result.request_id, to_email: body.to_email, template_code: body.template_code })
    return this.context.response.status(202).json({ success: true, request_id: result.request_id, status: 'queued', message: 'Notification email queued for delivery' })
  }
}
