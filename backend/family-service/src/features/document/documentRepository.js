/**
 * DocumentRepository — all Supabase queries for the document feature
 */

import { supabase } from '../../lib/supabase.js'

export class DocumentRepository {
  async listByFamily(familyId) {
    return supabase.from('documents').select('*')
      .eq('owner_type', 'FAMILY').eq('owner_id', familyId).order('uploaded_at', { ascending: false })
  }

  async listByMember(memberId) {
    return supabase.from('documents').select('*')
      .eq('owner_type', 'MEMBER').eq('owner_id', memberId).order('uploaded_at', { ascending: false })
  }

  async getById(documentId) {
    return supabase.from('documents').select('*').eq('document_id', documentId).single()
  }

  async getFamilyById(familyUuid) {
    return supabase.from('family').select('uuid').eq('uuid', familyUuid).single()
  }

  async getMemberById(memberUuid) {
    return supabase.from('family_member').select('uuid').eq('uuid', memberUuid).single()
  }

  async create(fields) {
    return supabase.from('documents').insert(fields).select().single()
  }

  async createVerification(fields) {
    return supabase.from('document_verification').insert(fields)
  }

  async getVerification(documentId) {
    return supabase.from('document_verification').select('verification_id').eq('document_id', documentId).single()
  }

  async updateVerification(documentId, fields) {
    return supabase.from('document_verification').update(fields).eq('document_id', documentId).select().single()
  }

  async insertVerification(fields) {
    return supabase.from('document_verification').insert(fields).select().single()
  }

  async deleteVerification(documentId) {
    return supabase.from('document_verification').delete().eq('document_id', documentId)
  }

  async remove(documentId) {
    return supabase.from('documents').delete().eq('document_id', documentId)
  }
}
