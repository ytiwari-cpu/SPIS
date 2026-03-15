import { BaseRepository } from '../../../../base/baseRepository.js'
import { QueryHelper }   from '../../../../base/queryHelper.js'

export class ProgrammeManagerRepository extends BaseRepository {
  constructor(context) {
    super(context)
  }

  async findByProgramme(programmeId) {
    const { text, values } = new QueryHelper(this.tables.PROGRAMME_MANAGER_LINK)
      .select('*')
      .where('programme_id', '=', programmeId)
      .orderBy('created_at')
      .toParam()
    return await this.runQuery(text, values, true)
  }

  async addLink(fields) {
    const { text, values } = new QueryHelper(this.tables.PROGRAMME_MANAGER_LINK).insert(fields).toParam()
    await this.runQuery(text, values, false)
  }

  async removeLink(programmeId, userId) {
    const { text, values } = new QueryHelper(this.tables.PROGRAMME_MANAGER_LINK)
      .delete()
      .where('programme_id', '=', programmeId)
      .where('user_id',      '=', userId)
      .toParam()
    return await this.runQuery(text, values, false)
  }

  async findProgrammeCreator(programmeId) {
    const { text, values } = new QueryHelper(this.tables.PROGRAMME_MASTER)
      .select('created_by')
      .where('programme_id', '=', programmeId)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0]?.created_by ?? null
  }

  async isManager(programmeId, userId) {
    const { text, values } = new QueryHelper(this.tables.PROGRAMME_MANAGER_LINK)
      .select('id')
      .where('programme_id', '=', programmeId)
      .where('user_id',      '=', userId)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows.length > 0
  }
}
