/**
 * HealthController — handles /healthz, /readyz, and SendGrid webhook routes
 */

import { HealthService } from './healthService.js'
import { HealthRepository } from './healthRepository.js'
import { logger } from '../../lib/logger.js'

export class HealthController {
  /** @param {import('../../../../base/apiContext.js').ApiContext} ctx */
  constructor(ctx) {
    this.ctx = ctx
    this.req = ctx.req
    this.res = ctx.res
    const repo = new HealthRepository()
    this.service = new HealthService(repo)
  }

  liveness() {
    return this.res.json(this.service.liveness())
  }

  async readiness() {
    const { ready, dbCheck, providerCheck } = await this.service.readiness()
    return this.res.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'not_ready',
      service: 'email-service',
      checks: { database: dbCheck, providers: providerCheck },
      timestamp: new Date().toISOString(),
    })
  }

  async bounce() {
    if (!this.service.verifySendGridSignature(this.req)) {
      logger.warn('Invalid SendGrid webhook signature for bounce')
      return this.res.status(403).json({ success: false, error: 'Invalid signature' })
    }
    await this.service.processBounceEvents(this.req)
    return this.res.status(200).json({ success: true })
  }

  async delivery() {
    if (!this.service.verifySendGridSignature(this.req)) {
      logger.warn('Invalid SendGrid webhook signature for delivery')
      return this.res.status(403).json({ success: false, error: 'Invalid signature' })
    }
    this.service.processDeliveryEvents(this.req)
    return this.res.status(200).json({ success: true })
  }
}

