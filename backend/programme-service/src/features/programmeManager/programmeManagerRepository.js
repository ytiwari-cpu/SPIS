import { BaseSupabaseRepository } from '../../../../base/baseSupabaseRepository.js'
import { supabase } from '../../lib/supabase.js'
import { TABLES }   from '../../tables.js'

export class ProgrammeManagerRepository extends BaseSupabaseRepository {
  constructor(ctx) {
    super(ctx, supabase)
  }

  async findByProgramme(programmeId) {
    const { data, error } = await this.from(TABLES.PROGRAMME_MANAGER_LINK)
      .select('*').eq('programme_id', programmeId).order('created_at')
    if (error) throw error
    return data ?? []
  }

  async addLink(fields) {
    const { data, error } = await this.from(TABLES.PROGRAMME_MANAGER_LINK)
      .insert(fields).select().single()
    if (error) throw error
    return data
  }

  async removeLink(programmeId, userId) {
    const { error } = await this.from(TABLES.PROGRAMME_MANAGER_LINK)
      .delete().eq('programme_id', programmeId).eq('user_id', userId)
    if (error) throw error
  }

  async findProgrammeCreator(programmeId) {
    const { data, error } = await this.from(TABLES.PROGRAMME_MASTER)
      .select('created_by').eq('programme_id', programmeId).single()
    if (error) return null
    return data?.created_by ?? null
  }

  async isManager(programmeId, userId) {
    const { data } = await this.from(TABLES.PROGRAMME_MANAGER_LINK)
      .select('id').eq('programme_id', programmeId).eq('user_id', userId).single()
    return !!data
  }
}
