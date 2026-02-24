import { ApiContext } from './apiContext.js'

/**
 * BaseDbRepository
 *
 * Base repository for services that use a pg Pool (iam-service, email-service).
 * Accepts the pg Pool as a constructor argument so each service can inject
 * its own pool without path coupling.
 */
export class BaseDbRepository {
  /**
   * @param {ApiContext} context
   * @param {import('pg').Pool} pool  — pg pool instance
   */
  constructor(context, pool) {
    if (!context || !(context instanceof ApiContext)) {
      throw new Error('BaseDbRepository requires an ApiContext instance')
    }
    this.context = context
    this.log     = context.logger
    this.pool    = pool
  }

  /**
   * Run a query and return all rows.
   * @param {string} sql
   * @param {unknown[]} [params]
   * @returns {Promise<object[]>}
   */
  async query(sql, params = []) {
    const result = await this.pool.query(sql, params)
    return result.rows
  }

  /**
   * Run a query and return the first row, or null.
   * @param {string} sql
   * @param {unknown[]} [params]
   * @returns {Promise<object|null>}
   */
  async queryOne(sql, params = []) {
    const result = await this.pool.query(sql, params)
    return result.rows[0] ?? null
  }

  /**
   * Run a DML statement and return the affected row count.
   * @param {string} sql
   * @param {unknown[]} [params]
   * @returns {Promise<number>}
   */
  async execute(sql, params = []) {
    const result = await this.pool.query(sql, params)
    return result.rowCount
  }
}
