import { BaseController } from '../../../../base/baseController.js'
import { AuditRepository } from './auditRepository.js'

export class AuditController extends BaseController {
  constructor(ctx) {
    super(ctx)
    this.repo = new AuditRepository(ctx)
  }

  async programmeHistory() {
    try {
      const data = await this.repo.findProgrammeHistory(this.context.request.params.programmeId)
      this.respondOk({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async rulesHistory() {
    try {
      const data = await this.repo.findRulesHistory(this.context.request.params.programmeId)
      this.respondOk({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async exitsHistory() {
    try {
      const data = await this.repo.findExitHistory(this.context.request.params.programmeId)
      this.respondOk({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async allHistory() {
    try {
      const data = await this.repo.findAllHistory()
      this.respondOk({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }
}
