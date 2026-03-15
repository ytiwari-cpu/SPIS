/**
 * base/middleware/cache.js — Response cache middleware
 *
 * Auto-injected by apiSchema.js when an endpoint declares `cache: { ... }`.
 * Only caches GET responses. Sets X-Cache header (HIT / MISS).
 *
 * The cache key includes the user sub (from JWT) to prevent cross-user leaks.
 * Query params are hashed into the key for list endpoints.
 *
 * Usage (in endpoint config):
 *   cache: { ttl: 60, prefix: 'family:families' }
 */

import { hashObject } from '../redisCache.js'

/**
 * Create a response cache middleware.
 *
 * @param {object} options
 * @param {object} options.cache — the redis cache instance (from createRedisCache)
 * @param {number} options.ttl — TTL in seconds
 * @param {string} options.prefix — key prefix (e.g. 'family:families')
 * @returns {import('express').RequestHandler}
 */
export function cacheMiddleware({ cache, ttl = 60, prefix = 'api' }) {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next()
    }

    // No cache instance → skip (fail-open)
    if (!cache) {
      return next()
    }

    // Build key: prefix:path-params:query-hash:user-sub
    const userSub   = req.user?.sub || 'anon'
    const paramHash = req.params ? Object.values(req.params).join(':') : ''
    const queryHash = req.query && Object.keys(req.query).length > 0
      ? hashObject(req.query)
      : ''

    const keyParts = [prefix, paramHash, queryHash, userSub].filter(Boolean)
    const key      = keyParts.join(':')

    // Try cache HIT
    const cached = await cache.get(key)
    if (cached) {
      res.setHeader('X-Cache', 'HIT')
      res.status(cached._statusCode || 200).json(cached._body)
      return
    }

    // Cache MISS — intercept res.json() to capture + cache the response
    const originalJson = res.json.bind(res)

    res.json = (body) => {
      res.setHeader('X-Cache', 'MISS')

      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.set(key, { _statusCode: res.statusCode, _body: body }, ttl)
          .catch(() => {}) // fire-and-forget, fail-open
      }

      return originalJson(body)
    }

    next()
  }
}
