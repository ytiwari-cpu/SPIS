import { BaseController } from '../../../../../base/baseController.js'
import { BeneficiaryService } from './beneficiaryService.js'
import { BeneficiaryRepository } from './beneficiaryRepository.js'

export class BeneficiaryController extends BaseController {
  constructor(ctx) {
    super(ctx)
    const repo = new BeneficiaryRepository(ctx)
    this.service = new BeneficiaryService(repo)
  }

  async listBySubject() {
    try {
      const data = await this.service.listBySubject(this.context.request.params.subjectId)
      this.respondOk({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async listByProgramme() {
    try {
      const data = await this.service.listByProgramme(this.context.request.params.programmeId)
      this.respondOk({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async enroll() {
    try {
      const data = await this.service.enroll(
        this.context.request.params.programmeId,
        this.context.request.body,
      )
      this.respondCreated({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async updateStatus() {
    try {
      const { status, exit_reason, remarks } = this.context.request.body
      const { programmeId, subjectId } = this.context.request.params
      const result = await this.service.updateStatus(programmeId, subjectId, status, exit_reason, remarks)
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
