/**
 * IAM — Health Service
 *
 * Checks DB and Redis connectivity for readiness probes.
 */

import { BaseService } from '../../../../base/baseService.js'
import { testRedisConnection } from '../../lib/redis.js'
import { HealthRepository } from './healthRepository.js'

export class HealthService extends BaseService {
  /**
   * @param {import('../../../../base/apiContext.js').ApiContext} context
   */
  constructor(context) {
    super(context)
    this.healthRepository = new HealthRepository(context)
  }

  /** Liveness — always ok if the process is running */
  liveness() {
    return {
      status:    'ok',
      service:   'iam-service',
      timestamp: new Date().toISOString(),
    }
  }

  /** Readiness — DB + Redis both must be up */
  async readiness() {
    const [dbOk, redisOk] = await Promise.all([
      this.healthRepository.testConnection(),
      testRedisConnection(),
    ])

    const ready  = dbOk && redisOk
    const status = ready ? 'ready' : 'degraded'

    return {
      ready,
      status,
      checks: {
        database: dbOk   ? 'ok' : 'fail',
        redis:    redisOk ? 'ok' : 'fail',
      },
      timestamp: new Date().toISOString(),
    }
  }
}
