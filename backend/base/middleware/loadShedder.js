/**
 * base/middleware/loadShedder.js
 *
 * Rejects requests when server is overloaded (too many in-flight requests).
 * Returns 503 SERVICE_OVERLOADED so clients can retry or back off.
 *
 * Usage:
 *   import { loadShedder } from '../../base/middleware/loadShedder.js'
 *   app.use(loadShedder({ maxConcurrent: 200 }))
 */

/**
 * @param {{ maxConcurrent?: number }} [options]
 * @returns {import('express').RequestHandler}
 */
export function loadShedder(options = {}) {
  const maxConcurrent = options.maxConcurrent || parseInt(process.env.MAX_CONCURRENT_REQUESTS || '200', 10)
  let inFlight = 0

  return (req, res, next) => {
    if (inFlight >= maxConcurrent) {
      return res.status(503).json({
        success: false,
        error:   { code: 'SERVICE_OVERLOADED', message: 'Server is overloaded — please retry shortly' },
      })
    }

    inFlight++

    res.on('finish', () => {
      inFlight--
    })
    res.on('close',  () => {
      inFlight--
    })

    next()
  }
}
