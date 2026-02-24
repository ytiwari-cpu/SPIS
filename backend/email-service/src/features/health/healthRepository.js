/**
 * HealthRepository — DB queries for the health feature
 */

import { testDbConnection } from '../../db/pool.js'
import { recordBounce } from '../../db/repository.js'

export class HealthRepository {
  async testDb() {
    return testDbConnection()
  }

  async recordBounce(fields) {
    return recordBounce(fields)
  }
}
