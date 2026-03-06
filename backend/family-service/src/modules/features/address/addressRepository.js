/**
 * AddressRepository — all Supabase queries for the address feature
 */

import { supabase } from '../../../lib/supabase.js'

export class AddressRepository {
  async getById(addressId) {
    return supabase.from('address').select('*').eq('address_id', addressId).single()
  }

  async create(fields) {
    return supabase.from('address').insert(fields).select().single()
  }

  async update(addressId, updates) {
    return supabase.from('address').update(updates).eq('address_id', addressId).select().single()
  }

  async remove(addressId) {
    return supabase.from('address').delete().eq('address_id', addressId)
  }

  async getFamilyRef(addressId) {
    return supabase.from('family').select('family_id').eq('permanent_address_id', addressId).limit(1)
  }

  async getMemberRef(addressId) {
    return supabase.from('family_member').select('member_id').eq('current_address_id', addressId).limit(1)
  }
}
