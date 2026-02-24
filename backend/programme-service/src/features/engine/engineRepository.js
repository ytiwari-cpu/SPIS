import { BaseSupabaseRepository } from '../../../../base/baseSupabaseRepository.js'
import { supabase } from '../../lib/supabase.js'
import { TABLES }   from '../../tables.js'

export class EngineRepository extends BaseSupabaseRepository {
  constructor(ctx) {
    super(ctx, supabase)
  }

  async upsertResult(record) {
    const { error } = await this.from(TABLES.PROGRAMME_CITIZENS)
      .upsert(record, { onConflict: 'programme_id,subject_id' })
    if (error) throw error
  }

  async upsertResults(records) {
    if (records.length === 0) return
    const { error } = await this.from(TABLES.PROGRAMME_CITIZENS)
      .upsert(records, { onConflict: 'programme_id,subject_id' })
    if (error) throw error
  }
}
