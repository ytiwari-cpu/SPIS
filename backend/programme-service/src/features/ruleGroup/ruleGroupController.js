import { BaseController }       from '../../../../base/baseController.js'
import { RuleGroupService }     from './ruleGroupService.js'
import { RuleGroupRepository }  from './ruleGroupRepository.js'
import {
  createRuleGroupSchema,
  updateRuleGroupSchema,
  addRuleGroupRuleSchema,
} from '../../validators/programme.validators.js'

export class RuleGroupController extends BaseController {
  constructor(ctx) {
    super(ctx)
    const repo = new RuleGroupRepository(ctx)
    this.service = new RuleGroupService(repo)
  }

  async list() {
    try {
      this.respondOk({ success: true, data: await this.service.list() })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async get() {
    try {
      const data = await this.service.getById(this.context.request.params.id)
      if (!data) { this.respondNotFound({ success: false, error: 'Rule group not found' }); return }
      this.respondOk({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async create() {
    try {
      const parsed = createRuleGroupSchema.parse(this.context.request.body)
      this.respondCreated({ success: true, data: await this.service.create(parsed) })
    } catch (err) {
      if (err?.name === 'ZodError') { this.respondBadRequest({ success: false, error: 'Validation failed', details: err }); return }
      this.respondError({ success: false, error: err.message })
    }
  }

  async update() {
    try {
      const parsed = updateRuleGroupSchema.parse(this.context.request.body)
      this.respondOk({ success: true, data: await this.service.update(this.context.request.params.id, parsed) })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async delete() {
    try {
      await this.service.deactivate(this.context.request.params.id)
      this.respondOk({ success: true, message: 'Rule group deactivated' })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async addSubRule() {
    try {
      const parsed = addRuleGroupRuleSchema.parse(this.context.request.body)
      this.respondCreated({ success: true, data: await this.service.addSubRule(this.context.request.params.id, parsed) })
    } catch (err) {
      if (err?.name === 'ZodError') { this.respondBadRequest({ success: false, error: 'Validation failed', details: err }); return }
      this.respondError({ success: false, error: err.message })
    }
  }

  async removeSubRule() {
    try {
      await this.service.removeSubRule(this.context.request.params.groupId, this.context.request.params.ruleId)
      this.respondOk({ success: true, message: 'Sub-rule removed' })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }
}
