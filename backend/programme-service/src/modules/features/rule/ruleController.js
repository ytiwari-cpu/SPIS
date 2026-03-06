import { BaseController }  from '../../../../../base/baseController.js'
import { RuleService }     from './ruleService.js'
import { RuleRepository }  from './ruleRepository.js'

export class RuleController extends BaseController {
  constructor(ctx) {
    super(ctx)
    const repo = new RuleRepository(ctx)
    this.service = new RuleService(repo)
  }

  async listRules() {
    try {
      const data = await this.service.listRules()
      this.respondOk({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async createRule() {
    try {
      const data = await this.service.createRule(this.context.request.body)
      this.respondCreated({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async listProgrammeRules() {
    try {
      const data = await this.service.listProgrammeRules(this.context.request.params.programmeId)
      this.respondOk({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async addProgrammeRule() {
    try {
      const data = await this.service.addProgrammeRule(this.context.request.params.programmeId, this.context.request.body)
      this.respondCreated({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async removeProgrammeRule() {
    try {
      await this.service.removeProgrammeRule(
        this.context.request.params.programmeId,
        this.context.request.params.ruleId,
      )
      this.respondOk({ success: true, message: 'Rule removed from programme' })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async listVersions() {
    try {
      const data = await this.service.listVersions()
      this.respondOk({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async createVersion() {
    try {
      const data = await this.service.createVersion(this.context.request.body)
      this.respondCreated({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }
}
