/**
 * MemberRepository — all DB queries for the member feature
 */

import { BaseRepository } from '../../../../base/baseRepository.js'
import { QueryHelper }    from '../../../../base/queryHelper.js'

export class MemberRepository extends BaseRepository {
  constructor(context) {
    super(context)
  }

  async getFamilyById(familyUuid) {
    const { text, values } = new QueryHelper(this.tables.FAMILY)
      .select('uuid')
      .where('uuid', '=', familyUuid)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0] ?? null
  }

  async listByFamily(familyUuid) {
    const { text, values } = new QueryHelper(this.tables.FAMILY_MEMBER)
      .select('*')
      .where('family_uuid', '=', familyUuid)
      .orderBy('relationship_to_head', 'ASC')
      .orderBy('created_at', 'ASC')
      .toParam()
    return await this.runQuery(text, values, true)
  }

  async lookupByNationalId(nationalId) {
    const { text, values } = new QueryHelper(this.tables.FAMILY_MEMBER)
      .select('uuid, member_id, first_name, last_name, national_id, email, phone, family_uuid')
      .where('national_id', '=', nationalId)
      .limit(1)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0] ?? null
  }

  async getById(uuid) {
    const { text, values } = new QueryHelper(this.tables.FAMILY_MEMBER)
      .select('*')
      .where('uuid', '=', uuid)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0] ?? null
  }

  async getHeadByFamily(familyUuid) {
    const { text, values } = new QueryHelper(this.tables.FAMILY_MEMBER)
      .select('uuid')
      .where('family_uuid',          '=', familyUuid)
      .where('relationship_to_head', '=', 'head')
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0] ?? null
  }

  async create(fields) {
    const { text, values } = new QueryHelper(this.tables.FAMILY_MEMBER).insert(fields).toParam()
    await this.runQuery(text, values, false)
  }

  async update(uuid, updates) {
    const { text, values } = new QueryHelper(this.tables.FAMILY_MEMBER)
      .update(updates)
      .where('uuid', '=', uuid)
      .toParam()
    await this.runQuery(text, values, false)
  }

  async remove(uuid) {
    const { text, values } = new QueryHelper(this.tables.FAMILY_MEMBER).delete().where('uuid', '=', uuid).toParam()
    return await this.runQuery(text, values, false)
  }

  async logHistory(fields) {
    const { text, values } = new QueryHelper(this.tables.FAMILY_HISTORY).insert(fields).toParam()
    return await this.runQuery(text, values, false)
  }
}
