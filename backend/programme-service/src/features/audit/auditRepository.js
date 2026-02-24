import { BaseSupabaseRepository } from '../../../../base/baseSupabaseRepository.js'
import { supabase } from '../../lib/supabase.js'
import { TABLES } from '../../tables.js'

export class AuditRepository extends BaseSupabaseRepository {
  constructor(ctx) {
    super(ctx, supabase)
  }

  async findProgrammeHistory(programmeId) {
    const { data, error } = await this.from(TABLES.PROGRAMME_HISTORY)
      .select('*').eq('programme_id', programmeId)
      .order('changed_at', { ascending: false }).limit(100)
    if (error) throw error
    return data ?? []
  }

  async findRulesHistory(programmeId) {
    const { data, error } = await this.from(TABLES.PROGRAMME_RULES_HISTORY)
      .select('*').eq('programme_id', programmeId)
      .order('changed_at', { ascending: false }).limit(100)
    if (error) throw error
    return data ?? []
  }

  async findExitHistory(programmeId) {
    const { data, error } = await this.from(TABLES.PROGRAMME_EXIT_HISTORY)
      .select('*').eq('programme_id', programmeId)
      .order('exited_at', { ascending: false }).limit(100)
    if (error) throw error
    return data ?? []
  }

  async findAllHistory() {
    const { data, error } = await this.from(TABLES.PROGRAMME_HISTORY)
      .select('*').order('changed_at', { ascending: false }).limit(200)
    if (error) throw error
    return data ?? []
  }
}
