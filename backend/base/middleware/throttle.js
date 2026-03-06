/**
 * backend/base/middleware/throttle.js
 *
 * Concurrency-based throttle (different from rate limiting).
 *
 * Rate limiting: N requests per time window.
 * Throttle: N concurrent requests at the same time.
 *
 * Useful for expensive operations (bulk import, export) where you want
 * to limit the number of in-flight requests per user/IP.
 *
 * Usage:
 *   import { throttle } from '../../../../base/middleware/throttle.js'
 *
 *   app.use('/api/v1/import', throttle({
 *     prefix: 'import',
 *     maxConcurrent: 5,
 *     keyFn: (req) => req.user?.sub || req.ip,
 *     redisClient: redis,
 *   }))
 */

/**
 * Concurrency throttle middleware factory.
 *
 * @param {{
 *   prefix: string,
 *   maxConcurrent: number,
 *   keyFn?: (req: import('express').Request) => string,
 *   redisClient: import('ioredis').default,
 *   ttlSec?: number,
 *   logger?: { warn: Function, error: Function },
 * }} options
 * @returns {import('express').RequestHandler}
 */
export function throttle(options) {
  const {
    prefix,
    maxConcurrent,
    keyFn,
    redisClient,
    ttlSec = 300,   // auto-expire safety net (5 min)
    logger,
  } = options

  const log = logger || {
    warn:  (msg, meta) => console.warn(`[WARN] ${msg}`, meta ?? ''),
    error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta ?? ''),
  }

  return async (req, res, next) => {
    if (!redisClient) return next()

    const identifier = keyFn ? keyFn(req) : (req.ip || 'unknown')
    const key = `throttle:${prefix}:${identifier}`

    try {
      const count = await redisClient.incr(key)

      // Set TTL on first increment (safety net)
      if (count === 1) {
        await redisClient.expire(key, ttlSec)
      }

      if (count > maxConcurrent) {
        // Over concurrency limit — decrement back and reject
        await redisClient.decr(key)
        log.warn('Throttle limit exceeded', { prefix, key, count, max: maxConcurrent })

        res.status(429).json({
          success: false,
          error: {
            code: 429,
            message: `Too many concurrent requests. Max ${maxConcurrent} allowed.`,
          },
        })
        return
      }

      // Decrement on response finish
      const cleanup = async () => {
        try {
          const val = await redisClient.decr(key)
          // Don't let counter go negative
          if (val < 0) await redisClient.set(key, 0, 'EX', ttlSec)
        } catch (err) {
          log.error('Throttle cleanup error', { error: err.message, key })
        }
      }

      res.on('finish', cleanup)
      res.on('close', cleanup)
    } catch (err) {
      // Fail-open: if Redis is down, allow the request through
      log.error('Throttle Redis error — allowing request', { error: err.message, prefix })
    }

    next()
  }
}
