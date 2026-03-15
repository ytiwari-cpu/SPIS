/**
 * DocumentRepository — all DB queries for the document feature
 */

import { BaseRepository } from '../../../../base/baseRepository.js'
import { QueryHelper }    from '../../../../base/queryHelper.js'

export class DocumentRepository extends BaseRepository {
  constructor(context) {
    super(context)
  }

  async listByFamily(familyId) {
    const { text, values } = new QueryHelper(this.tables.DOCUMENTS)
      .select('*')
      .where('owner_type', '=', 'FAMILY')
      .where('owner_id',   '=', familyId)
      .orderBy('uploaded_at', 'DESC')
      .toParam()
    return await this.runQuery(text, values, true)
  }

  async listByMember(memberId) {
    const { text, values } = new QueryHelper(this.tables.DOCUMENTS)
      .select('*')
      .where('owner_type', '=', 'MEMBER')
      .where('owner_id',   '=', memberId)
      .orderBy('uploaded_at', 'DESC')
      .toParam()
    return await this.runQuery(text, values, true)
  }

  async getById(documentId) {
    const { text, values } = new QueryHelper(this.tables.DOCUMENTS)
      .select('*')
      .where('document_id', '=', documentId)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0] ?? null
  }

  async getFamilyById(familyUuid) {
    const { text, values } = new QueryHelper(this.tables.FAMILY)
      .select('uuid')
      .where('uuid', '=', familyUuid)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0] ?? null
  }

  async getMemberById(memberUuid) {
    const { text, values } = new QueryHelper(this.tables.FAMILY_MEMBER)
      .select('uuid')
      .where('uuid', '=', memberUuid)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0] ?? null
  }

  async create(fields) {
    const { text, values } = new QueryHelper(this.tables.DOCUMENTS).insert(fields).toParam()
    await this.runQuery(text, values, false)
  }

  async createVerification(fields) {
    const { text, values } = new QueryHelper(this.tables.DOCUMENT_VERIFICATION).insert(fields).toParam()
    return await this.runQuery(text, values, false)
  }

  async getVerification(documentId) {
    const { text, values } = new QueryHelper(this.tables.DOCUMENT_VERIFICATION)
      .select('verification_id')
      .where('document_id', '=', documentId)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0] ?? null
  }

  async updateVerification(documentId, fields) {
    const { text, values } = new QueryHelper(this.tables.DOCUMENT_VERIFICATION)
      .update(fields)
      .where('document_id', '=', documentId)
      .toParam()
    await this.runQuery(text, values, false)
  }

  async insertVerification(fields) {
    const { text, values } = new QueryHelper(this.tables.DOCUMENT_VERIFICATION).insert(fields).toParam()
    await this.runQuery(text, values, false)
  }

  async deleteVerification(documentId) {
    const { text, values } = new QueryHelper(this.tables.DOCUMENT_VERIFICATION)
      .delete()
      .where('document_id', '=', documentId)
      .toParam()
    return await this.runQuery(text, values, false)
  }

  async remove(documentId) {
    const { text, values } = new QueryHelper(this.tables.DOCUMENTS)
      .delete()
      .where('document_id', '=', documentId)
      .toParam()
    return await this.runQuery(text, values, false)
  }
}
