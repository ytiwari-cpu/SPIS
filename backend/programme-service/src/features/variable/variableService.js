import { BaseService }      from '../../../../base/baseService.js'
import { VariableRepository } from './variableRepository.js'
import { getAllVariables, getVariablesByCategory } from '../../services/variableCatalog.js'

export class VariableService extends BaseService {
  constructor(context) {
    super(context)
    this.variableRepository = new VariableRepository(context)
  }

  async listAll() {
    const variables  = await getAllVariables()
    const ruleGroups = await this.variableRepository.findActiveRuleGroups()
    const computedVars = ruleGroups.map(g => ({
      variable_code:   `${g.group_code}_SCORE`,
      display_name:    `${g.group_name} Score`,
      category:        'Computed Score',
      data_type:       'number',
      source_table:    'rule_group',
      source_column:   g.rule_group_id,
      enum_values:     null,
      is_system_field: false,
      is_active:       true,
    }))
    return [...variables, ...computedVars]
  }

  async listGrouped() {
    return await getVariablesByCategory()
  }
  async refresh()     {
    return await getAllVariables()
  }
}
