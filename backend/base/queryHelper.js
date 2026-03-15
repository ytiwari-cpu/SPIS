/**
 * backend/base/queryHelper.js
 *
 * Single-use chainable SQL query builder.
 *
 * Every instance represents ONE query. Build it, call .toParam(), pass to this.runQuery().
 * Never reuse an instance across multiple queries.
 *
 * Usage:
 *
 *   // SELECT — returns rows[]
 *   const { text, values } = new QueryHelper('family')
 *     .select('*')
 *     .where('status', '=', 'active')
 *     .orderBy('created_at', 'DESC')
 *     .limit(20)
 *     .toParam()
 *   return this.runQuery(text, values, true)
 *
 *   // SELECT one row
 *   const { text, values } = new QueryHelper('family')
 *     .select('*')
 *     .where('uuid', '=', uuid)
 *     .toParam()
 *   const rows = await this.runQuery(text, values, true)
 *   return rows[0] ?? null
 *
 *   // SELECT with alias + named fields + LEFT JOIN
 *   const { text, values } = new QueryHelper('programme_rules')
 *     .select('pr')
 *     .field('pr.rule_code',  'ruleCode')
 *     .field('rm.rule_name',  'ruleName')
 *     .left_join('rule_master', 'rm', 'rm.rule_code = pr.rule_code')
 *     .where('pr.programme_id', '=', programmeId)
 *     .orderBy('pr.created_at')
 *     .toParam()
 *   return this.runQuery(text, values, true)
 *
 *   // INSERT (void write)
 *   const { text, values } = new QueryHelper('family_member')
 *     .insert({ first_name: 'John', family_id: '...' })
 *     .toParam()
 *   await this.runQuery(text, values, false)
 *
 *   // UPDATE
 *   const { text, values } = new QueryHelper('family')
 *     .update({ status: 'submitted' })
 *     .where('uuid', '=', uuid)
 *     .toParam()
 *   await this.runQuery(text, values, false)
 *
 *   // DELETE
 *   const { text, values } = new QueryHelper('family_member')
 *     .delete()
 *     .where('uuid', '=', memberId)
 *     .toParam()
 *   await this.runQuery(text, values, false)
 *
 *   // COUNT
 *   const { text, values } = new QueryHelper('family')
 *     .count()
 *     .where('status', '=', 'active')
 *     .toParam()
 *   const rows = await this.runQuery(text, values, true)
 *   return parseInt(rows[0]?.count ?? '0', 10)
 */

export class QueryHelper {
  /**
   * @param {string} tableName — the table this builder targets (e.g. 'family', 'iam.users')
   */
  constructor(tableName) {
    this._pool  = null          // legacy pool — unused in builder-only mode
    this._table = tableName

    // Initialise all query state — every instance is single-use; no reset method needed
    this._operation    = 'SELECT'
    this._columns      = '*'
    this._conditions   = []
    this._orConditions = []
    this._params       = []
    this._orderClauses = []
    this._limitVal     = null
    this._offsetVal    = null
    this._returning    = null
    this._insertData   = null
    this._updateData   = null
    this._joins        = []
    this._tableAlias   = null
    this._fields       = []
    this._groupBy      = null
    this._having       = null
    this._isCount      = false
  }

  // ─── FLUENT STARTERS ──────────────────────────────────────────

  /**
   * Set the target table. Returns a fresh builder.
   * @param {string} tableName
   * @returns {QueryHelper}
   */
  table(tableName) {
    return new QueryHelper(tableName)
  }

  /**
   * SELECT columns — or set the main table alias when called with a single identifier.
   *
   * Two calling conventions:
   *   .select('*')                      — select all columns (default)
   *   .select('f_id, name, status')     — select named columns
   *   .select('br')                     — set main table alias; columns built via .field() calls
   *
   * When called with a bare identifier (letters/digits/underscores only) it is treated as a
   * table alias: the FROM clause becomes `tableName alias` and columns are accumulated via .field().
   *
   * @param {string} columnsOrAlias
   * @returns {QueryHelper}
   */
  select(columnsOrAlias = '*') {
    this._operation = 'SELECT'
    // Bare single identifier → treat as table alias; columns will be built by .field() calls
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(columnsOrAlias)) {
      this._tableAlias = columnsOrAlias
      this._fields     = []     // accumulate via .field()
      this._columns    = null   // will be derived from _fields at build time
    } else {
      this._columns = columnsOrAlias
    }
    return this
  }

  /**
   * Add a single field to the SELECT list.
   * Must be used after .select('tableAlias') — incompatible with .select('col1, col2').
   *
   * @param {string} expression — e.g. 'br.Frequency', 'COUNT(*)', 'row_to_json(pm.*)'
   * @param {string} [alias]    — e.g. 'businessRuleFrequency'
   * @returns {QueryHelper}
   */
  field(expression, alias) {
    const fieldStr = alias ? `${expression} AS ${alias}` : expression
    this._fields.push(fieldStr)
    this._columns = null   // will be derived from _fields at build time
    return this
  }

  /**
   * SELECT COUNT(*)
   * @param {string} [column='*']
   * @returns {QueryHelper}
   */
  count(column = '*') {
    this._operation = 'SELECT'
    this._columns   = `COUNT(${column})`
    this._isCount   = true
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
   * @param {string} operator — '=', '!=', '>', '<', '>=', '<=',
   *   'IN', 'NOT IN', 'LIKE', 'ILIKE', 'IS', 'IS NOT', 'BETWEEN'
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
   * INNER JOIN — supports both 2-arg and 3-arg forms:
   *
   *   2-arg: .join('other_table',        'other_table.id = main.other_id')
   *   3-arg: .join('other_table', 'ot',  'ot.id = br.other_id')
   *            └─ table name      └─ alias  └─ ON condition
   *
   * @param {string} table       — e.g. 'family_member'
   * @param {string} aliasOrOn   — table alias (3-arg) or ON condition (2-arg)
   * @param {string} [on]        — ON condition (3-arg only)
   * @returns {QueryHelper}
   */
  join(table, aliasOrOn, on) {
    if (on !== undefined) {
      this._joins.push({ type: 'INNER JOIN', table: `${table} ${aliasOrOn}`, on })
    } else {
      this._joins.push({ type: 'INNER JOIN', table, on: aliasOrOn })
    }
    return this
  }

  /**
   * LEFT JOIN — supports both 2-arg and 3-arg forms (same signature as join()).
   *
   *   2-arg: .left_join('other_table',        'other_table.id = main.other_id')
   *   3-arg: .left_join('other_table', 'ot',  'ot.id = br.other_id')
   *
   * @param {string} table
   * @param {string} aliasOrOn
   * @param {string} [on]
   * @returns {QueryHelper}
   */
  left_join(table, aliasOrOn, on) {
    if (on !== undefined) {
      this._joins.push({ type: 'LEFT JOIN', table: `${table} ${aliasOrOn}`, on })
    } else {
      this._joins.push({ type: 'LEFT JOIN', table, on: aliasOrOn })
    }
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
    const col = typeof column === 'string' ? column.replace(/[^a-zA-Z0-9_.]/g, '') : null
    if (!col) {
      throw new Error(`QueryHelper.orderBy: invalid column name "${column}"`)
    }
    const dir = String(direction).toUpperCase() === 'ASC' ? 'ASC' : 'DESC'
    this._orderClauses.push(`${col} ${dir}`)
    return this
  }

  /**
   * ORDER BY with a raw expression (e.g. CASE WHEN ...).
   * Unlike orderBy(), this does NOT sanitize the expression — use only for
   * known-safe, hard-coded ordering expressions.
   *
   * @param {string} expression — verbatim SQL expression
   * @returns {QueryHelper}
   */
  orderByExpr(expression) {
    this._orderClauses.push(expression)
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
    const safe = columns.split(',').map(c => {
      const s = c.trim().replace(/[^a-zA-Z0-9_.]/g, '')
      return s || null
    }).filter(Boolean).join(', ')
    if (!safe) {
      throw new Error(`QueryHelper.groupBy: invalid column(s) "${columns}"`)
    }
    this._groupBy = safe
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

  // ─── BUILD / FINALIZE ─────────────────────────────────────────

  /**
   * Finalize and return `{ sql, params }`.
   * @returns {{ sql: string, params: unknown[] }}
   */
  build() {
    if (!this._table) {
      throw new Error('QueryHelper: table name is required')
    }

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
      default: throw new Error(`QueryHelper: unsupported operation "${this._operation}"`)
    }

    return { sql, params: this._params }
  }

  /**
   * Finalize and return `{ text, values }` — pg-style property names.
   * This is the primary method used before calling `this.runQuery(text, values, bool)`.
   *
   * @returns {{ text: string, values: unknown[] }}
   */
  toParam() {
    const { sql, params } = this.build()
    return { text: sql, values: params }
  }

  // ─── PRIVATE BUILDERS ─────────────────────────────────────────

  _buildSelect() {
    const columns  = (this._fields.length > 0)
      ? this._fields.join(', ')
      : (this._columns ?? '*')
    const tableRef = this._tableAlias ? `${this._table} ${this._tableAlias}` : this._table
    let sql = `SELECT ${columns} FROM ${tableRef}`
    sql += this._buildJoins()
    sql += this._buildWhere()
    if (this._groupBy)              {
      sql += ` GROUP BY ${this._groupBy}`
    }
    if (this._having)               {
      sql += ` HAVING ${this._having}`
    }
    if (this._orderClauses.length)  {
      sql += ` ORDER BY ${this._orderClauses.join(', ')}`
    }
    if (this._limitVal  !== null)   {
      sql += ` LIMIT ${this._limitVal}`
    }
    if (this._offsetVal !== null)   {
      sql += ` OFFSET ${this._offsetVal}`
    }
    return sql
  }

  _buildInsert() {
    if (!this._insertData || typeof this._insertData !== 'object') {
      throw new Error('QueryHelper: insert() requires a data object')
    }
    const keys         = Object.keys(this._insertData)
    const values       = Object.values(this._insertData)
    const placeholders = keys.map((_, i) => `$${this._params.length + i + 1}`)
    this._params.push(...values)
    let sql = `INSERT INTO ${this._table} (${keys.join(', ')}) VALUES (${placeholders.join(', ')})`
    if (this._returning) {
      sql += ` RETURNING ${this._returning}`
    }
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
    if (this._returning) {
      sql += ` RETURNING ${this._returning}`
    }
    return sql
  }

  _buildDelete() {
    let sql = `DELETE FROM ${this._table}`
    sql += this._buildWhere()
    if (this._returning) {
      sql += ` RETURNING ${this._returning}`
    }
    return sql
  }

  _buildJoins() {
    if (this._joins.length === 0) {
      return ''
    }
    return ` ${  this._joins.map(j => `${j.type} ${j.table} ON ${j.on}`).join(' ')}`
  }

  _buildWhere() {
    if (this._conditions.length === 0) {
      return ''
    }

    const clauses = []
    for (const cond of this._conditions) {
      const { column, operator, value, conjunction } = cond
      let clause = ''

      if (operator === 'IS' || operator === 'IS NOT') {
        clause = `${column} ${operator} NULL`
      } else if (operator === 'IN' || operator === 'NOT IN') {
        if (!Array.isArray(value) || value.length === 0) {
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
}

// ─── STANDALONE UTILITIES ─────────────────────────────────────

/**
 * Strip everything except letters, digits, underscores, and dots from a SQL identifier.
 * Returns `null` if the result is empty.
 *
 * @param {string} raw
 * @returns {string|null}
 */
export function sanitizeIdentifier(raw) {
  if (typeof raw !== 'string') {
    return null
  }
  const cleaned = raw.replace(/[^a-zA-Z0-9_.]/g, '')
  return cleaned.length > 0 ? cleaned : null
}
