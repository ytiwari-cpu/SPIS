import { BaseSupabaseRepository } from '../../../../base/baseSupabaseRepository.js'
import { supabase } from '../../lib/supabase.js'
import { TABLES }   from '../../tables.js'

export class RuleGroupRepository extends BaseSupabaseRepository {
  constructor(ctx) {
    super(ctx, supabase)
  }

  async findAll() {
    const { data, error } = await this.from(TABLES.RULE_GROUP)
      .select('*, rule_group_rules(*)').eq('is_active', true).order('group_name')
    if (error) throw error
    return data ?? []
  }

  async findById(groupId) {
    const { data, error } = await this.from(TABLES.RULE_GROUP)
      .select('*, rule_group_rules(*, rule_variable_catalog:variable_code(*))')
      .eq('rule_group_id', groupId).single()
    if (error) throw error
    return data
  }

  async create(fields) { return this.insertOne(TABLES.RULE_GROUP, fields) }
  async update(groupId, fields) { return this.updateOne(TABLES.RULE_GROUP, fields, 'rule_group_id', groupId) }

  async deactivate(groupId) {
    const { error } = await this.from(TABLES.RULE_GROUP)
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('rule_group_id', groupId)
    if (error) throw error
  }

  async addSubRule(fields) {
    const { data, error } = await this.from(TABLES.RULE_GROUP_RULES).insert(fields).select().single()
    if (error) throw error
    return data
  }

  async removeSubRule(groupId, ruleId) {
    const { error } = await this.from(TABLES.RULE_GROUP_RULES)
      .delete().eq('rule_group_rule_id', ruleId).eq('rule_group_id', groupId)
    if (error) throw error
  }
}
