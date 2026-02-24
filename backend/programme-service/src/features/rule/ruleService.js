import { BaseService }   from '../../../../base/baseService.js'
import { RuleRepository } from './ruleRepository.js'

export class RuleService extends BaseService {
  constructor(repo) {
    super(repo.context)
    this.repo = repo
  }

  async listRules() { return this.repo.findAllRules() }
  async createRule(body) { return this.repo.createRule(body) }
  async listProgrammeRules(programmeId) { return this.repo.findProgrammeRules(programmeId) }

  async addProgrammeRule(programmeId, parsed) {
    const userId = this.getUserId()
    const data = await this.repo.addProgrammeRule({ programme_id: programmeId, ...parsed })
    await this.repo.recordRuleHistory({
      programme_id:  programmeId,
      rule_code:     parsed.rule_code,
      new_value:     data,
      rule_version:  parsed.rule_version,
      changed_by:    userId,
    })
    return data
  }

  async removeProgrammeRule(programmeId, ruleId) {
    const userId  = this.getUserId()
    const oldRule = await this.repo.findProgrammeRuleById(ruleId)
    await this.repo.deleteProgrammeRule(programmeId, ruleId)
    if (oldRule) {
      await this.repo.recordRuleHistory({
        programme_id: programmeId,
        rule_code:    oldRule.rule_code,
        old_value:    oldRule,
        changed_by:   userId,
      })
    }
  }

  async listVersions() { return this.repo.findAllVersions() }
  async createVersion(parsed) { return this.repo.createVersion(parsed) }
}
