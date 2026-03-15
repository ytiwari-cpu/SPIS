import { BaseService } from '../../../../base/baseService.js'
import { BeneficiaryRepository } from './beneficiaryRepository.js'

const VALID_STATUSES = ['Active', 'Suspended', 'Exited', 'Pending']

export class BeneficiaryService extends BaseService {
  constructor(context) {
    super(context)
    this.beneficiaryRepository = new BeneficiaryRepository(context)
  }

  async listBySubject(subjectId) {
    return await this.beneficiaryRepository.findBySubject(subjectId)
  }
  async listByProgramme(programmeId) {
    return await this.beneficiaryRepository.findByProgramme(programmeId)
  }

  async enroll(programmeId, parsed) {
    const userId = this.getUserId()
    await this.beneficiaryRepository.enroll({ programme_id: programmeId, ...parsed, status: 'Pending', approved_by: userId })
  }

  async updateStatus(programmeId, subjectId, status, exitReason, remarks) {
    if (!VALID_STATUSES.includes(status)) {
      return { valid: false }
    }
    const userId = this.getUserId()
    const payload = { status, updated_at: new Date().toISOString() }
    if (status === 'Active') {
      payload.approved_at = new Date().toISOString()
      payload.approved_by = userId
    }
    await this.beneficiaryRepository.updateStatus(programmeId, subjectId, payload)

    if (status === 'Exited') {
      await this.beneficiaryRepository.recordExit({
        programme_id: programmeId, subject_id:   subjectId,
        exit_reason:  exitReason || 'Manual exit',
        remarks, exited_by:    userId,
      })
    }
    return { valid: true }
  }
}
