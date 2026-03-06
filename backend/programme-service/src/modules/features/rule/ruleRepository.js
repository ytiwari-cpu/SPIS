import { BaseSupabaseRepository } from '../../../../../base/baseSupabaseRepository.js'
import { supabase } from '../../../lib/supabase.js'
import { PROGRAMME_TABLES as TABLES } from '../../../../../base/table.js'

export class RuleRepository extends BaseSupabaseRepository {
  constructor(ctx) {
    super(ctx, supabase)
  }

  async findAllRules() {
    const { data, error } = await this.from(TABLES.RULE_MASTER)
      .select('*').order('category').order('rule_name')
    if (error) throw error
    return data ?? []
  }

  async createRule(fields) { return this.insertOne(TABLES.RULE_MASTER, fields) }

  async findProgrammeRules(programmeId) {
    const { data, error } = await this.from(TABLES.PROGRAMME_RULES)
      .select('*, rule_master:rule_code(*)').eq('programme_id', programmeId).order('created_at')
    if (error) throw error
    return data ?? []
  }

  async addProgrammeRule(fields) {
    const { data, error } = await this.from(TABLES.PROGRAMME_RULES).insert(fields).select().single()
    if (error) throw error
    return data
  }

  async findProgrammeRuleById(ruleId) {
    const { data, error } = await this.from(TABLES.PROGRAMME_RULES)
      .select('*').eq('programme_rule_id', ruleId).single()
    if (error && error.code !== 'PGRST116') throw error
    return data
  }

  async deleteProgrammeRule(programmeId, ruleId) {
    const { error } = await this.from(TABLES.PROGRAMME_RULES)
      .delete().eq('programme_rule_id', ruleId).eq('programme_id', programmeId)
    if (error) throw error
  }

  async recordRuleHistory(entry) {
    const { error } = await this.from(TABLES.PROGRAMME_RULES_HISTORY).insert(entry)
    if (error) throw error
  }

  async findAllVersions() {
    const { data, error } = await this.from(TABLES.RULE_VERSION_MASTER)
      .select('*').order('effective_from', { ascending: false })
    if (error) throw error
    return data ?? []
  }

  async createVersion(fields) { return this.insertOne(TABLES.RULE_VERSION_MASTER, fields) }
}
