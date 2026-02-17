/**
 * SPIS IAM Service — Health Routes
 *
 * GET /healthz  — liveness probe
 * GET /readyz   — readiness probe (DB, Redis, Keycloak)
 */

import { Router, type Request, type Response } from 'express'
import { testDbConnection } from '../db/pool.js'
import { testRedisConnection } from '../lib/redis.js'

export const healthRouter = Router()

// GET /healthz — liveness
healthRouter.get('/healthz', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', service: 'iam-service', timestamp: new Date().toISOString() })
})

// GET /readyz — readiness
healthRouter.get('/readyz', async (_req: Request, res: Response) => {
  const [dbOk, redisOk] = await Promise.all([
    testDbConnection(),
    testRedisConnection(),
  ])

  const ready = dbOk && redisOk
  const status = ready ? 'ready' : 'degraded'
  const httpStatus = ready ? 200 : 503

  res.status(httpStatus).json({
    status,
    checks: {
      database: dbOk ? 'ok' : 'fail',
      redis: redisOk ? 'ok' : 'fail',
    },
    timestamp: new Date().toISOString(),
  })
})
