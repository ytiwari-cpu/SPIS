/**
 * SPIS Email Service — Email Request Repository
 *
 * CRUD for email_requests, rate_limits, providers, templates.
 */

import { v4 as uuidv4 } from 'uuid'
import { pool } from './pool.js'
import type {
  EmailRequestRow,
  EmailProviderRow,
  EmailStatus,
  ProviderName,
  TemplateVersionRow,
} from '../types.js'

// ═══════════════════════════════════════════════════════════════
// EMAIL REQUESTS
// ═══════════════════════════════════════════════════════════════

export async function createEmailRequest(params: {
  request_id?: string
  to_email: string
  template_code: string
  payload_json: Record<string, unknown>
}): Promise<EmailRequestRow> {
  const id = params.request_id || uuidv4()

  // Idempotency: if request_id already exists, return existing row
  if (params.request_id) {
    const existing = await getEmailRequest(params.request_id)
    if (existing) return existing
  }

  const { rows } = await pool.query<EmailRequestRow>(
    `INSERT INTO email_requests (request_id, to_email, template_code, payload_json)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [id, params.to_email, params.template_code, JSON.stringify(params.payload_json)]
  )
  return rows[0]
}

export async function getEmailRequest(requestId: string): Promise<EmailRequestRow | null> {
  const { rows } = await pool.query<EmailRequestRow>(
    'SELECT * FROM email_requests WHERE request_id = $1',
    [requestId]
  )
  return rows[0] || null
}

export async function updateEmailStatus(
  requestId: string,
  status: EmailStatus,
  extra?: { last_error?: string; provider_used?: ProviderName; sent_at?: string }
): Promise<void> {
  const sets: string[] = ['status = $2', 'attempts = attempts + 1']
  const params: unknown[] = [requestId, status]
  let idx = 3

  if (extra?.last_error !== undefined) {
    sets.push(`last_error = $${idx}`)
    params.push(extra.last_error)
    idx++
  }
  if (extra?.provider_used) {
    sets.push(`provider_used = $${idx}`)
    params.push(extra.provider_used)
    idx++
  }
  if (extra?.sent_at) {
    sets.push(`sent_at = $${idx}`)
    params.push(extra.sent_at)
    idx++
  }

  await pool.query(
    `UPDATE email_requests SET ${sets.join(', ')} WHERE request_id = $1`,
    params
  )
}

// ═══════════════════════════════════════════════════════════════
// PROVIDERS
// ═══════════════════════════════════════════════════════════════

export async function getProviders(): Promise<EmailProviderRow[]> {
  const { rows } = await pool.query<EmailProviderRow>(
    'SELECT * FROM email_providers ORDER BY provider_name'
  )
  return rows
}

export async function getActiveProvider(): Promise<EmailProviderRow | null> {
  const { rows } = await pool.query<EmailProviderRow>(
    `SELECT * FROM email_providers
     WHERE status = 'active'
       OR (status = 'cooldown' AND cooldown_until < NOW())
     ORDER BY
       CASE provider_name WHEN 'sendgrid' THEN 0 ELSE 1 END
     LIMIT 1`
  )
  return rows[0] || null
}

export async function recordProviderFailure(providerName: ProviderName, threshold: number, cooldownMs: number): Promise<void> {
  await pool.query(
    `UPDATE email_providers
     SET consecutive_failures = consecutive_failures + 1,
         status = CASE
           WHEN consecutive_failures + 1 >= $2 THEN 'cooldown'
           ELSE status
         END,
         cooldown_until = CASE
           WHEN consecutive_failures + 1 >= $2 THEN NOW() + ($3 || ' milliseconds')::INTERVAL
           ELSE cooldown_until
         END
     WHERE provider_name = $1`,
    [providerName, threshold, cooldownMs.toString()]
  )
}

export async function recordProviderSuccess(providerName: ProviderName): Promise<void> {
  await pool.query(
    `UPDATE email_providers
     SET consecutive_failures = 0,
         status = 'active',
         last_heartbeat = NOW(),
         cooldown_until = NULL
     WHERE provider_name = $1`,
    [providerName]
  )
}

// ═══════════════════════════════════════════════════════════════
// RATE LIMITS
// ═══════════════════════════════════════════════════════════════

/**
 * Check and increment rate limit.
 * Returns { allowed: boolean, remaining: number, resetAt: string }
 */
export async function checkRateLimit(
  key: string,
  windowSeconds: number,
  maxCount: number
): Promise<{ allowed: boolean; remaining: number; resetAt: string }> {
  const windowStart = new Date()
  windowStart.setSeconds(windowStart.getSeconds() - windowSeconds)

  // Cleanup expired rows first
  await pool.query('DELETE FROM rate_limits WHERE expires_at < NOW()')

  // Get current count in window
  const { rows } = await pool.query<{ total: string }>(
    `SELECT COALESCE(SUM(count), 0)::TEXT AS total
     FROM rate_limits
     WHERE key = $1 AND window_start >= $2`,
    [key, windowStart.toISOString()]
  )

  const currentCount = parseInt(rows[0].total, 10)

  if (currentCount >= maxCount) {
    const resetAt = new Date(Date.now() + windowSeconds * 1000).toISOString()
    return { allowed: false, remaining: 0, resetAt }
  }

  // Increment
  const expiresAt = new Date(Date.now() + windowSeconds * 1000).toISOString()
  await pool.query(
    `INSERT INTO rate_limits (key, window_start, count, expires_at)
     VALUES ($1, NOW(), 1, $2)
     ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1`,
    [key, expiresAt]
  )

  return {
    allowed: true,
    remaining: maxCount - currentCount - 1,
    resetAt: expiresAt,
  }
}

// ═══════════════════════════════════════════════════════════════
// TEMPLATES
// ═══════════════════════════════════════════════════════════════

export async function getLatestTemplate(
  templateCode: string,
  locale: string = 'en'
): Promise<TemplateVersionRow | null> {
  const { rows } = await pool.query<TemplateVersionRow>(
    `SELECT * FROM template_versions
     WHERE template_code = $1
       AND locale = $2
       AND deprecated_at IS NULL
     ORDER BY version DESC
     LIMIT 1`,
    [templateCode, locale]
  )

  // Fallback to English if locale not found
  if (rows.length === 0 && locale !== 'en') {
    return getLatestTemplate(templateCode, 'en')
  }

  return rows[0] || null
}

// ═══════════════════════════════════════════════════════════════
// BOUNCE FEEDBACK
// ═══════════════════════════════════════════════════════════════

export async function recordBounce(params: {
  message_id: string
  to_email: string
  reason: string
}): Promise<void> {
  await pool.query(
    `INSERT INTO bounce_feedback (message_id, to_email, reason)
     VALUES ($1, $2, $3)`,
    [params.message_id, params.to_email, params.reason]
  )
}
