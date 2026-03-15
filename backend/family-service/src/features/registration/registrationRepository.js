/**
 * Registration Repository
 *
 * All database operations for the 9-step family registration wizard.
 */

import { BaseRepository } from '../../../../base/baseRepository.js'
import { QueryHelper }    from '../../../../base/queryHelper.js'

export class RegistrationRepository extends BaseRepository {
  constructor(context) {
    super(context)
  }

  // ─── FAMILY ──────────────────────────────────────────────

  async findFamilyByUuid(uuid) {
    const { text, values } = new QueryHelper(this.tables.FAMILY)
      .select('*')
      .where('uuid', '=', uuid)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0] ?? null
  }

  async createFamily(data) {
    const { text, values } = new QueryHelper(this.tables.FAMILY).insert(data).toParam()
    await this.runQuery(text, values, false)
  }

  async updateFamily(uuid, data) {
    const { text, values } = new QueryHelper(this.tables.FAMILY)
      .update(data)
      .where('uuid', '=', uuid)
      .toParam()
    await this.runQuery(text, values, false)
  }

  async generateFamilyId() {
    try {
      const rows = await this.runQuery('SELECT generate_family_id() as family_id', [], true)
      if (rows[0]?.family_id) {
        return rows[0].family_id
      }
    } catch { /* fallback */ }
    const rows  = await this.runQuery(`SELECT COUNT(*)::int as cnt FROM ${this.tables.FAMILY}`, [], true)
    const count = (rows[0]?.cnt || 0) + 1
    return `F${count}`
  }

  // ─── ADDRESS (polymorphic) ───────────────────────────────

  async findAddress(entityType, entityId, addressType) {
    const { text, values } = new QueryHelper(this.tables.ADDRESS)
      .select('*')
      .where('entity_type',  '=', entityType)
      .where('entity_id',    '=', entityId)
      .where('address_type', '=', addressType)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0] ?? null
  }

  async findAddressById(addressId) {
    const { text, values } = new QueryHelper(this.tables.ADDRESS)
      .select('*')
      .where('address_id', '=', addressId)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0] ?? null
  }

  async createAddress(data) {
    const { text, values } = new QueryHelper(this.tables.ADDRESS).insert(data).toParam()
    await this.runQuery(text, values, false)
  }

  async updateAddress(addressId, data) {
    const { text, values } = new QueryHelper(this.tables.ADDRESS)
      .update(data)
      .where('address_id', '=', addressId)
      .toParam()
    await this.runQuery(text, values, false)
  }

  async deleteAddress(entityType, entityId, addressType) {
    const { text, values } = new QueryHelper(this.tables.ADDRESS)
      .delete()
      .where('entity_type',  '=', entityType)
      .where('entity_id',    '=', entityId)
      .where('address_type', '=', addressType)
      .toParam()
    return await this.runQuery(text, values, false)
  }

  async findAddressesByMembers(memberUuids) {
    if (!memberUuids.length) {
      return []
    }
    const { text, values } = new QueryHelper(this.tables.ADDRESS)
      .select('*')
      .where('entity_type', '=', 'MEMBER')
      .whereIn('entity_id', memberUuids)
      .toParam()
    return await this.runQuery(text, values, true)
  }

  // ─── MEMBERS ─────────────────────────────────────────────

  async findMemberByUuid(uuid) {
    const { text, values } = new QueryHelper(this.tables.FAMILY_MEMBER)
      .select('*')
      .where('uuid', '=', uuid)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0] ?? null
  }

  async findMembersByFamily(familyUuid) {
    const { text, values } = new QueryHelper(this.tables.FAMILY_MEMBER)
      .select('*')
      .where('family_uuid', '=', familyUuid)
      .toParam()
    return await this.runQuery(text, values, true)
  }

  async countMembersByFamily(familyUuid) {
    const { text, values } = new QueryHelper(this.tables.FAMILY_MEMBER)
      .count()
      .where('family_uuid', '=', familyUuid)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return parseInt(rows[0]?.count ?? '0', 10)
  }

  async createMember(data) {
    const { text, values } = new QueryHelper(this.tables.FAMILY_MEMBER).insert(data).toParam()
    await this.runQuery(text, values, false)
  }

  async updateMember(uuid, data) {
    const { text, values } = new QueryHelper(this.tables.FAMILY_MEMBER)
      .update(data)
      .where('uuid', '=', uuid)
      .toParam()
    await this.runQuery(text, values, false)
  }

  async deleteMemberHard(uuid) {
    const { text, values } = new QueryHelper(this.tables.FAMILY_MEMBER)
      .delete()
      .where('uuid', '=', uuid)
      .toParam()
    return await this.runQuery(text, values, false)
  }

  async findMemberByNationalId(nationalId) {
    const { text, values } = new QueryHelper(this.tables.FAMILY_MEMBER)
      .select('*')
      .where('national_id', '=', nationalId)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0] ?? null
  }

  async findMemberWithFamily(memberUuid) {
    const { text, values } = new QueryHelper(this.tables.FAMILY_MEMBER)
      .select('m')
      .field('m.*')
      .field('f.uuid',   'family_uuid_fk')
      .field('f.status', 'family_status')
      .join(this.tables.FAMILY, 'f', 'f.uuid = m.family_uuid')
      .where('m.uuid', '=', memberUuid)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0] ?? null
  }

  // ─── DOCUMENTS (polymorphic) ──────────────────────────────

  async findDocumentsByOwner(ownerType, ownerId) {
    const { text, values } = new QueryHelper(this.tables.DOCUMENTS)
      .select('*')
      .where('owner_type', '=', ownerType)
      .where('owner_id',   '=', ownerId)
      .toParam()
    return await this.runQuery(text, values, true)
  }

  async createDocument(data) {
    const { text, values } = new QueryHelper(this.tables.DOCUMENTS).insert(data).toParam()
    await this.runQuery(text, values, false)
  }

  async countDocumentsByOwner(ownerType, ownerId) {
    const { text, values } = new QueryHelper(this.tables.DOCUMENTS)
      .count()
      .where('owner_type', '=', ownerType)
      .where('owner_id',   '=', ownerId)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return parseInt(rows[0]?.count ?? '0', 10)
  }

  // ─── HOUSE SERVICES ──────────────────────────────────────

  async findHouseServices(familyUuid) {
    const { text, values } = new QueryHelper(this.tables.HOUSE_SERVICES)
      .select('*')
      .where('family_uuid', '=', familyUuid)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0] ?? null
  }

  async createHouseServices(data) {
    const { text, values } = new QueryHelper(this.tables.HOUSE_SERVICES).insert(data).toParam()
    await this.runQuery(text, values, false)
  }

  async updateHouseServices(serviceId, data) {
    const { text, values } = new QueryHelper(this.tables.HOUSE_SERVICES)
      .update(data)
      .where('service_id', '=', serviceId)
      .toParam()
    await this.runQuery(text, values, false)
  }

  async deleteHouseServices(familyUuid) {
    const { text, values } = new QueryHelper(this.tables.HOUSE_SERVICES)
      .delete()
      .where('family_uuid', '=', familyUuid)
      .toParam()
    return await this.runQuery(text, values, false)
  }

  // ─── HISTORY ──────────────────────────────────────────────

  async insertHistory(data) {
    const { text, values } = new QueryHelper(this.tables.FAMILY_HISTORY).insert(data).toParam()
    await this.runQuery(text, values, false)
  }

  // ─── TRANSFER LOG ─────────────────────────────────────────

  async findTransferLog(memberUuid) {
    const { text, values } = new QueryHelper('member_transfer_log')
      .select('*')
      .where('member_uuid', '=', memberUuid)
      .orderBy('created_at', 'DESC')
      .toParam()
    return await this.runQuery(text, values, true)
  }

  async insertTransferLog(data) {
    const { text, values } = new QueryHelper('member_transfer_log').insert(data).toParam()
    await this.runQuery(text, values, false)
  }
}
