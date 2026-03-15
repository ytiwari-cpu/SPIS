/**
 * SqlEditorService — business logic for dev-only SQL editor / data tools
 *
 * Production guard: ALL methods throw 403 if NODE_ENV === 'production'.
 */

import { BaseService }          from '../../../../base/baseService.js'
import { ApplicationError }      from '../../../../base/applicationError.js'
import { SqlEditorRepository }   from './sqlEditorRepository.js'

export class SqlEditorService extends BaseService {
  constructor(context) {
    super(context)
    this.sqlEditorRepository = new SqlEditorRepository(context)
  }

  // ── Guard ──────────────────────────────────────────────────

  /** @private */
  _assertNotProduction() {
    if (process.env.NODE_ENV === 'production') {
      throw ApplicationError.forbidden('Dev endpoints are disabled in production')
    }
  }

  // ── 1. Execute raw SQL (SELECT only) ───────────────────────

  async executeSql(sql) {
    this._assertNotProduction()

    if (!sql || typeof sql !== 'string') {
      throw ApplicationError.badRequest('sql is required')
    }

    const trimmed = sql.trim().toUpperCase()
    if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('WITH') && !trimmed.startsWith('EXPLAIN')) {
      throw ApplicationError.badRequest('Only SELECT / WITH / EXPLAIN queries are allowed')
    }

    const result = await this.sqlEditorRepository.execSql(sql)
    return {
      data:        result.rows,
      row_count:   result.rowCount,
      duration_ms: result.durationMs,
    }
  }

  // ── 2. List tables ─────────────────────────────────────────

  async listTables() {
    this._assertNotProduction()

    const tables = {}
    for (const table of this.sqlEditorRepository.whitelistedTables) {
      tables[table] = await this.sqlEditorRepository.probeTable(table)
    }

    return { schema: 'family', tables }
  }

  // ── 3. Health check ────────────────────────────────────────

  async healthCheck() {
    this._assertNotProduction()

    try {
      const ok = await this.sqlEditorRepository.ping()
      return { success: ok }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  // ── 4. Browse table ────────────────────────────────────────

  async browseTable(tableName, query = {}) {
    this._assertNotProduction()

    if (!this.sqlEditorRepository.isWhitelisted(tableName)) {
      throw ApplicationError.badRequest(`Table '${tableName}' is not allowed`)
    }

    const page  = parseInt(query.page  || '1', 10)
    const limit = parseInt(query.limit || '20', 10)
    const result = await this.sqlEditorRepository.browseTable(tableName, page, limit)
    return {
      table:      tableName,
      data:       result.rows,
      pagination: {
        page:        result.page,
        limit:       result.pageSize,
        total:       result.total,
        total_pages: Math.ceil(result.total / result.pageSize),
      },
    }
  }

  // ── 5. Seed sample data ────────────────────────────────────

  async seedData() {
    this._assertNotProduction()

    const now         = new Date().toISOString()
    const familyUuid  = SqlEditorService.generateUUID()
    const memberUuid  = SqlEditorService.generateUUID()
    const addressUuid = SqlEditorService.generateUUID()

    await this.sqlEditorRepository.seedFamily({
      uuid:           familyUuid,
      family_id:      'SAM001',
      family_name:    'Sample Family',
      household_size: 2,
      status:         'DRAFT',
      created_at:     now,
    })

    await this.sqlEditorRepository.seedAddress({
      uuid:           addressUuid,
      entity_type:    'FAMILY',
      entity_id:      familyUuid,
      address_type:   'PERMANENT',
      street_address: '123 Sample Street',
      parish:         'Kingston',
      country:        'Jamaica',
      created_at:     now,
    })

    await this.sqlEditorRepository.seedMember({
      uuid:                 memberUuid,
      family_uuid:          familyUuid,
      member_id:            'SAM001M001',
      first_name:           'John',
      last_name:            'Sample',
      relationship_to_head: 'head',
      status:               'ACTIVE',
      created_at:           now,
    })

    await this.sqlEditorRepository.updateFamilyHead(familyUuid, memberUuid)

    await this.sqlEditorRepository.seedHistory({
      entity_type: 'FAMILY',
      entity_id:   familyUuid,
      change_type: 'created',
      old_value:   null,
      new_value:   { status: 'DRAFT' },
      changed_by:  'seed-script',
    })

    return {
      message: 'Sample data seeded successfully',
      data:    { family_uuid: familyUuid, member_uuid: memberUuid, address_uuid: addressUuid },
    }
  }

  // ── 6. Clear all data ──────────────────────────────────────

  async clearAllData(confirmation) {
    this._assertNotProduction()

    if (confirmation !== 'DELETE_ALL_DATA') {
      throw ApplicationError.badRequest('Body must include { "confirmation": "DELETE_ALL_DATA" }')
    }

    const results = {}
    for (const table of this.sqlEditorRepository.deleteOrder) {
      try {
        const count = await this.sqlEditorRepository.countTable(table)
        await this.sqlEditorRepository.truncateTable(table)
        results[table] = { deleted: true, count, error: null }
      } catch (err) {
        results[table] = { deleted: false, count: 0, error: err.message }
      }
    }

    return { message: 'All data cleared', results }
  }
}
