/**
 * api.js — programme-service Express app factory
 *
 * Configures middleware and mounts all route handlers.
 * Exported as createApp() so index.ts only handles server startup.
 */

import express     from 'express'
import cors        from 'cors'
import helmet      from 'helmet'
import compression from 'compression'

import { createConnection, waitForDb }   from '../../base/db/createConnection.js'
import { PROGRAMME }          from '../../base/table.js'

import { requestId }         from '../../base/middleware/requestId.js'
import { requestLogger }     from '../../base/middleware/requestLogger.js'
import { requestTimeout }    from '../../base/middleware/requestTimeout.js'
import { loadShedder }       from '../../base/middleware/loadShedder.js'
import { waf }               from '../../base/middleware/waf.js'
import { errorHandler as createErrorHandler, notFound } from '../../base/middleware/errorHandler.js'
import { createRateLimiters } from '../../base/middleware/rateLimiter.js'
import { createRequire } from 'node:module'

import { registerFeatures }    from './features/index.js'

export async function createApp() {
  const app = express()

  // ── DB connection ──────────────────────────────────────────────────────
  const connection = createConnection({
    connectionString: process.env.PROGRAMME_DATABASE_URL,
    schema: 'programme',
  })
  connection.tables = PROGRAMME

  // Wait for DB before registering routes (retries with back-off)
  await waitForDb(connection, { label: 'programme-service' })

  // ── 0. Security headers ────────────────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc:     ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: {
      maxAge:            31536000,
      includeSubDomains: true,
      preload:           true,
    },
    referrerPolicy:            { policy: 'no-referrer' },
    crossOriginEmbedderPolicy: false,
  }))

  // ── 1. Request ID ─────────────────────────────────────────────────────
  app.use(requestId())

  // ── 2. Compression ────────────────────────────────────────────────────
  app.use(compression({ threshold: 1024 }))

  // ── 3. Request timeout ────────────────────────────────────────────────
  app.use(requestTimeout(parseInt(process.env.REQUEST_TIMEOUT_MS || '30000')))

  // ── 4. Load shedder ───────────────────────────────────────────────────
  app.use(loadShedder())

  // ── 5. WAF ────────────────────────────────────────────────────────────
  app.use(waf())

  // ── 6. Rate limiters ──────────────────────────────────────
  let redisClient = null
  try {
    if (process.env.REDIS_URL) {
      const require_ = createRequire(import.meta.url)
      const Redis = require_('ioredis')
      redisClient = new Redis(process.env.REDIS_URL, {
        retryStrategy:        (times) => Math.min(times * 200, 5000),
        maxRetriesPerRequest: 1,
        enableOfflineQueue:   false,
        lazyConnect:          true,
      })
      redisClient.on('error', () => {})
    }
  } catch { /* ioredis not installed — rate limiting disabled */ }
  const rateLimiters = createRateLimiters(redisClient)
  app.use('/api/v1', (req, res, next) => {
    if (['POST','PATCH','PUT','DELETE'].includes(req.method)) {
      return rateLimiters.write(req, res, next)
    }
    next()
  })
  app.use('/api/v1', (req, res, next) => {
    if (req.method === 'GET') {
      return rateLimiters.read(req, res, next)
    }
    next()
  })

  // ── 7. Structured request logging ─────────────────────────────────────
  app.use(requestLogger())

  // ── 8. CORS ───────────────────────────────────────────────────────────
  app.use(cors({
    origin:      process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  }))

  // ── 9. Body parsing ──────────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true, limit: '1mb' }))

  // ── 10. Audit logging — TODO: wire when DB pool is available

  // ── Health checks ──────────────────────────────────────────────────────
  const healthHandler = async (_req, res) => {
    try {
      await connection.query('SELECT 1 AS ok')
      res.json({ status: 'ok', service: 'programme-service', timestamp: new Date().toISOString() })
    } catch (err) {
      res.json({ status: 'degraded', service: 'programme-service', database: err.message, timestamp: new Date().toISOString() })
    }
  }
  app.get('/health',  healthHandler)
  app.get('/healthz', healthHandler)

  // ── Feature routes ─────────────────────────────────────────────────────
  registerFeatures(app, { connection })

  // ── Fallbacks ──────────────────────────────────────────────────────────
  app.use(notFound)
  app.use(createErrorHandler())

  return app
}
