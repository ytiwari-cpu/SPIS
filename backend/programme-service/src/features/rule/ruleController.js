import { BaseController } from '../../../../base/baseController.js'
import { RuleService }    from './ruleService.js'

export class RuleController extends BaseController {
  constructor(context) {
    super(context)
    this.ruleService = new RuleService(context)
  }

  async listRules() {
    try {
      const data = await this.ruleService.listRules()
      this.respondOk({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async createRule(body) {
    try {
      const data = await this.ruleService.createRule(body)
      this.respondCreated({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async listProgrammeRules(params) {
    try {
      const data = await this.ruleService.listProgrammeRules(params.programmeId)
      this.respondOk({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async addProgrammeRule(params, body) {
    try {
      const data = await this.ruleService.addProgrammeRule(params.programmeId, body)
      this.respondCreated({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async removeProgrammeRule(params) {
    try {
      await this.ruleService.removeProgrammeRule(params.programmeId, params.ruleId)
      this.respondOk({ success: true, message: 'Rule removed from programme' })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async listVersions() {
    try {
      const data = await this.ruleService.listVersions()
      this.respondOk({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async createVersion(body) {
    try {
      const data = await this.ruleService.createVersion(body)
      this.respondCreated({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }
}
