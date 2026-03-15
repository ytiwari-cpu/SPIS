/**
 * CustomFieldRepository — DB queries for custom field definitions.
 */

import { BaseRepository } from '../../../../base/baseRepository.js'
import { QueryHelper }   from '../../../../base/queryHelper.js'

export class CustomFieldRepository extends BaseRepository {
  constructor(context) {
    super(context)
  }

  async findAll() {
    const { text, values } = new QueryHelper(this.tables.CUSTOM_FIELD_DEFINITIONS)
      .select('*')
      .where('is_active', '=', true)
      .orderBy('created_at', 'DESC')
      .toParam()
    return await this.runQuery(text, values, true)
  }

  async findByTable(targetTable) {
    const { text, values } = new QueryHelper(this.tables.CUSTOM_FIELD_DEFINITIONS)
      .select('*')
      .where('target_table', '=', targetTable)
      .where('is_active',    '=', true)
      .orderBy('created_at', 'DESC')
      .toParam()
    return await this.runQuery(text, values, true)
  }

  async findById(id) {
    const { text, values } = new QueryHelper(this.tables.CUSTOM_FIELD_DEFINITIONS)
      .select('*')
      .where('custom_field_id', '=', id)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0] ?? null
  }

  async create(fields) {
    const {
      display_name, column_name, target_table, data_type, pg_type,
      enum_values, is_required, default_value, description, created_by,
    } = fields

    const { text, values } = new QueryHelper(this.tables.CUSTOM_FIELD_DEFINITIONS)
      .insert({
        display_name,
        column_name,
        target_table,
        data_type,
        pg_type,
        enum_values:   JSON.stringify(enum_values || null),
        is_required:   is_required || false,
        default_value: default_value || null,
        description:   description || null,
        created_by:    created_by || null,
      })
      .toParam()
    await this.runQuery(text, values, false)

    // Fetch the inserted row by unique key
    const { text: selText, values: selValues } = new QueryHelper(this.tables.CUSTOM_FIELD_DEFINITIONS)
      .select('*')
      .where('column_name', '=', column_name)
      .where('target_table', '=', target_table)
      .orderBy('created_at', 'DESC')
      .limit(1)
      .toParam()
    const rows = await this.runQuery(selText, selValues, true)
    return rows[0] ?? null
  }

  async update(id, fields) {
    const updateData = {}
    for (const [key, val] of Object.entries(fields)) {
      updateData[key] = key === 'enum_values' ? JSON.stringify(val) : val
    }
    updateData.updated_at = new Date().toISOString()

    const { text, values } = new QueryHelper(this.tables.CUSTOM_FIELD_DEFINITIONS)
      .update(updateData)
      .where('custom_field_id', '=', id)
      .toParam()
    await this.runQuery(text, values, false)

    // Fetch the updated row
    const { text: selText, values: selValues } = new QueryHelper(this.tables.CUSTOM_FIELD_DEFINITIONS)
      .select('*')
      .where('custom_field_id', '=', id)
      .toParam()
    const rows = await this.runQuery(selText, selValues, true)
    return rows[0] ?? null
  }

  async deactivate(id) {
    const now = new Date().toISOString()
    const { text, values } = new QueryHelper(this.tables.CUSTOM_FIELD_DEFINITIONS)
      .update({ is_active: false, updated_at: now })
      .where('custom_field_id', '=', id)
      .toParam()
    await this.runQuery(text, values, false)
  }
}
