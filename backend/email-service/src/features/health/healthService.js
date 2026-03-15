/**
 * healthService.js — business logic for health checks and webhook verification
 */

import crypto from 'node:crypto'
import { providerHealthCheck } from '../../providers/selector.js'
import { config } from '../../config.js'
import { createLogger } from '../../../../base/logger.js'
import { HealthRepository } from './healthRepository.js'
import { BaseService } from '../../../../base/baseService.js'

const logger = createLogger('email-service')

export class HealthService extends BaseService {
  constructor(context) {
    super(context)
    this.healthRepository = new HealthRepository(context)
  }

  liveness() {
    return { status: 'ok', service: 'email-service', timestamp: new Date().toISOString() }
  }

  async readiness() {
    const dbCheck       = await this.healthRepository.testDb()
    const providerCheck = await providerHealthCheck()
    const anyProviderHealthy = Object.values(providerCheck).some(p => p.healthy)
    const ready = dbCheck.ok && anyProviderHealthy
    return { ready, dbCheck, providerCheck }
  }

  verifySendGridSignature(req) {
    const verificationKey = config.sendgrid?.webhookVerificationKey
    if (!verificationKey) {
      logger.warn('SendGrid webhook verification key not configured — skipping verification')
      return true
    }

    const signature = req.headers['x-twilio-email-event-webhook-signature']
    const timestamp = req.headers['x-twilio-email-event-webhook-timestamp']
    if (!signature || !timestamp) {
      return false
    }

    try {
      const payload = timestamp + JSON.stringify(req.body)
      const decodedKey = Buffer.from(verificationKey, 'base64')
      const expectedSignature = crypto.createHmac('sha256', decodedKey).update(payload).digest('base64')
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
    } catch {
      return false
    }
  }

  async processBounceEvents(req) {
    const events = Array.isArray(req.body) ? req.body : [req.body]
    for (const event of events) {
      if (event.event === 'bounce' || event.event === 'dropped') {
        await this.healthRepository.recordBounce({
          message_id: event.sg_message_id || event['smtp-id'] || 'unknown',
          to_email:   event.email         || '',
          reason:     event.reason        || event.response || 'Unknown bounce',
        })
        logger.info('Bounce recorded', { to_email: event.email, reason: event.reason, event: event.event })
      }
    }
  }

  processDeliveryEvents(req) {
    const events = Array.isArray(req.body) ? req.body : [req.body]
    for (const event of events) {
      logger.info('Delivery event received', { to_email: event.email, event: event.event, sg_message_id: event.sg_message_id })
    }
  }
}
