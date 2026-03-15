/**
 * UploadRepository — DB queries for the upload (document file I/O) feature
 *
 * Handles document metadata CRUD. Actual file storage is via Supabase Storage
 * (accessed in the service layer through the legacy uploadService utility).
 */

import { BaseRepository } from '../../../../base/baseRepository.js'
import { QueryHelper }    from '../../../../base/queryHelper.js'

export class UploadRepository extends BaseRepository {
  constructor(context) {
    super(context)
  }

  // ── Family / Member lookups ────────────────────────────────

  async findFamilyByUuid(familyUuid) {
    const { text, values } = new QueryHelper(this.tables.FAMILY)
      .select('uuid, family_id')
      .where('uuid', '=', familyUuid)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0] ?? null
  }

  async findMemberByUuid(memberUuid) {
    const { text, values } = new QueryHelper(this.tables.FAMILY_MEMBER)
      .select('uuid, member_id, family_id')
      .where('uuid', '=', memberUuid)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0] ?? null
  }

  // ── Documents ──────────────────────────────────────────────

  async findDocumentById(documentId) {
    const { text, values } = new QueryHelper(this.tables.DOCUMENTS)
      .select('*')
      .where('document_id', '=', documentId)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0] ?? null
  }

  async findDocumentByOwner(ownerType, ownerId, documentId) {
    const { text, values } = new QueryHelper(this.tables.DOCUMENTS)
      .select('*')
      .where('owner_type',  '=', ownerType)
      .where('owner_id',    '=', ownerId)
      .where('document_id', '=', documentId)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0] ?? null
  }

  async createDocument(fields) {
    const { text, values } = new QueryHelper(this.tables.DOCUMENTS).insert(fields).toParam()
    await this.runQuery(text, values, false)
  }

  async deleteDocument(documentId) {
    const { text, values } = new QueryHelper(this.tables.DOCUMENTS)
      .delete()
      .where('document_id', '=', documentId)
      .toParam()
    return await this.runQuery(text, values, false)
  }

  // ── Document verification FK cleanup ───────────────────────

  async deleteVerificationByDocument(documentId) {
    const { text, values } = new QueryHelper(this.tables.DOCUMENT_VERIFICATION)
      .delete()
      .where('document_id', '=', documentId)
      .toParam()
    return await this.runQuery(text, values, false)
  }

  // ── History ────────────────────────────────────────────────

  async insertHistory(fields) {
    const { text, values } = new QueryHelper(this.tables.FAMILY_HISTORY).insert(fields).toParam()
    return await this.runQuery(text, values, false)
  }
}
