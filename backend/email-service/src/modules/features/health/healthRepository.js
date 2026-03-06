/**
 * healthRepository.js — DB queries for the health feature
 *
 * All database access for health checks and bounce recording.
 */

import { testDbConnection } from '../../../db/pool.js'
import { recordBounce } from '../../../db/repository.js'

export class HealthRepository {
  async testDb() {
    return testDbConnection()
  }

  async recordBounce(fields) {
    return recordBounce(fields)
  }
}
