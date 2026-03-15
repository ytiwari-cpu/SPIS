/**
 * backend/base/middleware/errorHandler.js
 *
 * Centralized Express error handler for all SPIS backend services.
 *
 * - ApplicationError → uses statusCode, code, message, details
 * - ZodError         → 422 validation error with field details
 * - Unknown error    → 500 Internal Server Error
 *
 * Always logs via the structured logger.
 * In production: stack traces are NOT sent to the client.
 *
 * Usage in api.js:
 *   import { errorHandler, notFound } from '../../../../base/middleware/errorHandler.js'
 *
 *   app.use(notFound)      // after all routes
 *   app.use(errorHandler()) // last middleware — no logger argument needed
 */

import { ApplicationError } from '../applicationError.js'
import { createLogger }     from '../logger.js'
import { createRequire }    from 'node:module'

// Lazy-load multer — not all services use file uploads
let MulterError = null
try {
  const require_ = createRequire(import.meta.url)
  const multer   = require_('multer')
  MulterError    = multer.MulterError || null
} catch {
  // multer not installed — MulterError checks will be skipped
}

/**
 * Create the error-handling middleware.
 *
 * No logger argument needed — creates a request-scoped logger internally
 * so error logs automatically carry requestId, method, url, and userId.
 *
 * @returns {import('express').ErrorRequestHandler}
 */
export function errorHandler() {
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, _next) => {
    const log       = createLogger('ErrorHandler', req)
    const isDev     = process.env.NODE_ENV !== 'production'
    const requestId = req.requestId || req.headers['x-request-id'] || null

    // ── MulterError (file upload) ──────────────────────────────
    if (MulterError && err instanceof MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        log.warn('File upload too large', { requestId, method: req.method, path: req.originalUrl })
        res.status(413).json({ success: false, error: { code: 'FILE_TOO_LARGE', message: 'File exceeds the maximum allowed size' } })
        return
      }
      log.warn('File upload error', { requestId, method: req.method, path: req.originalUrl, code: err.code })
      res.status(400).json({ success: false, error: { code: 'UPLOAD_ERROR', message: err.message } })
      return
    }

    // ── ApplicationError (our own) ──────────────────────────────
    if (err instanceof ApplicationError) {
      // Response validation errors: 500, hide details in production
      if (err.code === 'RESPONSE_VALIDATION_ERROR') {
        log.error('Response validation failed', {
          requestId,
          method:           req.method,
          path:             req.originalUrl,
          userId:           req.user?.sub,
          validationErrors: err.details,
        })
        res.status(500).json({
          success: false,
          error:   {
            code:    'RESPONSE_VALIDATION_ERROR',
            message: isDev ? err.message : 'Internal server error',
            ...(isDev && err.details ? { details: err.details } : {}),
          },
        })
        return
      }

      const level = err.statusCode >= 500 ? 'error' : 'warn'
      log[level](err.message, {
        requestId,
        method:     req.method,
        path:       req.originalUrl,
        statusCode: err.statusCode,
        code:       err.code,
        userId:     req.user?.sub,
        ...(err.statusCode === 422 && err.details ? { validationErrors: err.details } : {}),
        ...(isDev ? { stack: err.stack } : {}),
      })

      const body = { success: false, error: err.toJSON(isDev) }
      res.status(err.statusCode).json(body)
      return
    }

    // ── ZodError (validation library) ───────────────────────────
    if (err?.name === 'ZodError' || err?.constructor?.name === 'ZodError') {
      const details = (err.issues ?? err.errors ?? []).map(issue => ({
        field:   (issue.path ?? []).join('.'),
        message: issue.message,
        code:    issue.code,
        target:  'body',
      }))

      log.warn('Validation failed', {
        requestId,
        method:           req.method,
        path:             req.originalUrl,
        statusCode:       422,
        validationErrors: details,
        userId:           req.user?.sub,
      })

      res.status(422).json({
        success: false,
        error:   { code: 'VALIDATION_ERROR', message: 'Validation failed', details },
      })
      return
    }

    // ── Unknown / unexpected error ──────────────────────────────
    const message = err?.message || 'Internal server error'

    log.error('Unhandled error', {
      requestId,
      method:     req.method,
      path:       req.originalUrl,
      statusCode: 500,
      error:      message,
      userId:     req.user?.sub,
      ...(isDev ? { stack: err?.stack } : {}),
    })

    res.status(500).json({
      success: false,
      error:   {
        code:    'INTERNAL_ERROR',
        message: isDev ? message : 'Internal server error',
        ...(isDev && err?.stack ? { stack: err.stack } : {}),
      },
    })
  }
}

/**
 * 404 Not Found middleware — place after all routes, before errorHandler.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export function notFound(req, res) {
  res.status(404).json({
    success: false,
    error:   { code: 'NOT_FOUND', message: `Not found: ${req.method} ${req.originalUrl}` },
  })
}
