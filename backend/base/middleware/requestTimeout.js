/**
 * base/middleware/requestTimeout.js
 *
 * Kills requests that exceed a configurable timeout.
 * Prevents hung database queries or slow service calls from blocking the server.
 *
 * Usage:
 *   import { requestTimeout } from '../../base/middleware/requestTimeout.js'
 *   app.use(requestTimeout(30000))  // 30 seconds
 */

/**
 * @param {number} [timeoutMs=30000] — timeout in milliseconds
 * @returns {import('express').RequestHandler}
 */
export function requestTimeout(timeoutMs = 30000) {
  return (req, res, next) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(503).json({
          success: false,
          error:   { code: 'REQUEST_TIMEOUT', message: 'Request timed out' },
        })
      }
    }, timeoutMs)

    // Clear timer when response finishes
    res.on('finish', () => clearTimeout(timer))
    res.on('close', () => clearTimeout(timer))

    next()
  }
}
