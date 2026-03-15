/**
 * CitizensRepository — all DB queries for the citizens feature
 */

import { BaseRepository } from '../../../../base/baseRepository.js'
import { QueryHelper }    from '../../../../base/queryHelper.js'

const FIELDS = 'uuid, member_id, family_uuid, national_id, first_name, last_name, date_of_birth, gender, relationship_to_head, alive_flag, marital_status, phone, email, member_status, created_at, updated_at'

export class CitizensRepository extends BaseRepository {
  constructor(context) {
    super(context)
  }

  async list({ page, limit, status, gender, search }) {
    const offset     = (page - 1) * limit
    const conditions = []
    const params     = []

    if (status) {
      conditions.push(`member_status = $${params.length + 1}`)
      params.push(status)
    }
    if (gender) {
      conditions.push(`gender = $${params.length + 1}`)
      params.push(gender)
    }
    if (search) {
      const p = `%${search}%`
      const n = params.length + 1
      conditions.push(`(first_name ILIKE $${n} OR last_name ILIKE $${n} OR email ILIKE $${n} OR national_id ILIKE $${n} OR member_id ILIKE $${n})`)
      params.push(p)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const countRows = await this.runQuery(`SELECT COUNT(*) AS count FROM ${this.tables.FAMILY_MEMBER} ${where}`, params, true)
    const count     = parseInt(countRows[0]?.count ?? '0', 10)

    const dataParams = [...params, limit, offset]
    const rows = await this.runQuery(
      `SELECT ${FIELDS} FROM ${this.tables.FAMILY_MEMBER} ${where} ORDER BY created_at DESC LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams,
      true,
    )
    return { data: rows, count }
  }

  async getById(uuid) {
    const { text, values } = new QueryHelper(this.tables.FAMILY_MEMBER)
      .select(FIELDS)
      .where('uuid', '=', uuid)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0] ?? null
  }
}
