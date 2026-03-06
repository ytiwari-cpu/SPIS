/**
 * backend/base/logger.js
 *
 * Centralized structured logger for all SPIS backend services.
 *
 * Extracted from iam-service/src/lib/logger.ts and generalized:
 * - JSON output for log aggregators
 * - PII masking (passwords, OTPs, national_id, tokens, secrets)
 * - Configurable service name per instance
 * - Child loggers with embedded requestId / userId
 *
 * Usage:
 *   import { createLogger } from '../../../../base/logger.js'
 *
 *   const logger = createLogger('family-service')
 *   logger.info('Server started', { port: 3001 })
 *
 *   // Child logger (per request, carries requestId)
 *   const reqLogger = logger.child({ requestId: 'abc-123', userId: 'u-1' })
 *   reqLogger.info('Request received')
 */

// ═══════════════════════════════════════════════════════════════
// LOG LEVELS
// ═══════════════════════════════════════════════════════════════

const LEVEL_ORDER = { debug: 0, info: 1, warn: 2, error: 3 }

// ═══════════════════════════════════════════════════════════════
// PII MASKING
// ═══════════════════════════════════════════════════════════════

const SENSITIVE_KEYS = new Set([
  'password', 'new_password', 'otp', 'otp_code', 'otp_hash',
  'token', 'access_token', 'refresh_token', 'api_key', 'apikey',
  'secret', 'mfa_secret', 'authorization', 'cookie',
  'national_id', 'national_id_hash', 'client_secret',
  'pin', 'credential', 'private_key', 'privatekey',
])

/**
 * Mask a single sensitive value.
 * @param {string} key
 * @param {unknown} value
 * @returns {unknown}
 */
function maskValue(key, value) {
  if (typeof value === 'string' && SENSITIVE_KEYS.has(key.toLowerCase())) {
    if (value.length <= 4) return '***'
    return value.slice(0, 2) + '***' + value.slice(-2)
  }
  return value
}

/**
 * Deep-mask an object, redacting all sensitive keys.
 * @param {Record<string, unknown>} obj
 * @param {number} [depth=0]
 * @returns {Record<string, unknown>}
 */
function maskObject(obj, depth = 0) {
  if (depth > 5) return '[MAX_DEPTH]'
  if (obj === null || obj === undefined) return obj
  if (typeof obj !== 'object') return obj
  if (Array.isArray(obj)) {
    return obj.slice(0, 20).map(item => maskObject(item, depth + 1))
  }

  const result = {}
  for (const [key, val] of Object.entries(obj)) {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      result[key] = maskObject(val, depth + 1)
    } else {
      result[key] = maskValue(key, val)
    }
  }
  return result
}

/**
 * Mask email addresses: "john@acme.com" → "jo***@acme.com"
 * @param {string} email
 * @returns {string}
 */
function maskEmail(email) {
  if (typeof email !== 'string') return email
  const [local, domain] = email.split('@')
  if (!domain) return '***@***'
  const maskedLocal = local.length <= 2 ? '***' : local.slice(0, 2) + '***'
  return `${maskedLocal}@${domain}`
}

// ═══════════════════════════════════════════════════════════════
// LOGGER FACTORY
// ═══════════════════════════════════════════════════════════════

/**
 * Create a structured logger for a service.
 *
 * @param {string} serviceName — e.g. 'family-service', 'iam-service'
 * @param {{ level?: string }} [options]
 * @returns {{ info, warn, error, debug, child }}
 */
export function createLogger(serviceName, options = {}) {
  const currentLevel = (options.level || process.env.LOG_LEVEL || 'info').toLowerCase()

  /**
   * Core emit function — writes a single JSON log line.
   * @param {string} level
   * @param {string} message
   * @param {Record<string, unknown>} [meta]
   * @param {Record<string, unknown>} [baseMeta] — persistent meta from child()
   */
  function emit(level, message, meta, baseMeta = {}) {
    if ((LEVEL_ORDER[level] ?? 1) < (LEVEL_ORDER[currentLevel] ?? 1)) return

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service: serviceName,
      ...baseMeta,
      message,
    }

    if (meta) {
      const safe = maskObject(meta)
      if (typeof safe.email === 'string')    safe.email    = maskEmail(safe.email)
      if (typeof safe.to_email === 'string') safe.to_email = maskEmail(safe.to_email)
      Object.assign(entry, safe)
    }

    const fn = level === 'error' ? console.error
             : level === 'warn'  ? console.warn
             : console.log
    fn(JSON.stringify(entry))
  }

  /**
   * Build a logger object with optional base meta.
   * @param {Record<string, unknown>} [baseMeta]
   */
  function buildLogger(baseMeta = {}) {
    const loggerObj = {
      debug: (msg, meta) => emit('debug', msg, meta, baseMeta),
      info:  (msg, meta) => emit('info',  msg, meta, baseMeta),
      warn:  (msg, meta) => emit('warn',  msg, meta, baseMeta),
      error: (msg, meta) => emit('error', msg, meta, baseMeta),

      /**
       * Create a child logger with persistent meta fields.
       * @param {Record<string, unknown>} childMeta — e.g. { requestId, userId }
       * @returns {{ info, warn, error, debug, child }}
       */
      child(childMeta) {
        return buildLogger({ ...baseMeta, ...childMeta })
      },
    }
    return loggerObj
  }

  return buildLogger()
}

// ═══════════════════════════════════════════════════════════════
// UTILITY EXPORTS (for middleware / audit)
// ═══════════════════════════════════════════════════════════════

export { maskObject, maskEmail, maskValue, SENSITIVE_KEYS }
