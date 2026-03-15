import { BaseRepository } from '../../../../base/baseRepository.js'
import { QueryHelper }   from '../../../../base/queryHelper.js'

export class EngineRepository extends BaseRepository {
  constructor(context) {
    super(context)
  }

  async upsertResult(record) {
    const { text: insText, values: insValues } = new QueryHelper(this.tables.PROGRAMME_CITIZENS)
      .insert(record)
      .toParam()

    try {
      await this.runQuery(insText, insValues, false)
    } catch (err) {
      if (err.code === '23505') {
        // Unique violation — update existing row
        const updateData = {}
        for (const [k, v] of Object.entries(record)) {
          if (k !== 'programme_id' && k !== 'subject_id') {
            updateData[k] = v
          }
        }
        const { text, values } = new QueryHelper(this.tables.PROGRAMME_CITIZENS)
          .update(updateData)
          .where('programme_id', '=', record.programme_id)
          .where('subject_id', '=', record.subject_id)
          .toParam()
        await this.runQuery(text, values, false)
      } else {
        throw err
      }
    }
  }

  async upsertResults(records) {
    if (records.length === 0) {
      return
    }
    for (const record of records) {
      await this.upsertResult(record)
    }
  }
}
