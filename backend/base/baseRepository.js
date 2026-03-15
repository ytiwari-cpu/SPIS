// base/baseRepository.js
import { createLogger } from './logger.js'

/**
 * BaseRepository — single base class for ALL repository classes across all SPIS services.
 *
 * Provides:
 * - `this.connection`      — pg-compatible `{ query(sql, params) → { rows, rowCount } }`
 * - `this.tables`          — table constants from `context.connection.tables`
 * - `this.logger`          — structured logger named after the subclass
 * - `this.runQuery(sql, params, handleResult)` — the ONLY execution primitive
 *   - `handleResult = true`  → returns `rows[]`  (SELECT)
 *   - `handleResult = false` → returns `rowCount` (INSERT / UPDATE / DELETE)
 * - `this.transaction(callback)` — BEGIN / COMMIT / ROLLBACK wrapper
 *
 * Usage pattern in every repository method:
 *
 *   // SELECT — use this.tables for table name
 *   const { text, values } = new QueryHelper(this.tables.USERS).select('*').where(...).toParam()
 *   return this.runQuery(text, values, true)
 *
 *   // INSERT / UPDATE / DELETE (void)
 *   const { text, values } = new QueryHelper(this.tables.USERS).insert(fields).toParam()
 *   await this.runQuery(text, values, false)
 *
 *   // Complex query — raw SQL passed directly
 *   const rows = await this.runQuery(
 *     `SELECT ... FROM ... WHERE id = $1`,
 *     [id],
 *     true,
 *   )
 */
export class BaseRepository {
  /**
   * @param {object} context — ApiContext instance (carries `connection`, `user`, `requestId`, etc.)
   */
  constructor(context) {
    this.context    = context
    this.connection = context.connection
    this.tables     = context.connection.tables
    this.logger     = createLogger(this.constructor.name)
  }

  // ─── Core execution primitive ─────────────────────────────────────────────

  /**
   * Execute a parameterised SQL query.
   *
   * Call `.toParam()` on a QueryHelper first to get `{ text, values }`, then pass here:
   *   const { text, values } = new QueryHelper(this.tables.TABLE).select('*').where(...).toParam()
   *   return this.runQuery(text, values, true)
   *
   * For complex queries that cannot use the builder, pass raw SQL directly:
   *   return this.runQuery(`SELECT ... WHERE id = $1`, [id], true)
   *
   * @param {string}    sql                  — Parameterised SQL string
   * @param {unknown[]} [params=[]]          — Bound parameter values ($1, $2, …)
   * @param {boolean}   [handleResult=true]  — true → rows[], false → rowCount
   * @returns {Promise<object[]|number>}
   */
  async runQuery(sql, params = [], handleResult = true) {
    const result = await this.connection.query(sql, params)
    const rowCount = result.rowCount ?? result.rows.length
    this.logger.debug('runQuery', { sql: sql.substring(0, 200), params, rowCount })
    return handleResult ? result.rows : rowCount
  }

  // ─── Transaction helper ───────────────────────────────────────────────────

  async transaction(callback) {
    await this.connection.query('BEGIN')
    try {
      const result = await callback()
      await this.connection.query('COMMIT')
      return result
    } catch (err) {
      await this.connection.query('ROLLBACK')
      throw err
    }
  }
}
