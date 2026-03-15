/**
 * api.js — iam-service Express app factory
 *
 * Configures middleware and mounts all route handlers.
 * index.ts handles server startup (listen, bus connection, etc.)
 */

import express     from 'express'
import cors        from 'cors'
import helmet      from 'helmet'
import compression from 'compression'
import { config }       from './config.js'
import { redis }        from './lib/redis.js'
import { pool }         from './db/pool.js'
import { createConnection, waitForDb } from '../../base/db/createConnection.js'
import { IAM }              from '../../base/table.js'

import { requestId }         from '../../base/middleware/requestId.js'
import { requestLogger }     from '../../base/middleware/requestLogger.js'
import { requestTimeout }    from '../../base/middleware/requestTimeout.js'
import { loadShedder }       from '../../base/middleware/loadShedder.js'
import { waf }               from '../../base/middleware/waf.js'
import { createRateLimiters } from '../../base/middleware/rateLimiter.js'
import { auditMiddleware }   from './middleware/auditLog.js'
import { errorHandler as createErrorHandler, notFound } from '../../base/middleware/errorHandler.js'

import { registerFeatures } from './features/index.js'

export async function createApp() {
  const app = express()

  // ── DB connection ──────────────────────────────────────────────────────
  const connection = createConnection({
    connectionString: process.env.IAM_DATABASE_URL || process.env.DATABASE_URL,
  })
  connection.tables = IAM

  // Wait for DB before registering routes (retries with back-off)
  await waitForDb(connection, { label: 'iam-service' })

  const rateLimiters = createRateLimiters(redis)

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

  // ── 1. Request ID ──────────────────────────────────────────────────────
  app.use(requestId())

  // ── 2. Compression ────────────────────────────────────────────────────
  app.use(compression({ threshold: 1024 }))

  // ── 3. Request timeout ────────────────────────────────────────────────
  app.use(requestTimeout(parseInt(process.env.REQUEST_TIMEOUT_MS || '30000')))

  // ── 4. Load shedder ───────────────────────────────────────────────────
  app.use(loadShedder())

  // ── 5. WAF ────────────────────────────────────────────────────────────
  app.use(waf())

  // ── 6. Rate limiters ──────────────────────────────────────────────────
  app.use('/api/v1/auth', rateLimiters.loginAttempt)
  app.use('/api/v1', (req, res, next) => {
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
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
  app.use(cors({ origin: config.corsOrigin, credentials: true }))

  // ── 9. Body parsing ──────────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true, limit: '1mb' }))

  // ── 10. Audit logging ─────────────────────────────────────────────────
  app.use(auditMiddleware({ pool, excludePaths: ['/health', '/healthz'] }))

  // ── Feature routes (4-layer: api → controller → service → repository) ─
  registerFeatures(app, { connection, redisClient: redis })

  // ── Error handling (centralized) ───────────────────────────────────────
  app.use(notFound)
  app.use(createErrorHandler())

  return app
}
