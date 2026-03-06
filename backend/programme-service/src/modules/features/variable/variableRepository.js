import { BaseSupabaseRepository } from '../../../../../base/baseSupabaseRepository.js'
import { supabase } from '../../../lib/supabase.js'
import { PROGRAMME_TABLES as TABLES } from '../../../../../base/table.js'

export class VariableRepository extends BaseSupabaseRepository {
  constructor(ctx) {
    super(ctx, supabase)
  }

  async findActiveRuleGroups() {
    const { data, error } = await this.from(TABLES.RULE_GROUP)
      .select('rule_group_id, group_code, group_name, scoring_method').eq('is_active', true)
    if (error) throw error
    return data ?? []
  }
}
