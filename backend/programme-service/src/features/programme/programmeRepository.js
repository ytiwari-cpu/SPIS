import { BaseRepository } from '../../../../base/baseRepository.js'
import { QueryHelper }   from '../../../../base/queryHelper.js'

export class ProgrammeRepository extends BaseRepository {
  constructor(context) {
    super(context)
  }

  async findAll() {
    const { text, values } = new QueryHelper(this.tables.PROGRAMME_MASTER)
      .select('pm')
      .field('pm.*')
      .field('row_to_json(pc.*)',  'programme_config')
      .field('row_to_json(pps.*)', 'programme_payment_settings')
      .left_join(this.tables.PROGRAMME_CONFIG,           'pc',  'pc.programme_id = pm.programme_id')
      .left_join(this.tables.PROGRAMME_PAYMENT_SETTINGS, 'pps', 'pps.programme_id = pm.programme_id')
      .orderBy('pm.created_at', 'DESC')
      .toParam()
    return await this.runQuery(text, values, true)
  }

  async findManagedProgrammeIds(userId) {
    const { text, values } = new QueryHelper(this.tables.PROGRAMME_MANAGER_LINK)
      .select('programme_id')
      .where('user_id', '=', userId)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows.map(d => d.programme_id)
  }

  async findById(programmeId) {
    const { text, values } = new QueryHelper(this.tables.PROGRAMME_MASTER)
      .select('pm')
      .field('pm.*')
      .field('row_to_json(pc.*)',  'programme_config')
      .field('row_to_json(pps.*)', 'programme_payment_settings')
      .left_join(this.tables.PROGRAMME_CONFIG,           'pc',  'pc.programme_id = pm.programme_id')
      .left_join(this.tables.PROGRAMME_PAYMENT_SETTINGS, 'pps', 'pps.programme_id = pm.programme_id')
      .where('pm.programme_id', '=', programmeId)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    const programme = rows[0] ?? null
    if (!programme) {
      return null
    }

    const { text: rulesText, values: rulesValues } = new QueryHelper(this.tables.PROGRAMME_RULES)
      .select('*')
      .where('programme_id', '=', programmeId)
      .orderBy('created_at')
      .toParam()
    const rules = await this.runQuery(rulesText, rulesValues, true)
    programme.programme_rules = rules
    return programme
  }

  async findByIdWithRelations(programmeId) {
    const { text, values } = new QueryHelper(this.tables.PROGRAMME_MASTER)
      .select('pm')
      .field('pm.*')
      .field('row_to_json(pc.*)',  'programme_config')
      .field('row_to_json(pps.*)', 'programme_payment_settings')
      .left_join(this.tables.PROGRAMME_CONFIG,           'pc',  'pc.programme_id = pm.programme_id')
      .left_join(this.tables.PROGRAMME_PAYMENT_SETTINGS, 'pps', 'pps.programme_id = pm.programme_id')
      .where('pm.programme_id', '=', programmeId)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0] ?? null
  }

  async createMaster(fields) {
    const { text, values } = new QueryHelper(this.tables.PROGRAMME_MASTER).insert(fields).toParam()
    await this.runQuery(text, values, false)
  }

  async createConfig(fields) {
    const { text, values } = new QueryHelper(this.tables.PROGRAMME_CONFIG).insert(fields).toParam()
    return await this.runQuery(text, values, false)
  }

  async createPaymentSettings(fields) {
    const { text, values } = new QueryHelper(this.tables.PROGRAMME_PAYMENT_SETTINGS).insert(fields).toParam()
    return await this.runQuery(text, values, false)
  }

  async addManager(programmeId, userId, addedBy) {
    const { text, values } = new QueryHelper(this.tables.PROGRAMME_MANAGER_LINK)
      .insert({ programme_id: programmeId, user_id: userId, added_by: addedBy })
      .toParam()
    return await this.runQuery(text, values, false)
  }

  async updateMaster(programmeId, fields) {
    const { text, values } = new QueryHelper(this.tables.PROGRAMME_MASTER)
      .update(fields)
      .where('programme_id', '=', programmeId)
      .toParam()
    await this.runQuery(text, values, false)
  }

  async updateConfig(programmeId, fields) {
    const { text, values } = new QueryHelper(this.tables.PROGRAMME_CONFIG)
      .update(fields)
      .where('programme_id', '=', programmeId)
      .toParam()
    return await this.runQuery(text, values, false)
  }

  async recordHistory(entry) {
    const sanitized = { ...entry }
    if (sanitized.old_value && typeof sanitized.old_value === 'object') {
      sanitized.old_value = JSON.stringify(sanitized.old_value)
    }
    if (sanitized.new_value && typeof sanitized.new_value === 'object') {
      sanitized.new_value = JSON.stringify(sanitized.new_value)
    }
    const { text, values } = new QueryHelper(this.tables.PROGRAMME_HISTORY).insert(sanitized).toParam()
    return await this.runQuery(text, values, false)
  }

  async deactivate(programmeId, userId, updatedAt) {
    const { text, values } = new QueryHelper(this.tables.PROGRAMME_MASTER)
      .update({ active_flag: false, status: 'INACTIVE', updated_at: updatedAt, updated_by: userId })
      .where('programme_id', '=', programmeId)
      .toParam()
    return await this.runQuery(text, values, false)
  }
}
