/**
 * SqlEditorRepository — DB queries for the dev SQL-editor feature
 *
 * Provides raw SQL execution, table listing, data browsing, seeding, and clearing.
 * All methods enforce table whitelisting at the repository level.
 */

import { BaseRepository } from '../../../../base/baseRepository.js'
import { QueryHelper }    from '../../../../base/queryHelper.js'

export class SqlEditorRepository extends BaseRepository {
  constructor(context) {
    super(context)

    this._whitelistedTables = new Set([
      this.tables.FAMILY,
      this.tables.FAMILY_MEMBER,
      this.tables.ADDRESS,
      this.tables.DOCUMENTS,
      this.tables.DOCUMENT_VERIFICATION,
      this.tables.BIOMETRIC_METADATA,
      this.tables.ACCOUNT_DETAILS,
      this.tables.IDENTITY_MATCH,
      this.tables.FAMILY_HISTORY,
      this.tables.FAMILY_EVENT_OUTBOX,
    ])

    this._deleteOrder = [
      this.tables.FAMILY_EVENT_OUTBOX,
      this.tables.FAMILY_HISTORY,
      this.tables.IDENTITY_MATCH,
      this.tables.BIOMETRIC_METADATA,
      this.tables.DOCUMENT_VERIFICATION,
      this.tables.DOCUMENTS,
      this.tables.ACCOUNT_DETAILS,
      this.tables.FAMILY_MEMBER,
      this.tables.ADDRESS,
      this.tables.FAMILY,
    ]
  }

  // ── Raw SQL (SELECT only) ──────────────────────────────────

  async execSql(sql) {
    const start = Date.now()
    const rows  = await this.runQuery(sql, [], true)
    return { rows, rowCount: rows.length, durationMs: Date.now() - start }
  }

  // ── Table accessibility ────────────────────────────────────

  isWhitelisted(table) {
    return this._whitelistedTables.has(table)
  }

  get whitelistedTables() {
    return [...this._whitelistedTables]
  }

  async probeTable(table) {
    try {
      await this.runQuery(`SELECT 1 FROM ${table} LIMIT 0`, [], true)
      return { exists: true, accessible: true }
    } catch {
      return { exists: false, accessible: false }
    }
  }

  // ── Health ─────────────────────────────────────────────────

  async ping() {
    const rows = await this.runQuery('SELECT 1 AS ok', [], true)
    return rows.length > 0
  }

  // ── Browse table data ──────────────────────────────────────

  async browseTable(table, page = 1, limit = 20) {
    const offset = (page - 1) * limit
    const { text: dataText,  values: dataValues }  = new QueryHelper(table).select('*').limit(limit).offset(offset).toParam()
    const { text: countText, values: countValues } = new QueryHelper(table).count().toParam()

    const [rows, countResult] = await Promise.all([
      this.runQuery(dataText,  dataValues,  true),
      this.runQuery(countText, countValues, true),
    ])
    const total = parseInt(countResult[0]?.count ?? '0', 10)
    return { rows, total, page, pageSize: limit }
  }

  // ── Seed sample data ──────────────────────────────────────

  async seedAddress(fields) {
    const { text, values } = new QueryHelper(this.tables.ADDRESS).insert(fields).toParam()
    await this.runQuery(text, values, false)
  }

  async seedFamily(fields) {
    const { text, values } = new QueryHelper(this.tables.FAMILY).insert(fields).toParam()
    await this.runQuery(text, values, false)
  }

  async seedMember(fields) {
    const { text, values } = new QueryHelper(this.tables.FAMILY_MEMBER).insert(fields).toParam()
    await this.runQuery(text, values, false)
  }

  async updateFamilyHead(familyUuid, headUuid) {
    const { text, values } = new QueryHelper(this.tables.FAMILY)
      .update({ head_of_family: headUuid })
      .where('uuid', '=', familyUuid)
      .toParam()
    await this.runQuery(text, values, false)
  }

  async seedHistory(fields) {
    const { text, values } = new QueryHelper(this.tables.FAMILY_HISTORY).insert(fields).toParam()
    await this.runQuery(text, values, false)
  }

  // ── Clear all data ─────────────────────────────────────────

  get deleteOrder() {
    return this._deleteOrder
  }

  async countTable(table) {
    const { text, values } = new QueryHelper(table).count().toParam()
    const rows = await this.runQuery(text, values, true)
    return parseInt(rows[0]?.count ?? '0', 10)
  }

  async truncateTable(table) {
    await this.runQuery(`DELETE FROM ${table} WHERE 1=1`, [], false)
  }
}
