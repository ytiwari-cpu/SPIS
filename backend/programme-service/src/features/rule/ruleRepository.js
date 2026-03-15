import { BaseRepository } from '../../../../base/baseRepository.js'
import { QueryHelper }   from '../../../../base/queryHelper.js'

export class RuleRepository extends BaseRepository {
  constructor(context) {
    super(context)
  }

  async findAllRules() {
    const { text, values } = new QueryHelper(this.tables.RULE_MASTER)
      .select('*')
      .orderBy('category')
      .orderBy('rule_name')
      .toParam()
    return await this.runQuery(text, values, true)
  }

  async createRule(fields) {
    const { text, values } = new QueryHelper(this.tables.RULE_MASTER).insert(fields).toParam()
    await this.runQuery(text, values, false)
  }

  async findProgrammeRules(programmeId) {
    const { text, values } = new QueryHelper(this.tables.PROGRAMME_RULES)
      .select('pr')
      .field('pr.*')
      .field('row_to_json(rm.*)', 'rule_master')
      .left_join(this.tables.RULE_MASTER, 'rm', 'rm.rule_code = pr.rule_code')
      .where('pr.programme_id', '=', programmeId)
      .orderBy('pr.created_at')
      .toParam()
    return await this.runQuery(text, values, true)
  }

  async addProgrammeRule(fields) {
    const { text, values } = new QueryHelper(this.tables.PROGRAMME_RULES).insert(fields).toParam()
    await this.runQuery(text, values, false)
  }

  async findProgrammeRuleById(ruleId) {
    const { text, values } = new QueryHelper(this.tables.PROGRAMME_RULES)
      .select('*')
      .where('programme_rule_id', '=', ruleId)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0] ?? null
  }

  async deleteProgrammeRule(programmeId, ruleId) {
    const { text, values } = new QueryHelper(this.tables.PROGRAMME_RULES)
      .delete()
      .where('programme_rule_id', '=', ruleId)
      .where('programme_id',      '=', programmeId)
      .toParam()
    return await this.runQuery(text, values, false)
  }

  async recordRuleHistory(entry) {
    const sanitized = { ...entry }
    if (sanitized.old_value && typeof sanitized.old_value === 'object') {
      sanitized.old_value = JSON.stringify(sanitized.old_value)
    }
    if (sanitized.new_value && typeof sanitized.new_value === 'object') {
      sanitized.new_value = JSON.stringify(sanitized.new_value)
    }
    const { text, values } = new QueryHelper(this.tables.PROGRAMME_RULES_HISTORY).insert(sanitized).toParam()
    return await this.runQuery(text, values, false)
  }

  async findAllVersions() {
    const { text, values } = new QueryHelper(this.tables.RULE_VERSION_MASTER)
      .select('*')
      .orderBy('effective_from', 'DESC')
      .toParam()
    return await this.runQuery(text, values, true)
  }

  async createVersion(fields) {
    const { text, values } = new QueryHelper(this.tables.RULE_VERSION_MASTER).insert(fields).toParam()
    await this.runQuery(text, values, false)
  }
}
