/**
 * HealthController — handles /healthz and /readyz routes
 */

import { BaseController } from '../../../../base/baseController.js'
import { testDbConnection } from '../../db/pool.js'
import { testRedisConnection } from '../../lib/redis.js'

export class HealthController extends BaseController {
  constructor(context) {
    super(context)
  }

  /** GET /healthz — liveness */
  async liveness() {
    await this.respondOk({ status: 'ok', service: 'iam-service', timestamp: new Date().toISOString() })
  }

  /** GET /readyz — readiness (DB + Redis) */
  async readiness() {
    const [dbOk, redisOk] = await Promise.all([
      testDbConnection(),
      testRedisConnection(),
    ])

    const ready = dbOk && redisOk
    const status = ready ? 'ready' : 'degraded'
    const httpStatus = ready ? 200 : 503

    this.respondJson({
      status,
      checks: {
        database: dbOk ? 'ok' : 'fail',
        redis:    redisOk ? 'ok' : 'fail',
      },
      timestamp: new Date().toISOString(),
    }, httpStatus)
  }
}
