/**
 * AddressRepository — all DB queries for the address feature
 */

import { BaseRepository } from '../../../../base/baseRepository.js'
import { QueryHelper }    from '../../../../base/queryHelper.js'

export class AddressRepository extends BaseRepository {
  constructor(context) {
    super(context)
  }

  async getById(addressId) {
    const { text, values } = new QueryHelper(this.tables.ADDRESS)
      .select('*')
      .where('address_id', '=', addressId)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0] ?? null
  }

  async create(fields) {
    const { text, values } = new QueryHelper(this.tables.ADDRESS).insert(fields).toParam()
    await this.runQuery(text, values, false)
  }

  async update(addressId, updates) {
    const { text, values } = new QueryHelper(this.tables.ADDRESS)
      .update(updates)
      .where('address_id', '=', addressId)
      .toParam()
    await this.runQuery(text, values, false)
  }

  async remove(addressId) {
    const { text, values } = new QueryHelper(this.tables.ADDRESS)
      .delete()
      .where('address_id', '=', addressId)
      .toParam()
    return await this.runQuery(text, values, false)
  }

  async getFamilyRef(addressId) {
    const { text, values } = new QueryHelper(this.tables.FAMILY)
      .select('family_id')
      .where('permanent_address_id', '=', addressId)
      .limit(1)
      .toParam()
    return await this.runQuery(text, values, true)
  }

  async getMemberRef(addressId) {
    const { text, values } = new QueryHelper(this.tables.FAMILY_MEMBER)
      .select('member_id')
      .where('current_address_id', '=', addressId)
      .limit(1)
      .toParam()
    return await this.runQuery(text, values, true)
  }
}
