import { BaseController } from '../../../../base/baseController.js'
import { AuditService }   from './auditService.js'

export class AuditController extends BaseController {
  constructor(context) {
    super(context)
    this.auditService = new AuditService(context)
  }

  async programmeHistory(params) {
    try {
      const data = await this.auditService.getProgrammeHistory(params.programmeId)
      this.respondOk({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async rulesHistory(params) {
    try {
      const data = await this.auditService.getRulesHistory(params.programmeId)
      this.respondOk({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async exitsHistory(params) {
    try {
      const data = await this.auditService.getExitHistory(params.programmeId)
      this.respondOk({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async allHistory() {
    try {
      const data = await this.auditService.getAllHistory()
      this.respondOk({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }
}
