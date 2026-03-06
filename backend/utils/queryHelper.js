/**
 * backend/utils/queryHelper.js
 *
 * Centralized SQL query builder for all SPIS backend services.
 *
 * Provides a squel-compatible fluent API:
 *   - select() / insert() / update() / remove()
 *   - from() / into() / table()
 *   - field() / fields() / set() / setFields()
 *   - where() / join() / left_join() / order() / offset() / limit() / top()
 *   - returning()
 *   - build().toParam() → { text: string, values: unknown[] }
 *   - build().toString() → string (for debugging only)
 *
 * Also re-exports the existing QueryHelper class from base/ for backward compatibility.
 *
 * Usage:
 *   import { squel, QueryHelper } from '../../utils/queryHelper.js'
 *
 *   // squel-style API
 *   const q = squel.select()
 *     .from('family')
 *     .field('family_id')
 *     .field('family_name')
 *     .where('status = ?', 'Active')
 *     .order('created_at', false)
 *     .limit(20)
 *     .offset(0)
 *
 *   const { text, values } = q.build().toParam()
 *   // text:   'SELECT family_id, family_name FROM family WHERE status = $1 ORDER BY created_at DESC LIMIT 20 OFFSET 0'
 *   // values: ['Active']
 *
 *   // Or use the existing QueryHelper (pool-bound, auto-executes):
 *   const qh = new QueryHelper(pool)
 *   const rows = await qh.table('family').select('*').where('status', '=', 'Active').execute()
 */

// Re-export the existing pool-bound QueryHelper for backward compatibility
export { QueryHelper } from '../base/queryHelper.js'

// ═══════════════════════════════════════════════════════════════
// SQUEL-LIKE BUILDER
// ═══════════════════════════════════════════════════════════════

/**
 * Quote a SQL identifier (table/column name) to prevent injection.
 * @param {string} name
 * @returns {string}
 */
export function quoteIdentifier(name) {
  if (!name || typeof name !== 'string') return '""'
  // Don't re-quote already quoted or schema-qualified identifiers
  if (name.includes('"') || name.includes('(') || name === '*') return name
  // Handle schema.table or table.column
  if (name.includes('.')) {
    return name.split('.').map(p => p === '*' ? '*' : `"${p.replace(/"/g, '""')}"`).join('.')
  }
  return `"${name.replace(/"/g, '""')}"`
}

/**
 * Escape a string value for SQL (single-quote escaping).
 * @param {string} val
 * @returns {string}
 */
export function escapeValue(val) {
  if (val === null || val === undefined) return 'NULL'
  if (typeof val === 'number' || typeof val === 'boolean') return String(val)
  return `'${String(val).replace(/'/g, "''")}'`
}

// ─── Base query class ────────────────────────────────────────

class BaseQuery {
  constructor() {
    this._wheres = []      // { expr: string, values: unknown[] }
    this._whereValues = []
  }

  /**
   * Add a WHERE clause. Use ? as placeholder for parameterized values.
   * @param {string} expr — e.g. 'status = ?', 'id IN (?, ?)', 'name IS NOT NULL'
   * @param {...unknown} values — values to bind to ? placeholders
   * @returns {this}
   */
  where(expr, ...values) {
    this._wheres.push({ expr, values })
    return this
  }

  /**
   * Build the final query.
   * @returns {{ toString: () => string, toParam: () => { text: string, values: unknown[] } }}
   */
  build() {
    const { text, values } = this._buildInternal()
    return {
      toString: () => this._inlineParams(text, values),
      toParam:  () => ({ text, values }),
    }
  }

  /**
   * Internal build — subclasses override.
   * @returns {{ text: string, values: unknown[] }}
   */
  _buildInternal() {
    throw new Error('_buildInternal must be overridden')
  }

  /**
   * Build WHERE clause with $N parameterized placeholders.
   * @param {number} startIdx — starting parameter index
   * @returns {{ clause: string, values: unknown[], nextIdx: number }}
   */
  _buildWhere(startIdx) {
    if (this._wheres.length === 0) return { clause: '', values: [], nextIdx: startIdx }

    const parts = []
    const allValues = []
    let idx = startIdx

    for (const w of this._wheres) {
      let expr = w.expr
      for (const v of w.values) {
        expr = expr.replace('?', `$${idx}`)
        allValues.push(v)
        idx++
      }
      parts.push(expr)
    }

    return { clause: ` WHERE ${parts.join(' AND ')}`, values: allValues, nextIdx: idx }
  }

  /**
   * Inline params into SQL for toString() (debugging).
   * @param {string} text
   * @param {unknown[]} values
   * @returns {string}
   */
  _inlineParams(text, values) {
    let result = text
    for (let i = values.length; i >= 1; i--) {
      result = result.replace(new RegExp(`\\$${i}`, 'g'), escapeValue(values[i - 1]))
    }
    return result
  }
}

// ─── SELECT ─────────────────────────────────────────────────

class SelectQuery extends BaseQuery {
  constructor() {
    super()
    this._tables = []
    this._fields = []
    this._joins = []
    this._orders = []
    this._limitVal = null
    this._offsetVal = null
    this._groupBy = null
    this._having = null
    this._distinct = false
  }

  /** @param {string} table — e.g. 'family', 'family f' */
  from(table) {
    this._tables.push(table)
    return this
  }

  /** Add a single field/column to SELECT. @param {string} expr @param {string} [alias] */
  field(expr, alias) {
    this._fields.push(alias ? `${expr} AS ${alias}` : expr)
    return this
  }

  /** Add multiple fields. @param {string[]} fieldList */
  fields(fieldList) {
    for (const f of fieldList) this._fields.push(f)
    return this
  }

  /** INNER JOIN */
  join(table, on) {
    this._joins.push({ type: 'INNER JOIN', table, on })
    return this
  }

  /** LEFT JOIN */
  left_join(table, on) {
    this._joins.push({ type: 'LEFT JOIN', table, on })
    return this
  }

  /** ORDER BY. @param {string} field @param {boolean} [asc=true] */
  order(field, asc = true) {
    this._orders.push(`${field} ${asc ? 'ASC' : 'DESC'}`)
    return this
  }

  /** LIMIT */
  limit(n) {
    this._limitVal = n
    return this
  }

  /** Alias for limit (squel compat) */
  top(n) {
    this._limitVal = n
    return this
  }

  /** OFFSET */
  offset(n) {
    this._offsetVal = n
    return this
  }

  /** GROUP BY */
  group(field) {
    this._groupBy = field
    return this
  }

  /** HAVING */
  having(expr) {
    this._having = expr
    return this
  }

  /** DISTINCT */
  distinct() {
    this._distinct = true
    return this
  }

  _buildInternal() {
    const cols = this._fields.length > 0 ? this._fields.join(', ') : '*'
    const distinct = this._distinct ? 'DISTINCT ' : ''
    let sql = `SELECT ${distinct}${cols}`

    if (this._tables.length > 0) {
      sql += ` FROM ${this._tables.join(', ')}`
    }

    // Joins
    for (const j of this._joins) {
      sql += ` ${j.type} ${j.table} ON ${j.on}`
    }

    // WHERE
    const { clause: whereClause, values: whereValues, nextIdx } = this._buildWhere(1)
    sql += whereClause

    // GROUP BY
    if (this._groupBy) sql += ` GROUP BY ${this._groupBy}`
    if (this._having)  sql += ` HAVING ${this._having}`

    // ORDER BY
    if (this._orders.length > 0) sql += ` ORDER BY ${this._orders.join(', ')}`

    // LIMIT / OFFSET
    if (this._limitVal !== null)  sql += ` LIMIT ${this._limitVal}`
    if (this._offsetVal !== null) sql += ` OFFSET ${this._offsetVal}`

    return { text: sql, values: whereValues }
  }
}

// ─── INSERT ─────────────────────────────────────────────────

class InsertQuery extends BaseQuery {
  constructor() {
    super()
    this._table = null
    this._data = {}          // single row: { col: value }
    this._bulkRows = null    // array of objects for bulk insert
    this._returning = null
  }

  /** Target table. */
  into(table) {
    this._table = table
    return this
  }

  /** Alias for into(). */
  from(table) {
    return this.into(table)
  }

  /** Set a single column value. */
  set(column, value) {
    this._data[column] = value
    return this
  }

  /** Set multiple column values from an object. */
  setFields(obj) {
    Object.assign(this._data, obj)
    return this
  }

  /** RETURNING clause. */
  returning(columns = '*') {
    this._returning = columns
    return this
  }

  /**
   * Bulk insert — provide array of objects.
   * All objects must have the same keys.
   */
  bulkInsert(rows) {
    this._bulkRows = rows
    return this
  }

  _buildInternal() {
    if (!this._table) throw new Error('InsertQuery: into() must be called')

    if (this._bulkRows && this._bulkRows.length > 0) {
      return this._buildBulk()
    }

    const keys = Object.keys(this._data)
    if (keys.length === 0) throw new Error('InsertQuery: no data to insert (call set() or setFields())')

    const values = []
    const placeholders = []
    for (let i = 0; i < keys.length; i++) {
      values.push(this._data[keys[i]])
      placeholders.push(`$${i + 1}`)
    }

    let sql = `INSERT INTO ${this._table} (${keys.join(', ')}) VALUES (${placeholders.join(', ')})`
    if (this._returning) sql += ` RETURNING ${this._returning}`

    return { text: sql, values }
  }

  _buildBulk() {
    const keys = Object.keys(this._bulkRows[0])
    const values = []
    const rowPlaceholders = []
    let idx = 1

    for (const row of this._bulkRows) {
      const ph = []
      for (const key of keys) {
        values.push(row[key])
        ph.push(`$${idx}`)
        idx++
      }
      rowPlaceholders.push(`(${ph.join(', ')})`)
    }

    let sql = `INSERT INTO ${this._table} (${keys.join(', ')}) VALUES ${rowPlaceholders.join(', ')}`
    if (this._returning) sql += ` RETURNING ${this._returning}`

    return { text: sql, values }
  }
}

// ─── UPDATE ─────────────────────────────────────────────────

class UpdateQuery extends BaseQuery {
  constructor() {
    super()
    this._table = null
    this._sets = {}
    this._returning = null
  }

  /** Target table. */
  table(table) {
    this._table = table
    return this
  }

  /** Alias for table(). */
  from(table) {
    return this.table(table)
  }

  /** Set a single column value. */
  set(column, value) {
    this._sets[column] = value
    return this
  }

  /** Set multiple column values from an object. */
  setFields(obj) {
    Object.assign(this._sets, obj)
    return this
  }

  /** RETURNING clause. */
  returning(columns = '*') {
    this._returning = columns
    return this
  }

  _buildInternal() {
    if (!this._table) throw new Error('UpdateQuery: table() must be called')
    const keys = Object.keys(this._sets)
    if (keys.length === 0) throw new Error('UpdateQuery: no data to update (call set() or setFields())')

    const values = []
    const setClauses = []
    let idx = 1

    for (const key of keys) {
      values.push(this._sets[key])
      setClauses.push(`${key} = $${idx}`)
      idx++
    }

    let sql = `UPDATE ${this._table} SET ${setClauses.join(', ')}`

    // WHERE
    const { clause: whereClause, values: whereValues } = this._buildWhere(idx)
    sql += whereClause
    values.push(...whereValues)

    if (this._returning) sql += ` RETURNING ${this._returning}`

    return { text: sql, values }
  }
}

// ─── DELETE ─────────────────────────────────────────────────

class DeleteQuery extends BaseQuery {
  constructor() {
    super()
    this._table = null
    this._returning = null
  }

  /** Target table. */
  from(table) {
    this._table = table
    return this
  }

  /** RETURNING clause. */
  returning(columns = '*') {
    this._returning = columns
    return this
  }

  _buildInternal() {
    if (!this._table) throw new Error('DeleteQuery: from() must be called')

    let sql = `DELETE FROM ${this._table}`

    const { clause: whereClause, values: whereValues } = this._buildWhere(1)
    sql += whereClause

    if (this._returning) sql += ` RETURNING ${this._returning}`

    return { text: sql, values: whereValues }
  }
}

// ═══════════════════════════════════════════════════════════════
// SQUEL-COMPATIBLE FACTORY
// ═══════════════════════════════════════════════════════════════

export const squel = {
  /** Start a SELECT query builder. */
  select() { return new SelectQuery() },
  /** Start an INSERT query builder. */
  insert() { return new InsertQuery() },
  /** Start an UPDATE query builder. */
  update() { return new UpdateQuery() },
  /** Start a DELETE query builder. Alias: remove(). */
  delete() { return new DeleteQuery() },
  /** Alias for delete(). */
  remove() { return new DeleteQuery() },
}

export default squel
