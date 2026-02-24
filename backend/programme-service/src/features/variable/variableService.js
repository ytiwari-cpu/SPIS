import { BaseService }      from '../../../../base/baseService.js'
import { VariableRepository } from './variableRepository.js'
import { getAllVariables, getVariablesByCategory } from '../../services/variableCatalog.js'

export class VariableService extends BaseService {
  constructor(repo) {
    super(repo.context)
    this.repo = repo
  }

  async listAll() {
    const variables  = await getAllVariables()
    const ruleGroups = await this.repo.findActiveRuleGroups()
    const computedVars = ruleGroups.map(g => ({
      variable_code:  `${g.group_code}_SCORE`,
      display_name:   `${g.group_name} Score`,
      category:       'Computed Score',
      data_type:      'number',
      source_table:   'rule_group',
      source_column:  g.rule_group_id,
      enum_values:    null,
      is_system_field: false,
      is_active:      true,
    }))
    return [...variables, ...computedVars]
  }

  async listGrouped() { return getVariablesByCategory() }
  async refresh()     { return getAllVariables() }
}
