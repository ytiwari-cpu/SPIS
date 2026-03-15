/**
 * base/redisCache.js — Centralized Redis cache utility
 *
 * CACHING POLICY:
 *
 * WHAT IS CACHED:
 *   - Only safe idempotent GET responses.
 *   - Never POST/PATCH/PUT/DELETE responses.
 *   - Never private user data without user-scoped keys.
 *
 * KEY STRATEGY:
 *   Format: <service>:<resource>:<id-or-filter-hash>:<user-sub>
 *   Example: "family:family:uuid-123:user-sub-456"
 *   - Always include user sub to prevent cross-user data leaks.
 *   - For list endpoints with query params, hash the query object into the key.
 *
 * TTL STRATEGY:
 *   - List endpoints:            60s
 *   - Detail endpoints:         120s
 *   - Config/metadata endpoints: 300s
 *
 * INVALIDATION:
 *   - On write (POST/PATCH/DELETE), delete keys matching the affected resource prefix.
 *   - Use delByPattern('family:family:uuid-123:*') to clear all user-scoped views.
 *   - Invalidation happens inside the Service layer, after a successful write.
 *   - Do NOT invalidate from Controller.
 */

import crypto from 'node:crypto'

/**
 * Build a deterministic cache key from parts + optional query params.
 *
 * @param {...string} parts — key segments
 * @returns {string}
 */
export function cacheKey(...parts) {
  return parts.filter(Boolean).join(':')
}

/**
 * Hash an object (query params, body, etc.) into a short deterministic string.
 *
 * @param {object} obj
 * @returns {string} — 12-char hex hash
 */
export function hashObject(obj) {
  const sorted = JSON.stringify(obj, Object.keys(obj).sort())
  return crypto.createHash('sha256').update(sorted).digest('hex').slice(0, 12)
}

/**
 * Create a Redis cache wrapper with fail-open semantics.
 * Every method is wrapped in try/catch — a Redis outage never returns 500.
 *
 * @param {import('ioredis').Redis | null} redisClient
 * @param {{ warn: Function, error: Function }} [logger]
 * @returns {{ get, set, del, delByPattern }}
 */
export function createRedisCache(redisClient, logger) {
  const log = logger || {
    warn:  (...args) => console.warn('[RedisCache]', ...args),
    error: (...args) => console.error('[RedisCache]', ...args),
  }

  const noop = {
    get()                 {
      return null
    },
    async set()           {},
    async del()           {},
    async delByPattern()  {},
  }

  // If no Redis client, return a no-op cache (pure fail-open)
  if (!redisClient) {
    return noop
  }

  return {
    /**
     * Retrieve a cached value. Returns null on miss or error.
     */
    async get(key) {
      try {
        const raw = await redisClient.get(key)
        return raw ? JSON.parse(raw) : null
      } catch (err) {
        log.warn('Redis GET failed — MISS fallback', { key, err: err.message })
        return null
      }
    },

    /**
     * Store a value with TTL (seconds). Silently skips on error.
     */
    async set(key, value, ttlSeconds) {
      try {
        await redisClient.setex(key, ttlSeconds, JSON.stringify(value))
      } catch (err) {
        log.warn('Redis SET failed — cache write skipped', { key, err: err.message })
      }
    },

    /**
     * Delete a single key. Silently skips on error.
     */
    async del(key) {
      try {
        await redisClient.del(key)
      } catch (err) {
        log.warn('Redis DEL failed — stale cache possible', { key, err: err.message })
      }
    },

    /**
     * Delete all keys matching a glob pattern using SCAN (non-blocking).
     * Example: delByPattern('family:family:uuid-123:*')
     */
    async delByPattern(pattern) {
      try {
        let cursor = '0'
        do {
          const [nextCursor, keys] = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
          cursor = nextCursor
          if (keys.length > 0) {
            await redisClient.del(...keys)
          }
        } while (cursor !== '0')
      } catch (err) {
        log.warn('Redis delByPattern failed — stale cache possible', { pattern, err: err.message })
      }
    },
  }
}
