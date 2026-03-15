/**
 * backend/base/logger.js
 *
 * Structured JSON logger for all SPIS backend services.
 *
 * Usage:
 *   import { createLogger } from '../../../../base/logger.js'
 *
 *   // Plain logger (startup, workers, services):
 *   const logger = createLogger('FamilyService')
 *   logger.info('Server started', { port: 3001 })
 *
 *   // Request-scoped logger (controllers, context) — request context is auto-extracted:
 *   const logger = createLogger('ApiContext', req)
 *   logger.info('Request received')
 *   // → { level: 'info', logger: 'ApiContext', requestId: '...',
 *   //     method: 'GET', url: '/...', userId: '...', message: '...' }
 */

// ───────────────────────────────────────────────────────────────
// LOG LEVELS
// ───────────────────────────────────────────────────────────────

const LEVEL_ORDER = { debug: 0, info: 1, warn: 2, error: 3 }

// ───────────────────────────────────────────────────────────────
// PII MASKING  — internal only, runs on every meta object
// ───────────────────────────────────────────────────────────────

const SENSITIVE_KEYS = new Set([
  'password', 'new_password', 'otp', 'otp_code', 'otp_hash',
  'token', 'access_token', 'refresh_token', 'api_key', 'apikey',
  'secret', 'mfa_secret', 'authorization', 'cookie',
  'national_id', 'national_id_hash', 'client_secret',
  'pin', 'credential', 'private_key', 'privatekey',
])

function maskValue(key, value) {
  if (typeof value === 'string' && SENSITIVE_KEYS.has(key.toLowerCase())) {
    return value.length <= 4 ? '***' : `${value.slice(0, 2)  }***${  value.slice(-2)}`
  }
  return value
}

function maskObject(obj, depth = 0) {
  if (depth > 5 || obj === null || obj === undefined) {
    return obj
  }
  if (typeof obj !== 'object') {
    return obj
  }
  if (Array.isArray(obj)) {
    return obj.slice(0, 20).map(item => maskObject(item, depth + 1))
  }

  const result = {}
  for (const [key, val] of Object.entries(obj)) {
    result[key] = (val && typeof val === 'object' && !Array.isArray(val))
      ? maskObject(val, depth + 1)
      : maskValue(key, val)
  }
  return result
}

function maskEmail(email) {
  if (typeof email !== 'string') {
    return email
  }
  const [local, domain] = email.split('@')
  if (!domain) {
    return '***@***'
  }
  return `${local.length <= 2 ? '***' : `${local.slice(0, 2)  }***`}@${domain}`
}

// ───────────────────────────────────────────────────────────────
// REQUEST CONTEXT EXTRACTION
// ───────────────────────────────────────────────────────────────

/**
 * Extract loggable context from an Express request.
 * Safe — never throws if req is malformed.
 */
function filterRequest(req) {
  if (!req || typeof req !== 'object') {
    return {}
  }
  return {
    requestId: req.requestId || req.headers?.['x-request-id'] || undefined,
    method:    req.method    || undefined,
    url:       req.url || req.path || undefined,
    userId:    req.user?.sub || req.user?.id || undefined,
  }
}

// ───────────────────────────────────────────────────────────────
// LOGGER FACTORY
// ───────────────────────────────────────────────────────────────

/**
 * Create a structured logger.
 *
 * @param {string}  [name]    — component label, e.g. 'ApiContext', 'FamilyService'
 * @param {object}  [request] — Express req; when provided, requestId/method/url/userId are auto-included
 * @returns {{ debug, info, warn, error }}
 */
// ───────────────────────────────────────────────────────────────
// PRETTY PRINTER (development / LOG_FORMAT=pretty)
// ───────────────────────────────────────────────────────────────

const COLORS = {
  reset: '\x1b[0m',
  bold:  '\x1b[1m',
  dim:   '\x1b[2m',
  debug: '\x1b[36m',   // cyan
  info:  '\x1b[32m',   // green
  warn:  '\x1b[33m',   // yellow
  error: '\x1b[31m',   // red
  label: '\x1b[35m',   // magenta  (logger name)
  meta:  '\x1b[90m',   // grey     (extra fields)
}

const LEVEL_LABEL = {
  debug: 'DEBUG',
  info:  ' INFO',
  warn:  ' WARN',
  error: 'ERROR',
}

function prettyPrint(level, name, message, extra) {
  const c      = COLORS
  const lc     = c[level] || c.info
  const label  = LEVEL_LABEL[level] || level.toUpperCase()
  const time   = new Date().toTimeString().slice(0, 8)

  const parts = [
    `${c.dim}${time}${c.reset}`,
    `${lc}${c.bold}${label}${c.reset}`,
    name ? `${c.label}[${name}]${c.reset}` : '',
    `${lc}${message}${c.reset}`,
  ].filter(Boolean).join(' ')

  const metaStr = extra && Object.keys(extra).length
    ? `\n  ${c.meta}${JSON.stringify(extra, null, 2).replace(/\n/g, '\n  ')}${c.reset}`
    : ''

  /* eslint-disable no-console */
  const fn = level === 'error' ? console.error
    : level === 'warn'  ? console.warn
      : console.log
  /* eslint-enable no-console */
  fn(parts + metaStr)
}

export function createLogger(name, request) {
  // Read env at call time (not module load time) so dotenv has already run.
  const IS_PRETTY = process.env.LOG_FORMAT === 'pretty'
    || (process.env.NODE_ENV !== 'production' && process.env.LOG_FORMAT !== 'json')
  const minLevel = (process.env.LOG_LEVEL || 'info').toLowerCase()
  const reqCtx   = filterRequest(request)

  function emit(level, message, meta) {
    if ((LEVEL_ORDER[level] ?? 1) < (LEVEL_ORDER[minLevel] ?? 1)) {
      return
    }

    if (meta) {
      const safe = maskObject(meta)
      if (typeof safe.email    === 'string') {
        safe.email    = maskEmail(safe.email)
      }
      if (typeof safe.to_email === 'string') {
        safe.to_email = maskEmail(safe.to_email)
      }
      meta = safe
    }

    if (IS_PRETTY) {
      const extra = { ...reqCtx, ...meta }
      prettyPrint(level, name, message, Object.keys(extra).length ? extra : null)
      return
    }

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      ...(name    ? { logger: name } : {}),
      ...reqCtx,
      message,
    }
    if (meta) {
      Object.assign(entry, meta)
    }

    /* eslint-disable no-console */
    const fn = level === 'error' ? console.error
      : level === 'warn'  ? console.warn
        : console.log
    /* eslint-enable no-console */
    fn(JSON.stringify(entry))
  }

  return {
    debug: (msg, meta) => emit('debug', msg, meta),
    info:  (msg, meta) => emit('info',  msg, meta),
    warn:  (msg, meta) => emit('warn',  msg, meta),
    error: (msg, meta) => emit('error', msg, meta),
  }
}
