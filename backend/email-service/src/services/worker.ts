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
import { logger } from '../lib/logger.js'
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

  await updateEmailStatus(request_id, isFinal ? 'failed' : 'queued', {
    last_error: error,
  })

  if (isFinal) {
    // Max attempts reached — publish email.failed
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
    // Schedule retry with exponential backoff
    const delayMs = config.retryBaseDelayMs * Math.pow(2, attempt - 1)

    logger.warn('Email send failed, scheduling retry', {
      request_id,
      attempt,
      nextAttempt: attempt + 1,
      delayMs,
    })

    setTimeout(() => {
      // Re-publish with incremented attempt
      publishEmailSend({
        request_id,
        to_email: msg.to_email,
        template_code: msg.template_code,
        variables: msg.variables,
        locale: msg.locale,
        attempt: attempt + 1,
      })
    }, delayMs)
  }
}

// ═══════════════════════════════════════════════════════════════
// WORKER STARTUP
// ═══════════════════════════════════════════════════════════════

export async function startWorker(): Promise<void> {
  logger.info('Starting email worker...')

  await connectBus()
  await consume(QUEUES.send, processMessage)

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
