/**
 * base/middleware/requestLogger.js
 *
 * Structured HTTP request/response logging middleware.
 * Replaces morgan with a structured JSON logger that redacts sensitive URL segments.
 *
 * Usage:
 *   import { requestLogger } from '../../base/middleware/requestLogger.js'
 *   app.use(requestLogger('iam-service'))
 */

import { createLogger } from '../logger.js'

/**
 * Redact sensitive segments from URLs to prevent PII in logs.
 * - National IDs in path parameters
 * - Tokens/OTPs in query strings
 */
function redactUrl(url) {
  return url
    .replace(/\/check-national-id\/[^/?]+/, '/check-national-id/[REDACTED]')
    .replace(/national_id=[^&]+/gi, 'national_id=[REDACTED]')
    .replace(/token=[^&]+/gi, 'token=[REDACTED]')
    .replace(/otp=[^&]+/gi, 'otp=[REDACTED]')
}

/**
 * @param {string} serviceName — label for the logger (e.g. 'iam-service')
 * @returns {import('express').RequestHandler}
 */
export function requestLogger(serviceName) {
  const logger = createLogger(serviceName)

  return (req, res, next) => {
    // Skip health check endpoints — high volume, no value
    if (req.url?.includes('/health') || req.url?.includes('/healthz') || req.url?.includes('/readyz')) {
      return next()
    }

    const start = Date.now()

    res.on('finish', () => {
      const duration = Date.now() - start
      const level = res.statusCode >= 500 ? 'error'
        : res.statusCode >= 400 ? 'warn'
          : 'info'

      logger[level]('HTTP request', {
        method:        req.method,
        url:           redactUrl(req.originalUrl || req.url),
        statusCode:    res.statusCode,
        duration:      `${duration}ms`,
        requestId:     req.requestId || req.headers['x-request-id'] || undefined,
        userId:        req.user?.sub || undefined,
        contentLength: res.getHeader('content-length') || undefined,
      })
    })

    next()
  }
}
