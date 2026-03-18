/**
 * AuthRepository — DB queries for family auth enrichment
 */

import { BaseRepository } from '../../../../base/baseRepository.js'
import { QueryHelper }    from '../../../../base/queryHelper.js'

export class AuthRepository extends BaseRepository {
  constructor(context) {
    super(context)
  }

  async getMemberByNationalId(nationalId) {
    const { text, values } = new QueryHelper(this.tables.FAMILY_MEMBER)
      .select('*')
      .where('national_id', '=', nationalId)
      .orderBy('created_at', 'DESC')
      .limit(1)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0]
  }

  async getFamilyByUuid(familyUuid) {
    const { text, values } = new QueryHelper(this.tables.FAMILY)
      .select('uuid, family_id, status, registration_status, household_size, created_at')
      .where('uuid', '=', familyUuid)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0]
  }

  async getFamilyFullByUuid(familyUuid) {
    const { text, values } = new QueryHelper(this.tables.FAMILY)
      .select('uuid, family_id, head_member_id, household_size, geo_code, vulnerability_flag, status, intake_channel, registration_status, submitted_at, verified_at, created_at, updated_at')
      .where('uuid', '=', familyUuid)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0]
  }

  async getFamilyByFamilyId(familyId) {
    const { text, values } = new QueryHelper(this.tables.FAMILY)
      .select('uuid')
      .where('family_id', '=', familyId)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0] ?? null
  }

  async getHeadMemberByFamily(familyUuid) {
    const { text, values } = new QueryHelper(this.tables.FAMILY_MEMBER)
      .select('uuid, member_id, first_name, last_name, national_id')
      .where('family_uuid',          '=', familyUuid)
      .where('relationship_to_head', '=', 'head')
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0] ?? null
  }
}
