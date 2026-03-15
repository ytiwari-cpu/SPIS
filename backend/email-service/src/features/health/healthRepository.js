/**
 * healthRepository.js — DB queries for the health feature
 */

import { BaseRepository }   from '../../../../base/baseRepository.js'
import { QueryHelper }      from '../../../../base/queryHelper.js'
import { testDbConnection } from '../../db/pool.js'

export class HealthRepository extends BaseRepository {
  constructor(context) {
    super(context)
  }

  async testDb() {
    return await testDbConnection()
  }

  async recordBounce(fields) {
    const { text, values } = new QueryHelper(this.tables.BOUNCE_FEEDBACK).insert(fields).toParam()
    return await this.runQuery(text, values, false)
  }
}
