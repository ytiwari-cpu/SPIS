/**
 * MemberRepository — all Supabase queries for the member feature
 */

import { supabase } from '../../lib/supabase.js'

export class MemberRepository {
  async getFamilyById(familyUuid) {
    return supabase.from('family').select('uuid').eq('uuid', familyUuid).single()
  }

  async listByFamily(familyUuid) {
    return supabase
      .from('family_member').select('*').eq('family_uuid', familyUuid)
      .order('relationship_to_head', { ascending: true })
      .order('created_at', { ascending: true })
  }

  async lookupByNationalId(nationalId) {
    return supabase
      .from('family_member').select('uuid, member_id, first_name, last_name, national_id, email, phone, family_uuid')
      .eq('national_id', nationalId).maybeSingle()
  }

  async getById(uuid) {
    return supabase.from('family_member').select('*').eq('uuid', uuid).single()
  }

  async getHeadByFamily(familyUuid) {
    return supabase
      .from('family_member').select('uuid')
      .eq('family_uuid', familyUuid).eq('relationship_to_head', 'head').single()
  }

  async create(fields) {
    return supabase.from('family_member').insert(fields).select().single()
  }

  async update(uuid, updates) {
    return supabase.from('family_member').update(updates).eq('uuid', uuid).select().single()
  }

  async remove(uuid) {
    return supabase.from('family_member').delete().eq('uuid', uuid)
  }

  async logHistory(familyUuid, actionType, changedBy, oldValues, newValues, changeReason) {
    return supabase.from('family_history').insert({
      family_uuid: familyUuid,
      action_type: actionType,
      changed_by: changedBy,
      old_values: oldValues,
      new_values: newValues,
      change_reason: changeReason || null,
    })
  }
}
