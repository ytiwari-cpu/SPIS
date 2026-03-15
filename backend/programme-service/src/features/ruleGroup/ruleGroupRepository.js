import { BaseRepository } from '../../../../base/baseRepository.js'
import { QueryHelper }   from '../../../../base/queryHelper.js'

export class RuleGroupRepository extends BaseRepository {
  constructor(context) {
    super(context)
  }

  async findAll() {
    const { text, values } = new QueryHelper(this.tables.RULE_GROUP)
      .select('rg')
      .field('rg.*')
      .field(
        `COALESCE(
           (SELECT json_agg(rgr.* ORDER BY rgr.created_at)
            FROM ${this.tables.RULE_GROUP_RULES} rgr
            WHERE rgr.rule_group_id = rg.rule_group_id),
           '[]'::json
         )`,
        'rule_group_rules',
      )
      .where('rg.is_active', '=', true)
      .orderBy('rg.group_name')
      .toParam()
    return await this.runQuery(text, values, true)
  }

  async findById(groupId) {
    const { text: groupText, values: groupValues } = new QueryHelper(this.tables.RULE_GROUP)
      .select('*')
      .where('rule_group_id', '=', groupId)
      .toParam()
    const rows = await this.runQuery(groupText, groupValues, true)
    const group = rows[0] ?? null
    if (!group) {
      return null
    }

    const { text: rulesText, values: rulesValues } = new QueryHelper(this.tables.RULE_GROUP_RULES)
      .select('rgr')
      .field('rgr.*')
      .field('row_to_json(rvc.*)', 'rule_variable_catalog')
      .left_join(this.tables.RULE_VARIABLE_CATALOG, 'rvc', 'rvc.variable_code = rgr.variable_code')
      .where('rgr.rule_group_id', '=', groupId)
      .toParam()
    const subRules = await this.runQuery(rulesText, rulesValues, true)
    group.rule_group_rules = subRules
    return group
  }

  async create(fields) {
    const { text, values } = new QueryHelper(this.tables.RULE_GROUP).insert(fields).toParam()
    await this.runQuery(text, values, false)
  }

  async update(groupId, fields) {
    const { text, values } = new QueryHelper(this.tables.RULE_GROUP)
      .update(fields)
      .where('rule_group_id', '=', groupId)
      .toParam()
    await this.runQuery(text, values, false)
  }

  async deactivate(groupId, updatedAt) {
    const { text, values } = new QueryHelper(this.tables.RULE_GROUP)
      .update({ is_active: false, updated_at: updatedAt })
      .where('rule_group_id', '=', groupId)
      .toParam()
    return await this.runQuery(text, values, false)
  }

  async addSubRule(fields) {
    const { text, values } = new QueryHelper(this.tables.RULE_GROUP_RULES).insert(fields).toParam()
    await this.runQuery(text, values, false)
  }

  async removeSubRule(groupId, ruleId) {
    const { text, values } = new QueryHelper(this.tables.RULE_GROUP_RULES)
      .delete()
      .where('rule_group_rule_id', '=', ruleId)
      .where('rule_group_id',      '=', groupId)
      .toParam()
    return await this.runQuery(text, values, false)
  }
}
