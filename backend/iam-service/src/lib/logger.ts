/**
 * SPIS IAM Service — Structured Logger with PII Masking
 *
 * JSON output for log aggregators.
 * Masks sensitive fields (password, otp, national_id, secrets, tokens).
 */

import { config } from '../config.js'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }
const currentLevel = (config.logLevel as LogLevel) || 'info'

const SENSITIVE_KEYS = new Set([
  'otp', 'otp_code', 'otp_hash', 'password', 'new_password',
  'password_hash', 'token', 'api_key', 'apikey', 'secret',
  'mfa_secret', 'authorization', 'cookie', 'national_id',
  'national_id_hash', 'client_secret',
])

function maskValue(key: string, value: unknown): unknown {
  if (typeof value === 'string' && SENSITIVE_KEYS.has(key.toLowerCase())) {
    if (value.length <= 4) return '***'
    return value.slice(0, 2) + '***' + value.slice(-2)
  }
  return value
}

function maskObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(obj)) {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      result[key] = maskObject(val as Record<string, unknown>)
    } else {
      result[key] = maskValue(key, val)
    }
  }
  return result
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return '***@***'
  const maskedLocal = local.length <= 2 ? '***' : local.slice(0, 2) + '***'
  return `${maskedLocal}@${domain}`
}

function emit(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[currentLevel]) return

  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    service: 'iam-service',
    message,
  }

  if (meta) {
    const safe = maskObject(meta)
    if (typeof safe.email === 'string') safe.email = maskEmail(safe.email)
    if (typeof safe.to_email === 'string') safe.to_email = maskEmail(safe.to_email)
    Object.assign(entry, safe)
  }

  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  fn(JSON.stringify(entry))
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => emit('debug', msg, meta),
  info:  (msg: string, meta?: Record<string, unknown>) => emit('info', msg, meta),
  warn:  (msg: string, meta?: Record<string, unknown>) => emit('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit('error', msg, meta),
}
