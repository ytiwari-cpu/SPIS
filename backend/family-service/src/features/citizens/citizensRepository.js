/**
 * CitizensRepository — all Supabase queries for the citizens feature
 */

import { supabase } from '../../lib/supabase.js'

const FIELDS = 'uuid, member_id, family_uuid, national_id, first_name, last_name, date_of_birth, gender, relationship_to_head, alive_flag, marital_status, phone, email, member_status, created_at, updated_at'

export class CitizensRepository {
  async list({ page, limit, status, gender, search }) {
    const offset = (page - 1) * limit
    let query = supabase.from('family_member').select(FIELDS, { count: 'exact' })
    if (status) query = query.eq('member_status', status)
    if (gender)  query = query.eq('gender', gender)
    if (search)  query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,national_id.ilike.%${search}%,member_id.ilike.%${search}%`)
    return query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)
  }

  async getById(uuid) {
    return supabase.from('family_member').select(FIELDS).eq('uuid', uuid).single()
  }
}
