import { BaseService }   from '../../../../base/baseService.js'
import { RuleRepository } from './ruleRepository.js'

export class RuleService extends BaseService {
  constructor(context) {
    super(context)
    this.ruleRepository = new RuleRepository(context)
  }

  async listRules() {
    return await this.ruleRepository.findAllRules()
  }

  async createRule(body) {
    await this.ruleRepository.createRule(body)
  }

  async listProgrammeRules(programmeId) {
    return await this.ruleRepository.findProgrammeRules(programmeId)
  }

  async addProgrammeRule(programmeId, parsed) {
    const userId = this.getUserId()
    await this.ruleRepository.addProgrammeRule({ programme_id: programmeId, ...parsed })
    await this.ruleRepository.recordRuleHistory({
      programme_id: programmeId,
      rule_code:    parsed.rule_code,
      new_value:    parsed,
      rule_version: parsed.rule_version,
      changed_by:   userId,
    })
  }

  async removeProgrammeRule(programmeId, ruleId) {
    const userId  = this.getUserId()
    const oldRule = await this.ruleRepository.findProgrammeRuleById(ruleId)
    await this.ruleRepository.deleteProgrammeRule(programmeId, ruleId)
    if (oldRule) {
      await this.ruleRepository.recordRuleHistory({
        programme_id: programmeId,
        rule_code:    oldRule.rule_code,
        old_value:    oldRule,
        changed_by:   userId,
      })
    }
  }

  async listVersions() {
    return await this.ruleRepository.findAllVersions()
  }
  async createVersion(parsed) {
    await this.ruleRepository.createVersion(parsed)
  }
}
