/**
 * FamilyRepository — all Supabase queries for the family feature
 */

import { supabase } from '../../lib/supabase.js'

export class FamilyRepository {
  // ── Family ─────────────────────────────────────────────────────────────

  async list({ page, limit, status, registrationStatus }) {
    const offset = (page - 1) * limit
    let query = supabase.from('family').select('*', { count: 'exact' })
    if (status) query = query.eq('status', status)
    if (registrationStatus) query = query.eq('registration_status', registrationStatus)
    return query.range(offset, offset + limit - 1).order('created_at', { ascending: false })
  }

  async getById(uuid) {
    return supabase.from('family').select('*').eq('uuid', uuid).single()
  }

  async create(fields) {
    return supabase.from('family').insert(fields).select().single()
  }

  async update(uuid, updates) {
    return supabase.from('family').update(updates).eq('uuid', uuid).select().single()
  }

  // ── Members (for get/create operations) ────────────────────────────────

  async getMembersByFamily(familyUuid) {
    return supabase.from('family_member').select('*').eq('family_uuid', familyUuid).order('relationship_to_head')
  }

  async createMember(fields) {
    return supabase.from('family_member').insert(fields).select().single()
  }

  async getHeadMember(familyUuid) {
    return supabase
      .from('family_member').select('uuid')
      .eq('family_uuid', familyUuid).eq('relationship_to_head', 'head').single()
  }

  // ── Address (for get/create operations) ────────────────────────────────

  async createAddress(fields) {
    return supabase.from('address').insert(fields).select().single()
  }

  async getAddressByFamily(familyUuid) {
    return supabase
      .from('address').select('*')
      .eq('entity_type', 'FAMILY').eq('entity_id', familyUuid).eq('address_type', 'PERMANENT').single()
  }

  // ── Documents (for get operation) ──────────────────────────────────────

  async getDocumentsByFamily(familyUuid) {
    return supabase
      .from('documents').select('*, document_verification (*)')
      .eq('owner_type', 'FAMILY').eq('owner_id', familyUuid)
  }

  // ── History ────────────────────────────────────────────────────────────

  async getHistory(familyUuid) {
    return supabase
      .from('family_history').select('*')
      .eq('family_uuid', familyUuid).order('created_at', { ascending: false })
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

  // ── Event outbox ────────────────────────────────────────────────────────

  async publishEvent(eventType, aggregateType, aggregateId, payload) {
    return supabase.from('family_event_outbox').insert({
      event_type: eventType,
      aggregate_type: aggregateType,
      aggregate_id: aggregateId,
      payload,
      status: 'pending',
    })
  }
}
