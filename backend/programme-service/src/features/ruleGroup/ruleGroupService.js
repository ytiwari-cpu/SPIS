import { BaseService }        from '../../../../base/baseService.js'
import { RuleGroupRepository } from './ruleGroupRepository.js'

export class RuleGroupService extends BaseService {
  constructor(repo) {
    super(repo.context)
    this.repo = repo
  }

  async list() { return this.repo.findAll() }
  async getById(groupId) { return this.repo.findById(groupId) }

  async create(parsed) {
    const userId = this.getUserId()
    return this.repo.create({ ...parsed, created_by: userId, updated_by: userId })
  }

  async update(groupId, parsed) {
    const userId = this.getUserId()
    return this.repo.update(groupId, { ...parsed, updated_by: userId, updated_at: new Date().toISOString() })
  }

  async deactivate(groupId) { await this.repo.deactivate(groupId) }

  async addSubRule(groupId, parsed) {
    return this.repo.addSubRule({ rule_group_id: groupId, ...parsed })
  }

  async removeSubRule(groupId, ruleId) { await this.repo.removeSubRule(groupId, ruleId) }
}
