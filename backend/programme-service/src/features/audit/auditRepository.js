import { BaseRepository } from '../../../../base/baseRepository.js'
import { QueryHelper }   from '../../../../base/queryHelper.js'

export class AuditRepository extends BaseRepository {
  constructor(context) {
    super(context)
  }

  async findProgrammeHistory(programmeId) {
    const { text, values } = new QueryHelper(this.tables.PROGRAMME_HISTORY)
      .select('*')
      .where('programme_id', '=', programmeId)
      .orderBy('changed_at', 'DESC')
      .limit(100)
      .toParam()
    return await this.runQuery(text, values, true)
  }

  async findRulesHistory(programmeId) {
    const { text, values } = new QueryHelper(this.tables.PROGRAMME_RULES_HISTORY)
      .select('*')
      .where('programme_id', '=', programmeId)
      .orderBy('changed_at', 'DESC')
      .limit(100)
      .toParam()
    return await this.runQuery(text, values, true)
  }

  async findExitHistory(programmeId) {
    const { text, values } = new QueryHelper(this.tables.PROGRAMME_EXIT_HISTORY)
      .select('*')
      .where('programme_id', '=', programmeId)
      .orderBy('exited_at', 'DESC')
      .limit(100)
      .toParam()
    return await this.runQuery(text, values, true)
  }

  async findAllHistory() {
    const { text, values } = new QueryHelper(this.tables.PROGRAMME_HISTORY)
      .select('*')
      .orderBy('changed_at', 'DESC')
      .limit(200)
      .toParam()
    return await this.runQuery(text, values, true)
  }
}
