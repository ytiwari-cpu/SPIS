/**
 * FamilyRepository — all DB queries for the family feature
 */

import { BaseRepository } from '../../../../base/baseRepository.js'
import { QueryHelper }    from '../../../../base/queryHelper.js'

export class FamilyRepository extends BaseRepository {
  constructor(context) {
    super(context)
  }

  // ── Family ─────────────────────────────────────────────────────────────

  async list({ page, limit, status, registrationStatus }) {
    const offset = (page - 1) * limit

    const applyFilters = (qh) => {
      if (status)             {
        qh.where('status', '=', status)
      }
      if (registrationStatus) {
        qh.where('registration_status', '=', registrationStatus)
      }
      return qh
    }

    const { text: countText, values: countValues } = applyFilters(
      new QueryHelper(this.tables.FAMILY).count('*')
    ).toParam()
    const countRows = await this.runQuery(countText, countValues, true)
    const count     = parseInt(countRows[0]?.count || '0', 10)

    const mainQh = applyFilters(new QueryHelper(this.tables.FAMILY).select('*'))
    mainQh.orderBy('created_at', 'DESC').limit(limit).offset(offset)
    const { text, values } = mainQh.toParam()
    const rows = await this.runQuery(text, values, true)
    return { data: rows, count }
  }

  async getById(uuid) {
    const { text, values } = new QueryHelper(this.tables.FAMILY)
      .select('*')
      .where('uuid', '=', uuid)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0] ?? null
  }

  async create(fields) {
    const { text, values } = new QueryHelper(this.tables.FAMILY).insert(fields).toParam()
    await this.runQuery(text, values, false)
  }

  async update(uuid, updates) {
    const { text, values } = new QueryHelper(this.tables.FAMILY)
      .update(updates)
      .where('uuid', '=', uuid)
      .toParam()
    await this.runQuery(text, values, false)
  }

  // ── Members (for get/create operations) ────────────────────────────────

  async getMembersByFamily(familyUuid) {
    const { text, values } = new QueryHelper(this.tables.FAMILY_MEMBER)
      .select('*')
      .where('family_uuid', '=', familyUuid)
      .orderBy('relationship_to_head')
      .toParam()
    return await this.runQuery(text, values, true)
  }

  async createMember(fields) {
    const { text, values } = new QueryHelper(this.tables.FAMILY_MEMBER).insert(fields).toParam()
    await this.runQuery(text, values, false)
  }

  async getHeadMember(familyUuid) {
    const { text, values } = new QueryHelper(this.tables.FAMILY_MEMBER)
      .select('uuid')
      .where('family_uuid',          '=', familyUuid)
      .where('relationship_to_head', '=', 'head')
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0] ?? null
  }

  // ── Address (for get/create operations) ────────────────────────────────

  async createAddress(fields) {
    const { text, values } = new QueryHelper(this.tables.ADDRESS).insert(fields).toParam()
    await this.runQuery(text, values, false)
  }

  async getAddressByFamily(familyUuid) {
    const { text, values } = new QueryHelper(this.tables.ADDRESS)
      .select('*')
      .where('entity_type',  '=', 'FAMILY')
      .where('entity_id',    '=', familyUuid)
      .where('address_type', '=', 'PERMANENT')
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0] ?? null
  }

  async getMailingAddressByFamily(familyUuid) {
    const { text, values } = new QueryHelper(this.tables.ADDRESS)
      .select('*')
      .where('entity_type',  '=', 'FAMILY')
      .where('entity_id',    '=', familyUuid)
      .where('address_type', '=', 'MAILING')
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0] ?? null
  }

  // ── Documents (for get operation) ──────────────────────────────────────

  async getDocumentsByFamily(familyUuid) {
    // document_verification table does not exist in the DB — query documents only
    const { text, values } = new QueryHelper(this.tables.DOCUMENTS)
      .select('*')
      .where('owner_type', '=', 'FAMILY')
      .where('owner_id',   '=', familyUuid)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    // Preserve the shape the rest of the codebase expects
    return rows.map(doc => ({ ...doc, document_verification: null }))
  }

  // ── History ────────────────────────────────────────────────────────────

  async getHistory(familyUuid) {
    const { text, values } = new QueryHelper(this.tables.FAMILY_HISTORY)
      .select('*')
      .where('family_uuid', '=', familyUuid)
      .orderBy('created_at', 'DESC')
      .toParam()
    return await this.runQuery(text, values, true)
  }

  async logHistory(fields) {
    const { text, values } = new QueryHelper(this.tables.FAMILY_HISTORY).insert(fields).toParam()
    return await this.runQuery(text, values, false)
  }

  // ── Event outbox ────────────────────────────────────────────────────────

  async publishEvent(fields) {
    const { text, values } = new QueryHelper(this.tables.FAMILY_EVENT_OUTBOX).insert(fields).toParam()
    return await this.runQuery(text, values, false)
  }
}
