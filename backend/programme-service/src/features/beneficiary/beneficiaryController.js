import { BaseController }   from '../../../../base/baseController.js'
import { BeneficiaryService } from './beneficiaryService.js'

export class BeneficiaryController extends BaseController {
  constructor(context) {
    super(context)
    this.beneficiaryService = new BeneficiaryService(context)
  }

  async listBySubject(params) {
    try {
      const data = await this.beneficiaryService.listBySubject(params.subjectId)
      this.respondOk({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async listByProgramme(params) {
    try {
      const data = await this.beneficiaryService.listByProgramme(params.programmeId)
      this.respondOk({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async enroll(params, body) {
    try {
      const data = await this.beneficiaryService.enroll(params.programmeId, body)
      this.respondCreated({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async updateStatus(params, body) {
    try {
      const { status, exit_reason, remarks } = body
      const result = await this.beneficiaryService.updateStatus(
        params.programmeId, params.subjectId, status, exit_reason, remarks,
      )
      if (!result.valid) {
        this.respondBadRequest({ success: false, error: 'Invalid status' })
        return
      }
      this.respondOk({ success: true, data: result.data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }
}
