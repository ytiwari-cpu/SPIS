/**
 * SPIS Email Service — Health & Webhook Routes
 *
 * GET  /healthz                     — Liveness probe
 * GET  /readyz                      — Readiness probe (DB + provider check)
 * POST /events/provider/bounce      — SendGrid bounce webhook
 * POST /events/provider/delivery    — SendGrid delivery webhook
 */

import { Router, type Request, type Response, type NextFunction } from 'express'
import { testDbConnection } from '../db/pool.js'
import { providerHealthCheck } from '../providers/selector.js'
import { recordBounce } from '../db/repository.js'
import { config } from '../config.js'
import { logger } from '../lib/logger.js'
import crypto from 'node:crypto'

export const healthRouter = Router()
export const webhookRouter = Router()

// ═══════════════════════════════════════════════════════════════
// HEALTH
// ═══════════════════════════════════════════════════════════════

/** Liveness — is the process alive? */
healthRouter.get('/healthz', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'email-service',
    timestamp: new Date().toISOString(),
  })
})

/** Readiness — can the service handle requests? */
healthRouter.get('/readyz', async (_req: Request, res: Response) => {
  const dbCheck = await testDbConnection()
  const providerCheck = await providerHealthCheck()

  const anyProviderHealthy = Object.values(providerCheck).some(p => p.healthy)
  const ready = dbCheck.ok && anyProviderHealthy

  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    service: 'email-service',
    checks: {
      database: dbCheck,
      providers: providerCheck,
    },
    timestamp: new Date().toISOString(),
  })
})

// ═══════════════════════════════════════════════════════════════
// WEBHOOKS — SendGrid Event Callbacks
// ═══════════════════════════════════════════════════════════════

/**
 * Verify SendGrid webhook signature.
 * Uses the Event Webhook Verification Key from settings.
 */
function verifySendGridSignature(req: Request): boolean {
  const verificationKey = config.sendgrid.webhookVerificationKey
  if (!verificationKey) {
    logger.warn('SendGrid webhook verification key not configured — skipping verification')
    return true // allow in dev if not configured
  }

  const signature = req.headers['x-twilio-email-event-webhook-signature'] as string
  const timestamp = req.headers['x-twilio-email-event-webhook-timestamp'] as string

  if (!signature || !timestamp) {
    return false
  }

  try {
    const payload = timestamp + JSON.stringify(req.body)
    const decodedKey = Buffer.from(verificationKey, 'base64')

    const expectedSignature = crypto
      .createHmac('sha256', decodedKey)
      .update(payload)
      .digest('base64')

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  } catch {
    return false
  }
}

/** POST /events/provider/bounce — Handle bounce events */
webhookRouter.post('/provider/bounce', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!verifySendGridSignature(req)) {
      logger.warn('Invalid SendGrid webhook signature for bounce')
      return res.status(403).json({ success: false, error: 'Invalid signature' })
    }

    const events = Array.isArray(req.body) ? req.body : [req.body]

    for (const event of events) {
      if (event.event === 'bounce' || event.event === 'dropped') {
        await recordBounce({
          message_id: event.sg_message_id || event['smtp-id'] || 'unknown',
          to_email: event.email || '',
          reason: event.reason || event.response || 'Unknown bounce',
        })

        logger.info('Bounce recorded', {
          to_email: event.email,
          reason: event.reason,
          event: event.event,
        })
      }
    }

    res.status(200).json({ success: true })
  } catch (err) {
    next(err)
  }
})

/** POST /events/provider/delivery — Handle delivery confirmation events */
webhookRouter.post('/provider/delivery', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!verifySendGridSignature(req)) {
      logger.warn('Invalid SendGrid webhook signature for delivery')
      return res.status(403).json({ success: false, error: 'Invalid signature' })
    }

    const events = Array.isArray(req.body) ? req.body : [req.body]

    for (const event of events) {
      logger.info('Delivery event received', {
        to_email: event.email,
        event: event.event,
        sg_message_id: event.sg_message_id,
      })
    }

    res.status(200).json({ success: true })
  } catch (err) {
    next(err)
  }
})
