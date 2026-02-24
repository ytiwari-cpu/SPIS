import { BaseSupabaseRepository } from '../../../../base/baseSupabaseRepository.js'
import { supabase } from '../../lib/supabase.js'
import { TABLES } from '../../tables.js'

export class BeneficiaryRepository extends BaseSupabaseRepository {
  constructor(ctx) {
    super(ctx, supabase)
  }

  async findBySubject(subjectId) {
    const { data, error } = await this.from(TABLES.PROGRAMME_CITIZENS)
      .select(`
        *,
        programme:programme_master(
          programme_id, name, description, status,
          created_by, created_at, updated_at,
          programme_config(*), programme_payment_settings(*)
        )
      `)
      .eq('subject_id', subjectId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  }

  async findByProgramme(programmeId) {
    const { data, error } = await this.from(TABLES.PROGRAMME_CITIZENS)
      .select('*').eq('programme_id', programmeId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  }

  async enroll(fields) {
    const { data, error } = await this.from(TABLES.PROGRAMME_CITIZENS)
      .insert(fields).select().single()
    if (error) throw error
    return data
  }

  async updateStatus(programmeId, subjectId, payload) {
    const { data, error } = await this.from(TABLES.PROGRAMME_CITIZENS)
      .update(payload).eq('programme_id', programmeId).eq('subject_id', subjectId)
      .select().single()
    if (error) throw error
    return data
  }

  async recordExit(entry) {
    const { error } = await this.from(TABLES.PROGRAMME_EXIT_HISTORY).insert(entry)
    if (error) throw error
  }
}
