/**
 * SPIS Email Service — Queue Worker
 *
 * Consumes messages from email.send queue.
 * For each message:
 *   1. Marks email_requests row as 'processing'
 *   2. Renders the template (Handlebars + DB template)
 *   3. Selects provider (SendGrid primary, SMTP fallback) via circuit breaker
 *   4. Sends the email
 *   5. On success: publishes email.sent, updates row to 'sent'
 *   6. On failure: retries with exponential backoff, publishes email.failed after max attempts
 */

import 'dotenv/config'
import { config } from '../config.js'
import { createLogger } from '../../../base/logger.js'
const logger = createLogger('email-service')
import { connectBus, consume, publishEmailSend, publishEmailSent, publishEmailFailed, closeBus, QUEUES } from '../bus/rabbitmq.js'
import { updateEmailStatus, getEmailRequest } from '../db/repository.js'
import { renderEmail } from '../services/templateRenderer.js'
import { sendWithFallback } from '../providers/selector.js'
import { pool } from '../db/pool.js'
import type { EmailSendMessage } from '../types.js'

async function processMessage(payload: Record<string, unknown>): Promise<void> {
  const msg = payload as unknown as EmailSendMessage
  const { request_id, to_email, template_code, variables, locale, attempt } = msg

  logger.info('Processing email.send', { request_id, to_email, template_code, attempt })

  try {
    // 1. Mark as processing
    await updateEmailStatus(request_id, 'processing')

    // 2. Render template
    const rendered = await renderEmail({
      to_email,
      template_code,
      variables: variables || {},
      locale: locale || 'en',
    })

    // 3. Send via provider selector (with fallback + circuit breaker)
    const result = await sendWithFallback(rendered)

    if (result.success) {
      // 4a. Success — update DB, publish email.sent
      const sentAt = new Date().toISOString()
      await updateEmailStatus(request_id, 'sent', {
        provider_used: result.provider,
        sent_at: sentAt,
      })

      publishEmailSent({
        request_id,
        to_email,
        template_code,
        provider: result.provider,
        sent_at: sentAt,
      })

      logger.info('Email sent successfully', {
        request_id,
        to_email,
        provider: result.provider,
        messageId: result.messageId,
      })
    } else {
      // 4b. Failure — check if retry is possible
      await handleFailure(msg, result.error || 'Unknown send error')
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error'
    logger.error('Worker processing error', { request_id, error: errMsg })
    await handleFailure(msg, errMsg)
  }
}

async function handleFailure(msg: EmailSendMessage, error: string): Promise<void> {
  const { request_id, to_email, template_code, attempt } = msg
  const maxAttempts = config.maxSendAttempts
  const isFinal = attempt >= maxAttempts

  if (isFinal) {
    // Max attempts reached — mark as permanently failed
    await updateEmailStatus(request_id, 'failed', {
      last_error: error,
    })

    publishEmailFailed({
      request_id,
      to_email,
      template_code,
      error,
      attempts: attempt,
      final: true,
    })

    logger.error('Email permanently failed', { request_id, to_email, attempts: attempt, error })
  } else {
    // Durable retry: mark as failed with retry info in last_error
    // The sweep will pick it up based on attempts < max and time elapsed
    const delayMs = config.retryBaseDelayMs * Math.pow(2, attempt - 1)
    const retryAfter = new Date(Date.now() + delayMs).toISOString()

    await updateEmailStatus(request_id, 'failed', {
      last_error: `RETRY_AFTER:${retryAfter}|${error}`,
    })

    logger.warn('Email send failed, scheduled durable retry', {
      request_id,
      attempt,
      nextAttempt: attempt + 1,
      retryAfter,
    })
  }
}

// ═══════════════════════════════════════════════════════════════
// RETRY SWEEP — polls DB every 30s for retry_pending rows
// ═══════════════════════════════════════════════════════════════

const SWEEP_INTERVAL_MS = 30_000

async function sweepRetryPending(): Promise<void> {
  try {
    const maxAttempts = config.maxSendAttempts
    const result = await pool.query(
      `SELECT request_id, to_email, template_code, payload_json, attempts, last_error
       FROM email_requests
       WHERE status = 'failed'
         AND attempts < $1
         AND last_error LIKE 'RETRY_AFTER:%'
       ORDER BY created_at ASC
       LIMIT 50`,
      [maxAttempts]
    )
    const rows = result.rows as Array<{
      request_id: string
      to_email: string
      template_code: string
      payload_json: Record<string, unknown>
      attempts: number
      last_error: string | null
    }>

    if (rows.length === 0) return

    // Filter by retry time (encoded in last_error as RETRY_AFTER:<iso>|<msg>)
    const now = Date.now()
    const ready = rows.filter(row => {
      const match = row.last_error?.match(/^RETRY_AFTER:([^|]+)/)
      if (!match) return false
      const retryAt = new Date(match[1]).getTime()
      return now >= retryAt
    })

    if (ready.length === 0) return

    logger.info('Retry sweep found pending emails', { count: ready.length })

    for (const row of ready) {
      // Mark as queued to prevent re-pickup
      await updateEmailStatus(row.request_id, 'queued')

      // Re-publish to the queue with incremented attempt
      publishEmailSend({
        request_id:    row.request_id,
        to_email:      row.to_email,
        template_code: row.template_code,
        variables:     (row.payload_json as Record<string, unknown>) || {},
        locale:        (row.payload_json as Record<string, unknown>)?.locale as string || 'en',
        attempt:       (row.attempts || 0) + 1,
      })
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'unknown'
    logger.error('Retry sweep error', { error: errMsg })
  }
}

// ═══════════════════════════════════════════════════════════════
// WORKER STARTUP
// ═══════════════════════════════════════════════════════════════

export async function startWorker(): Promise<void> {
  logger.info('Starting email worker...')

  await connectBus()
  await consume(QUEUES.send, processMessage)

  // Start durable retry sweep
  setInterval(sweepRetryPending, SWEEP_INTERVAL_MS)
  logger.info('Retry sweep started', { intervalMs: SWEEP_INTERVAL_MS })

  logger.info('Email worker is running', {
    queue: QUEUES.send,
    maxAttempts: config.maxSendAttempts,
    retryBaseDelayMs: config.retryBaseDelayMs,
  })
}

// Graceful shutdown
async function shutdown() {
  logger.info('Worker shutting down...')
  await closeBus()
  await pool.end()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
