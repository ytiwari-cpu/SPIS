import { BaseController }   from '../../../../base/baseController.js'
import { RuleGroupService } from './ruleGroupService.js'

export class RuleGroupController extends BaseController {
  constructor(context) {
    super(context)
    this.ruleGroupService = new RuleGroupService(context)
  }

  async list() {
    try {
      this.respondOk({ success: true, data: await this.ruleGroupService.list() })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async get(params) {
    try {
      const data = await this.ruleGroupService.getById(params.id)
      if (!data) {
        this.respondNotFound({ success: false, error: 'Rule group not found' })
        return
      }
      this.respondOk({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async create(body) {
    try {
      this.respondCreated({ success: true, data: await this.ruleGroupService.create(body) })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async update(params, body) {
    try {
      this.respondOk({ success: true, data: await this.ruleGroupService.update(params.id, body) })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async delete(params) {
    try {
      await this.ruleGroupService.deactivate(params.id)
      this.respondOk({ success: true, message: 'Rule group deactivated' })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async addSubRule(params, body) {
    try {
      this.respondCreated({ success: true, data: await this.ruleGroupService.addSubRule(params.id, body) })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async removeSubRule(params) {
    try {
      await this.ruleGroupService.removeSubRule(params.groupId, params.ruleId)
      this.respondOk({ success: true, message: 'Sub-rule removed' })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }
}
