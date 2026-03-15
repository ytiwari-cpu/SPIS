/**
 * iam-service/src/middleware/auditLog.js
 *
 * HTTP audit logging middleware for iam-service.
 *
 * Writes a row to the iam-service `audit_logs` table on every mutating request
 * (POST/PUT/PATCH/DELETE). Read requests are skipped by default.
 *
 * - Fail-silent: DB errors NEVER break the request
 * - Sensitive fields are redacted before writing request_summary
 * - Health/readiness paths are excluded
 *
 * Usage in api.js:
 *   import { auditMiddleware } from './middleware/auditLog.js'
 *
 *   app.use(auditMiddleware({
 *     pool: pgPool,
 *     excludePaths: ['/health', '/healthz'],
 *   }))
 */

import { createLogger } from '../../../base/logger.js'
import { BaseService }  from '../../../base/baseService.js'

// ═══════════════════════════════════════════════════════════════
// DEFAULT SENSITIVE FIELDS
// ═══════════════════════════════════════════════════════════════

const DEFAULT_SENSITIVE_FIELDS = [
  'password', 'passwordHash', 'new_password',
  'token', 'access_token', 'refresh_token',
  'secret', 'mfa_secret', 'otp', 'otp_code', 'otp_hash',
  'pin', 'api_key', 'apiKey', 'authorization',
  'cookie', 'session', 'credential', 'private_key', 'privateKey',
  'national_id', 'national_id_hash', 'client_secret',
]

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Check if path matches an exclusion pattern.
 */
function isExcludedPath(path, excludePaths) {
  return excludePaths.some(pattern => {
    const trimmed = pattern.trim()
    if (trimmed.endsWith('*')) {
      return path.startsWith(trimmed.slice(0, -1))
    }
    return path === trimmed
  })
}

/**
 * Sanitize object by removing sensitive fields (deep, max depth 5).
 */
function sanitizeObject(obj, sensitiveFields, depth = 0) {
  if (depth > 5) {
    return '[MAX_DEPTH]'
  }
  if (obj === null || obj === undefined) {
    return obj
  }
  if (typeof obj !== 'object') {
    return obj
  }
  if (Array.isArray(obj)) {
    return obj.slice(0, 10).map(item => sanitizeObject(item, sensitiveFields, depth + 1))
  }

  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase()
    if (sensitiveFields.some(f => lowerKey.includes(f.toLowerCase()))) {
      result[key] = '[REDACTED]'
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeObject(value, sensitiveFields, depth + 1)
    } else if (typeof value === 'string' && value.length > 500) {
      result[key] = `${value.slice(0, 500)  }...[TRUNCATED]`
    } else {
      result[key] = value
    }
  }
  return result
}

/**
 * Generate audit action from HTTP method + path.
 */
function generateAction(method, path) {
  const parts = path.split('/').filter(Boolean)
  let resource = 'UNKNOWN'
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i]
    if (/^[a-f0-9-]{36}$/i.test(part)) {
      continue
    }
    if (/^\d+$/.test(part)) {
      continue
    }
    if (['api', 'v1', 'v2', 'iam', 'admin', 'email'].includes(part)) {
      continue
    }
    resource = part.toUpperCase().replace(/-/g, '_')
    break
  }
  const actions = { GET: 'READ', POST: 'CREATED', PUT: 'UPDATED', PATCH: 'UPDATED', DELETE: 'DELETED' }
  return `${resource}_${actions[method.toUpperCase()] || method.toUpperCase()}`
}

/**
 * Extract resource type and ID from URL path.
 */
function extractResource(path) {
  const parts = path.split('/').filter(Boolean)
  let resourceType = null
  let resourceId   = null

  for (const part of parts) {
    if (['api', 'v1', 'v2', 'iam', 'admin', 'email'].includes(part)) {
      continue
    }
    if (/^[a-f0-9-]{36}$/i.test(part)) {
      resourceId = part
      continue
    }
    if (/^\d+$/.test(part)) {
      resourceId = part
      continue
    }
    if (!resourceType) {
      resourceType = part.replace(/-/g, '_')
    }
  }
  return { type: resourceType, id: resourceId }
}

/**
 * Get client IP.
 */
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim()
  }
  if (Array.isArray(forwarded)) {
    return forwarded[0].trim()
  }
  return req.socket?.remoteAddress || 'unknown'
}

// ═══════════════════════════════════════════════════════════════
// MIDDLEWARE FACTORY
// ═══════════════════════════════════════════════════════════════

/**
 * Create audit logging middleware.
 *
 * @param {{
 *   pool?: import('pg').Pool,
 *   excludePaths?: string[],
 *   logGets?: boolean,
 *   sensitiveFields?: string[],
 *   auditTable?: string,
 *   schema?: string,
 * }} options
 * @returns {import('express').RequestHandler}
 */
export function auditMiddleware(options) {
  const {
    pool,
    excludePaths    = ['/health', '/healthz', '/readyz'],
    logGets         = false,
    sensitiveFields = DEFAULT_SENSITIVE_FIELDS,
    auditTable      = 'audit_logs',
    schema,
  } = options

  const enabled = process.env.AUDIT_ENABLED !== 'false'
  const tableName = schema ? `${schema}.${auditTable}` : auditTable

  return (req, res, next) => {
    if (!enabled || !pool) {
      return next()
    }
    if (isExcludedPath(req.path, excludePaths)) {
      return next()
    }
    if (!logGets && req.method === 'GET') {
      return next()
    }

    const log       = createLogger('AuditLog', req)
    const startTime = Date.now()
    const requestId = req.requestId || req.headers['x-request-id'] || BaseService.generateUUID()

    // Intercept res.json to capture response summary
    const originalJson = res.json.bind(res)
    let responseData

    res.json = function(data) {
      responseData = data
      return originalJson(data)
    }

    // Write audit log on response finish
    res.on('finish', async () => {
      try {
        const duration = Date.now() - startTime
        const { type: resourceType, id: resourceId } = extractResource(req.path)

        const actorSub   = req.user?.sub
        const actorEmail = req.user?.email
        const actorRoles = req.user?.roles

        const sanitizedBody = req.body ? sanitizeObject(req.body, sensitiveFields) : null

        const responseSummary = responseData ? {
          success: responseData.success,
          error:   responseData.error ? { code: responseData.error.code } : undefined,
        } : undefined

        const sql = `
          INSERT INTO ${tableName} (
            request_id, actor_sub, actor_email, actor_roles, action,
            method, path, resource_type, resource_id, status_code,
            ip_address, user_agent, request_summary, response_summary, duration_ms
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        `
        const params = [
          requestId,
          actorSub      || null,
          actorEmail    || null,
          actorRoles    || null,
          generateAction(req.method, req.path),
          req.method,
          req.path,
          resourceType  || null,
          resourceId    || null,
          res.statusCode,
          getClientIp(req),
          req.headers['user-agent'] || null,
          sanitizedBody ? JSON.stringify(sanitizedBody) : null,
          responseSummary ? JSON.stringify(responseSummary) : null,
          duration,
        ]

        await pool.query(sql, params)
      } catch (error) {
        // Fail-silent: audit errors NEVER break the request
        log.error('Failed to write audit log', {
          path:  req.path,
          error: error.message,
        })
      }
    })

    next()
  }
}
