/**
 * AuthRepository — Supabase queries for family auth enrichment
 */

import { supabase } from '../../lib/supabase.js'

export class AuthRepository {
  async getMemberByNationalId(nationalId) {
    return supabase.from('family_member').select('family_uuid, national_id, *')
      .eq('national_id', nationalId).order('created_at', { ascending: false }).limit(1).maybeSingle()
  }

  async getFamilyByUuid(familyUuid) {
    return supabase.from('family')
      .select('uuid, family_id, status, registration_status, household_size, created_at')
      .eq('uuid', familyUuid).single()
  }

  async getFamilyFullByUuid(familyUuid) {
    return supabase.from('family').select(`
      uuid, family_id, head_member_id, household_size, geo_code, vulnerability_flag,
      status, intake_channel, registration_status, submitted_at, verified_at, created_at, updated_at
    `).eq('uuid', familyUuid).single()
  }

  async getFamilyByFamilyId(familyId) {
    return supabase.from('family').select('uuid').eq('family_id', familyId).single()
  }

  async getHeadMemberByFamily(familyUuid) {
    return supabase.from('family_member')
      .select('uuid, member_id, first_name, last_name, national_id')
      .eq('family_uuid', familyUuid).eq('relationship_to_head', 'head').single()
  }
}
