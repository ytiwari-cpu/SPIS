import { BaseSupabaseRepository } from '../../../../../base/baseSupabaseRepository.js'
import { supabase } from '../../../lib/supabase.js'
import { PROGRAMME_TABLES as TABLES } from '../../../../../base/table.js'

const PROGRAMME_WITH_RELATIONS = '*, programme_config(*), programme_payment_settings(*)'
const PROGRAMME_WITH_RULES     = '*, programme_config(*), programme_payment_settings(*), programme_rules(*)'

export class ProgrammeRepository extends BaseSupabaseRepository {
  constructor(ctx) {
    super(ctx, supabase)
  }

  async findAll() {
    const { data, error } = await this.from(TABLES.PROGRAMME_MASTER)
      .select(PROGRAMME_WITH_RELATIONS).order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  }

  async findManagedProgrammeIds(userId) {
    const { data } = await this.from(TABLES.PROGRAMME_MANAGER_LINK)
      .select('programme_id').eq('user_id', userId)
    return (data ?? []).map(d => d.programme_id)
  }

  async findById(programmeId) {
    const { data, error } = await this.from(TABLES.PROGRAMME_MASTER)
      .select(PROGRAMME_WITH_RULES).eq('programme_id', programmeId).single()
    if (error) throw error
    return data
  }

  async findByIdWithRelations(programmeId) {
    const { data, error } = await this.from(TABLES.PROGRAMME_MASTER)
      .select(PROGRAMME_WITH_RELATIONS).eq('programme_id', programmeId).single()
    if (error) throw error
    return data
  }

  async createMaster(fields) { return this.insertOne(TABLES.PROGRAMME_MASTER, fields) }

  async createConfig(fields) {
    const { error } = await this.from(TABLES.PROGRAMME_CONFIG).insert(fields)
    if (error) throw error
  }

  async createPaymentSettings(fields) {
    const { error } = await this.from(TABLES.PROGRAMME_PAYMENT_SETTINGS).insert(fields)
    if (error) throw error
  }

  async addManager(programmeId, userId, addedBy) {
    const { error } = await this.from(TABLES.PROGRAMME_MANAGER_LINK)
      .insert({ programme_id: programmeId, user_id: userId, added_by: addedBy })
    if (error) throw error
  }

  async updateMaster(programmeId, fields) {
    const { data, error } = await this.from(TABLES.PROGRAMME_MASTER)
      .update(fields).eq('programme_id', programmeId).select().single()
    if (error) throw error
    return data
  }

  async updateConfig(programmeId, fields) {
    const { error } = await this.from(TABLES.PROGRAMME_CONFIG)
      .update(fields).eq('programme_id', programmeId)
    if (error) throw error
  }

  async recordHistory(entry) {
    const { error } = await this.from(TABLES.PROGRAMME_HISTORY).insert(entry)
    if (error) throw error
  }

  async deactivate(programmeId, userId) {
    const { error } = await this.from(TABLES.PROGRAMME_MASTER)
      .update({
        active_flag: false,
        status:      'INACTIVE',
        updated_at:  new Date().toISOString(),
        updated_by:  userId,
      })
      .eq('programme_id', programmeId)
    if (error) throw error
  }
}
