/**
 * backend/base/queryHelper.js
 *
 * Chainable SQL query builder for pg Pool.
 *
 * Provides a fluent API to build SELECT, INSERT, UPDATE, DELETE queries
 * without raw SQL strings scattered through repositories.
 *
 * Usage:
 *   import { QueryHelper } from '../../../../base/queryHelper.js'
 *
 *   const qh = new QueryHelper(pool)
 *
 *   // SELECT with filters, pagination, ordering
 *   const families = await qh
 *     .table('family.family')
 *     .select('family_id, family_name, status')
 *     .where('status', '=', 'Active')
 *     .where('parish', '=', 'Kingston')
 *     .orderBy('created_at', 'DESC')
 *     .limit(20)
 *     .offset(0)
 *     .execute()
 *
 *   // SELECT ONE
 *   const family = await qh
 *     .table('family.family')
 *     .select('*')
 *     .where('family_id', '=', familyId)
 *     .executeOne()
 *
 *   // INSERT
 *   const newRow = await qh
 *     .table('family.family_member')
 *     .insert({ first_name: 'John', last_name: 'Doe', family_id: '...' })
 *     .returning('*')
 *     .executeOne()
 *
 *   // UPDATE
 *   const updated = await qh
 *     .table('family.family')
 *     .update({ status: 'Submitted' })
 *     .where('family_id', '=', familyId)
 *     .returning('*')
 *     .executeOne()
 *
 *   // DELETE
 *   const count = await qh
 *     .table('family.family_member')
 *     .delete()
 *     .where('member_id', '=', memberId)
 *     .executeCount()
 *
 *   // COUNT
 *   const total = await qh
 *     .table('family.family')
 *     .count()
 *     .where('status', '=', 'Active')
 *     .executeValue()
 *
 *   // Pagination helper
 *   const page = await qh
 *     .table('family.family')
 *     .select('*')
 *     .where('status', '=', 'Active')
 *     .paginate({ page: 1, pageSize: 20 })
 *   // → { data: [...], total: 42, page: 1, pageSize: 20, totalPages: 3 }
 */

export class QueryHelper {
  /**
   * @param {import('pg').Pool} pool
   */
  constructor(pool) {
    this._pool       = pool
    this._table      = null
    this._operation  = 'SELECT'  // SELECT | INSERT | UPDATE | DELETE
    this._columns    = '*'
    this._conditions = []        // { column, operator, value, conjunction }
    this._orConditions = []
    this._params     = []
    this._orderClauses = []
    this._limitVal   = null
    this._offsetVal  = null
    this._returning  = null
    this._insertData = null
    this._updateData = null
    this._joins      = []
    this._groupBy    = null
    this._having     = null
    this._isCount    = false
    this._raw        = null      // raw SQL override
  }

  // ─── FLUENT STARTERS ──────────────────────────────────────────

  /**
   * Set the target table. Returns a fresh builder (to support reuse of the pool).
   * @param {string} tableName — e.g. 'family.family', 'iam.users', 'public.audit_logs'
   * @returns {QueryHelper}
   */
  table(tableName) {
    const qh = new QueryHelper(this._pool)
    qh._table = tableName
    return qh
  }

  /**
   * SELECT columns
   * @param {string} columns — e.g. '*', 'id, name', 'family_id AS fid'
   * @returns {QueryHelper}
   */
  select(columns = '*') {
    this._operation = 'SELECT'
    this._columns = columns
    return this
  }

  /**
   * SELECT COUNT(*)
   * @param {string} [column='*']
   * @returns {QueryHelper}
   */
  count(column = '*') {
    this._operation = 'SELECT'
    this._columns = `COUNT(${column})`
    this._isCount = true
    return this
  }

  /**
   * INSERT data
   * @param {Record<string, unknown>} data — key-value pairs
   * @returns {QueryHelper}
   */
  insert(data) {
    this._operation  = 'INSERT'
    this._insertData = data
    return this
  }

  /**
   * UPDATE data
   * @param {Record<string, unknown>} data — key-value pairs to set
   * @returns {QueryHelper}
   */
  update(data) {
    this._operation  = 'UPDATE'
    this._updateData = data
    return this
  }

  /**
   * DELETE
   * @returns {QueryHelper}
   */
  delete() {
    this._operation = 'DELETE'
    return this
  }

  // ─── WHERE CLAUSES ────────────────────────────────────────────

  /**
   * Add a WHERE condition (AND).
   * @param {string} column
   * @param {string} operator — '=', '!=', '>', '<', '>=', '<=', 'IN', 'NOT IN', 'LIKE', 'ILIKE', 'IS', 'IS NOT', 'BETWEEN'
   * @param {unknown} value
   * @returns {QueryHelper}
   */
  where(column, operator, value) {
    this._conditions.push({ column, operator: operator.toUpperCase(), value, conjunction: 'AND' })
    return this
  }

  /**
   * Add a WHERE condition (OR).
   * @param {string} column
   * @param {string} operator
   * @param {unknown} value
   * @returns {QueryHelper}
   */
  orWhere(column, operator, value) {
    this._conditions.push({ column, operator: operator.toUpperCase(), value, conjunction: 'OR' })
    return this
  }

  /**
   * WHERE column IS NULL
   * @param {string} column
   * @returns {QueryHelper}
   */
  whereNull(column) {
    this._conditions.push({ column, operator: 'IS', value: null, conjunction: 'AND' })
    return this
  }

  /**
   * WHERE column IS NOT NULL
   * @param {string} column
   * @returns {QueryHelper}
   */
  whereNotNull(column) {
    this._conditions.push({ column, operator: 'IS NOT', value: null, conjunction: 'AND' })
    return this
  }

  /**
   * WHERE column IN (values)
   * @param {string} column
   * @param {unknown[]} values
   * @returns {QueryHelper}
   */
  whereIn(column, values) {
    this._conditions.push({ column, operator: 'IN', value: values, conjunction: 'AND' })
    return this
  }

  /**
   * WHERE column BETWEEN low AND high
   * @param {string} column
   * @param {unknown} low
   * @param {unknown} high
   * @returns {QueryHelper}
   */
  whereBetween(column, low, high) {
    this._conditions.push({ column, operator: 'BETWEEN', value: [low, high], conjunction: 'AND' })
    return this
  }

  // ─── JOINS ────────────────────────────────────────────────────

  /**
   * INNER JOIN
   * @param {string} table
   * @param {string} on — e.g. 'family.family_id = family_member.family_id'
   * @returns {QueryHelper}
   */
  join(table, on) {
    this._joins.push({ type: 'INNER JOIN', table, on })
    return this
  }

  /**
   * LEFT JOIN
   * @param {string} table
   * @param {string} on
   * @returns {QueryHelper}
   */
  leftJoin(table, on) {
    this._joins.push({ type: 'LEFT JOIN', table, on })
    return this
  }

  // ─── ORDERING / PAGINATION ────────────────────────────────────

  /**
   * ORDER BY clause
   * @param {string} column
   * @param {'ASC'|'DESC'} [direction='ASC']
   * @returns {QueryHelper}
   */
  orderBy(column, direction = 'ASC') {
    this._orderClauses.push(`${column} ${direction.toUpperCase()}`)
    return this
  }

  /**
   * LIMIT
   * @param {number} n
   * @returns {QueryHelper}
   */
  limit(n) {
    this._limitVal = n
    return this
  }

  /**
   * OFFSET
   * @param {number} n
   * @returns {QueryHelper}
   */
  offset(n) {
    this._offsetVal = n
    return this
  }

  /**
   * GROUP BY clause
   * @param {string} columns — e.g. 'status' or 'parish, status'
   * @returns {QueryHelper}
   */
  groupBy(columns) {
    this._groupBy = columns
    return this
  }

  /**
   * HAVING clause (used with GROUP BY)
   * @param {string} raw — e.g. 'COUNT(*) > 5'
   * @returns {QueryHelper}
   */
  having(raw) {
    this._having = raw
    return this
  }

  /**
   * RETURNING clause (for INSERT/UPDATE/DELETE)
   * @param {string} columns — e.g. '*', 'id', 'id, name'
   * @returns {QueryHelper}
   */
  returning(columns = '*') {
    this._returning = columns
    return this
  }

  // ─── RAW SQL ──────────────────────────────────────────────────

  /**
   * Execute a raw SQL query.
   * @param {string} sql
   * @param {unknown[]} [params]
   * @returns {QueryHelper}
   */
  raw(sql, params = []) {
    this._raw = { sql, params }
    return this
  }

  // ─── BUILD ────────────────────────────────────────────────────

  /**
   * Build the SQL string and params array.
   * @returns {{ sql: string, params: unknown[] }}
   */
  build() {
    // Raw SQL override
    if (this._raw) {
      return { sql: this._raw.sql, params: this._raw.params }
    }

    if (!this._table) throw new Error('QueryHelper: table() must be called before build()')

    this._params = []
    let sql = ''

    switch (this._operation) {
      case 'SELECT':
        sql = this._buildSelect()
        break
      case 'INSERT':
        sql = this._buildInsert()
        break
      case 'UPDATE':
        sql = this._buildUpdate()
        break
      case 'DELETE':
        sql = this._buildDelete()
        break
      default:
        throw new Error(`QueryHelper: unsupported operation "${this._operation}"`)
    }

    return { sql, params: this._params }
  }

  _buildSelect() {
    let sql = `SELECT ${this._columns} FROM ${this._table}`
    sql += this._buildJoins()
    sql += this._buildWhere()
    if (this._groupBy) sql += ` GROUP BY ${this._groupBy}`
    if (this._having)  sql += ` HAVING ${this._having}`
    if (this._orderClauses.length > 0) sql += ` ORDER BY ${this._orderClauses.join(', ')}`
    if (this._limitVal  !== null) sql += ` LIMIT ${this._limitVal}`
    if (this._offsetVal !== null) sql += ` OFFSET ${this._offsetVal}`
    return sql
  }

  _buildInsert() {
    if (!this._insertData || typeof this._insertData !== 'object') {
      throw new Error('QueryHelper: insert() requires a data object')
    }

    const keys   = Object.keys(this._insertData)
    const values  = Object.values(this._insertData)
    const placeholders = keys.map((_, i) => `$${this._params.length + i + 1}`)

    this._params.push(...values)

    let sql = `INSERT INTO ${this._table} (${keys.join(', ')}) VALUES (${placeholders.join(', ')})`
    if (this._returning) sql += ` RETURNING ${this._returning}`
    return sql
  }

  _buildUpdate() {
    if (!this._updateData || typeof this._updateData !== 'object') {
      throw new Error('QueryHelper: update() requires a data object')
    }

    const setClauses = []
    for (const [key, val] of Object.entries(this._updateData)) {
      this._params.push(val)
      setClauses.push(`${key} = $${this._params.length}`)
    }

    let sql = `UPDATE ${this._table} SET ${setClauses.join(', ')}`
    sql += this._buildWhere()
    if (this._returning) sql += ` RETURNING ${this._returning}`
    return sql
  }

  _buildDelete() {
    let sql = `DELETE FROM ${this._table}`
    sql += this._buildWhere()
    if (this._returning) sql += ` RETURNING ${this._returning}`
    return sql
  }

  _buildJoins() {
    if (this._joins.length === 0) return ''
    return ' ' + this._joins.map(j => `${j.type} ${j.table} ON ${j.on}`).join(' ')
  }

  _buildWhere() {
    if (this._conditions.length === 0) return ''

    const clauses = []
    for (const cond of this._conditions) {
      const { column, operator, value, conjunction } = cond

      let clause = ''

      if (operator === 'IS' || operator === 'IS NOT') {
        clause = `${column} ${operator} NULL`
      } else if (operator === 'IN' || operator === 'NOT IN') {
        if (!Array.isArray(value) || value.length === 0) {
          // Empty IN → always false; empty NOT IN → always true
          clause = operator === 'IN' ? 'FALSE' : 'TRUE'
        } else {
          const placeholders = value.map(v => {
            this._params.push(v)
            return `$${this._params.length}`
          })
          clause = `${column} ${operator} (${placeholders.join(', ')})`
        }
      } else if (operator === 'BETWEEN') {
        if (!Array.isArray(value) || value.length !== 2) {
          throw new Error('QueryHelper: BETWEEN requires [low, high] array')
        }
        this._params.push(value[0])
        const p1 = `$${this._params.length}`
        this._params.push(value[1])
        const p2 = `$${this._params.length}`
        clause = `${column} BETWEEN ${p1} AND ${p2}`
      } else {
        this._params.push(value)
        clause = `${column} ${operator} $${this._params.length}`
      }

      clauses.push({ clause, conjunction })
    }

    // Build WHERE string
    let whereStr = ' WHERE '
    for (let i = 0; i < clauses.length; i++) {
      if (i === 0) {
        whereStr += clauses[i].clause
      } else {
        whereStr += ` ${clauses[i].conjunction} ${clauses[i].clause}`
      }
    }

    return whereStr
  }

  // ─── EXECUTORS ────────────────────────────────────────────────

  /**
   * Execute and return all rows.
   * @returns {Promise<object[]>}
   */
  async execute() {
    const { sql, params } = this.build()
    const result = await this._pool.query(sql, params)
    return result.rows
  }

  /**
   * Execute and return the first row, or null.
   * @returns {Promise<object|null>}
   */
  async executeOne() {
    const { sql, params } = this.build()
    const result = await this._pool.query(sql, params)
    return result.rows[0] ?? null
  }

  /**
   * Execute and return the scalar value of the first column of the first row.
   * Useful for COUNT(*), SUM(), MAX(), etc.
   * @returns {Promise<unknown>}
   */
  async executeValue() {
    const { sql, params } = this.build()
    const result = await this._pool.query(sql, params)
    const row = result.rows[0]
    if (!row) return null
    return Object.values(row)[0]
  }

  /**
   * Execute and return the affected row count (for INSERT/UPDATE/DELETE).
   * @returns {Promise<number>}
   */
  async executeCount() {
    const { sql, params } = this.build()
    const result = await this._pool.query(sql, params)
    return result.rowCount
  }

  /**
   * Execute a paginated SELECT query.
   * Returns data rows + total count + pagination metadata.
   *
   * @param {{ page?: number, pageSize?: number }} opts
   * @returns {Promise<{ data: object[], total: number, page: number, pageSize: number, totalPages: number }>}
   */
  async paginate({ page = 1, pageSize = 20 } = {}) {
    const safePage     = Math.max(1, Math.floor(page))
    const safePageSize = Math.max(1, Math.min(200, Math.floor(pageSize)))
    const offset       = (safePage - 1) * safePageSize

    // Clone conditions for the count query
    const countQh = new QueryHelper(this._pool)
    countQh._table      = this._table
    countQh._conditions = [...this._conditions]
    countQh._joins      = [...this._joins]
    countQh._groupBy    = this._groupBy
    countQh._having     = this._having
    countQh._operation  = 'SELECT'
    countQh._columns    = 'COUNT(*)'
    countQh._isCount    = true

    // Data query
    this._limitVal  = safePageSize
    this._offsetVal = offset

    const [data, totalResult] = await Promise.all([
      this.execute(),
      countQh.executeValue(),
    ])

    const total      = parseInt(String(totalResult), 10) || 0
    const totalPages = Math.ceil(total / safePageSize)

    return { data, total, page: safePage, pageSize: safePageSize, totalPages }
  }

  // ─── TRANSACTION SUPPORT ──────────────────────────────────────

  /**
   * Run a callback inside a database transaction.
   *
   * @param {(qh: QueryHelper) => Promise<T>} callback
   * @returns {Promise<T>}
   * @template T
   */
  async transaction(callback) {
    const client = await this._pool.connect()
    try {
      await client.query('BEGIN')

      // Create a QueryHelper backed by the transaction client
      const txPool = { query: (sql, params) => client.query(sql, params) }
      const txQh   = new QueryHelper(txPool)

      const result = await callback(txQh)
      await client.query('COMMIT')
      return result
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }
}
