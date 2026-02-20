/**
 * SPIS IAM Service — Redis Client
 *
 * Used for:
 *  - user_id ↔ registry_id mapping cache (TTL 24h, refreshed on login)
 *  - JWKS public keys cache (TTL configurable, default 15m)
 *  - Rate-limit counters for login attempts
 */

import Redis from 'ioredis'
import { config } from '../config.js'
import { logger } from './logger.js'

export const redis = new Redis.default(config.redisUrl, {
  keyPrefix: config.redisKeyPrefix,
  retryStrategy(times: number) {
    const delay = Math.min(times * 200, 5000)
    logger.warn('Redis reconnecting', { attempt: times, delayMs: delay })
    return delay
  },
  maxRetriesPerRequest: 3,
})

redis.on('connect', () => logger.info('Redis connected'))
redis.on('error', (err: Error) => logger.error('Redis error', { error: err.message }))

// ═══════════════════════════════════════════════════════════════
// USER ↔ REGISTRY MAPPING  (TTL 24h)
// ═══════════════════════════════════════════════════════════════

const USER_REG_TTL = 86400  // 24 hours

export async function cacheUserRegistryId(userId: string, registryId: string): Promise<void> {
  await redis.set(`user:reg:${userId}`, registryId, 'EX', USER_REG_TTL)
  await redis.set(`reg:user:${registryId}`, userId, 'EX', USER_REG_TTL)
}

export async function getRegistryIdByUserId(userId: string): Promise<string | null> {
  return redis.get(`user:reg:${userId}`)
}

export async function getUserIdByRegistryId(registryId: string): Promise<string | null> {
  return redis.get(`reg:user:${registryId}`)
}

export async function invalidateUserCache(userId: string, registryId: string): Promise<void> {
  await redis.del(`user:reg:${userId}`)
  await redis.del(`reg:user:${registryId}`)
}

// ═══════════════════════════════════════════════════════════════
// JWKS CACHE
// ═══════════════════════════════════════════════════════════════

export async function cacheJwks(jwksJson: string): Promise<void> {
  await redis.set('jwks', jwksJson, 'EX', config.jwks.cacheTtlSeconds)
}

export async function getCachedJwks(): Promise<string | null> {
  return redis.get('jwks')
}

// ═══════════════════════════════════════════════════════════════
// RATE LIMIT COUNTERS (sliding window via INCR + EXPIRE)
// ═══════════════════════════════════════════════════════════════

export async function incrementRateCounter(key: string, windowSec: number): Promise<number> {
  const k = `rl:${key}`
  const count = await redis.incr(k)
  if (count === 1) {
    await redis.expire(k, windowSec)
  }
  return count
}

export async function getRateCounter(key: string): Promise<number> {
  const val = await redis.get(`rl:${key}`)
  return val ? parseInt(val, 10) : 0
}

// ═══════════════════════════════════════════════════════════════
// HEALTH
// ═══════════════════════════════════════════════════════════════

export async function testRedisConnection(): Promise<boolean> {
  try {
    const res = await redis.ping()
    return res === 'PONG'
  } catch {
    return false
  }
}

export async function closeRedis(): Promise<void> {
  await redis.quit()
}
