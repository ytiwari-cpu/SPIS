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
 *   app.use(errorHandler(logger))  // last middleware
 */

import { ApplicationError } from '../applicationError.js'

/**
 * Create the error-handling middleware.
 *
 * @param {{ error: Function, warn: Function }} logger — structured logger
 * @returns {import('express').ErrorRequestHandler}
 */
export function errorHandler(logger) {
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, _next) => {
    const isDev     = process.env.NODE_ENV !== 'production'
    const requestId = req.requestId || req.headers['x-request-id'] || null

    // ── ApplicationError (our own) ──────────────────────────────
    if (err instanceof ApplicationError) {
      const level = err.statusCode >= 500 ? 'error' : 'warn'
      logger[level](err.message, {
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

      logger.warn('Validation failed', {
        requestId,
        method:           req.method,
        path:             req.originalUrl,
        statusCode:       422,
        validationErrors: details,
        userId:           req.user?.sub,
      })

      res.status(422).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details },
      })
      return
    }

    // ── Unknown / unexpected error ──────────────────────────────
    const message = err?.message || 'Internal server error'

    logger.error('Unhandled error', {
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
      error: {
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
    error: { code: 'NOT_FOUND', message: `Not found: ${req.method} ${req.originalUrl}` },
  })
}
