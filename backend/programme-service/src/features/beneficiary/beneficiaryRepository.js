import { BaseRepository } from '../../../../base/baseRepository.js'
import { QueryHelper }   from '../../../../base/queryHelper.js'

export class BeneficiaryRepository extends BaseRepository {
  constructor(context) {
    super(context)
  }

  async findBySubject(subjectId) {
    const { text, values } = new QueryHelper(this.tables.PROGRAMME_CITIZENS)
      .select('pc')
      .field('pc.*')
      .field('row_to_json(pm.*)', 'programme')
      .left_join(this.tables.PROGRAMME_MASTER, 'pm', 'pm.programme_id = pc.programme_id')
      .where('pc.subject_id', '=', subjectId)
      .orderBy('pc.created_at', 'DESC')
      .toParam()
    return await this.runQuery(text, values, true)
  }

  async findByProgramme(programmeId) {
    const { text, values } = new QueryHelper(this.tables.PROGRAMME_CITIZENS)
      .select('*')
      .where('programme_id', '=', programmeId)
      .orderBy('created_at', 'DESC')
      .toParam()
    return await this.runQuery(text, values, true)
  }

  async enroll(fields) {
    const { text, values } = new QueryHelper(this.tables.PROGRAMME_CITIZENS).insert(fields).toParam()
    await this.runQuery(text, values, false)
  }

  async updateStatus(programmeId, subjectId, payload) {
    const { text, values } = new QueryHelper(this.tables.PROGRAMME_CITIZENS)
      .update(payload)
      .where('programme_id', '=', programmeId)
      .where('subject_id',   '=', subjectId)
      .toParam()
    await this.runQuery(text, values, false)
  }

  async recordExit(entry) {
    const { text, values } = new QueryHelper(this.tables.PROGRAMME_EXIT_HISTORY).insert(entry).toParam()
    return await this.runQuery(text, values, false)
  }
}
