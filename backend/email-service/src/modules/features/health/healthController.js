/**
 * healthController.js — handles /healthz, /readyz, and SendGrid webhook routes
 *
 * Extracts request data, calls HealthService, returns responses.
 */

import { BaseController } from '../../../../../base/baseController.js'
import { HealthService } from './healthService.js'
import { HealthRepository } from './healthRepository.js'

export class HealthController extends BaseController {
  /** @param {import('../../../../../base/apiContext.js').ApiContext} ctx */
  constructor(ctx) {
    super(ctx)
    const repo = new HealthRepository()
    this.service = new HealthService(repo)
  }

  liveness() {
    return this.respondOk(this.service.liveness())
  }

  async readiness() {
    const { ready, dbCheck, providerCheck } = await this.service.readiness()
    return this.context.res.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'not_ready',
      service: 'email-service',
      checks: { database: dbCheck, providers: providerCheck },
      timestamp: new Date().toISOString(),
    })
  }

  async bounce() {
    if (!this.service.verifySendGridSignature(this.context.req)) {
      this.log.warn('Invalid SendGrid webhook signature for bounce')
      return this.respondForbidden({ success: false, error: 'Invalid signature' })
    }
    await this.service.processBounceEvents(this.context.req)
    return this.respondOk({ success: true })
  }

  async delivery() {
    if (!this.service.verifySendGridSignature(this.context.req)) {
      this.log.warn('Invalid SendGrid webhook signature for delivery')
      return this.respondForbidden({ success: false, error: 'Invalid signature' })
    }
    this.service.processDeliveryEvents(this.context.req)
    return this.respondOk({ success: true })
  }
}
