import { BaseRepository } from '../../../../base/baseRepository.js'
import { QueryHelper }   from '../../../../base/queryHelper.js'

export class VariableRepository extends BaseRepository {
  constructor(context) {
    super(context)
  }

  async findActiveRuleGroups() {
    const { text, values } = new QueryHelper(this.tables.RULE_GROUP)
      .select('rule_group_id, group_code, group_name, scoring_method')
      .where('is_active', '=', true)
      .toParam()
    return await this.runQuery(text, values, true)
  }
}
