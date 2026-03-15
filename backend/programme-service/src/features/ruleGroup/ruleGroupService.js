import { BaseService }        from '../../../../base/baseService.js'
import { RuleGroupRepository } from './ruleGroupRepository.js'

export class RuleGroupService extends BaseService {
  constructor(context) {
    super(context)
    this.ruleGroupRepository = new RuleGroupRepository(context)
  }

  async list() {
    return await this.ruleGroupRepository.findAll()
  }
  async getById(groupId) {
    return await this.ruleGroupRepository.findById(groupId)
  }

  async create(parsed) {
    const userId  = this.getUserId()
    const groupId = RuleGroupService.generateUUID()
    await this.ruleGroupRepository.create({ rule_group_id: groupId, ...parsed, created_by: userId, updated_by: userId })
    return this.ruleGroupRepository.findById(groupId)
  }

  async update(groupId, parsed) {
    const userId = this.getUserId()
    await this.ruleGroupRepository.update(groupId, {
      ...parsed, updated_by: userId, updated_at: new Date().toISOString(),
    })
    return this.ruleGroupRepository.findById(groupId)
  }

  async deactivate(groupId) {
    await this.ruleGroupRepository.deactivate(groupId, new Date().toISOString())
  }

  async addSubRule(groupId, parsed) {
    await this.ruleGroupRepository.addSubRule({ rule_group_id: groupId, ...parsed })
    return this.ruleGroupRepository.findById(groupId)
  }

  async removeSubRule(groupId, ruleId) {
    await this.ruleGroupRepository.removeSubRule(groupId, ruleId)
  }
}
