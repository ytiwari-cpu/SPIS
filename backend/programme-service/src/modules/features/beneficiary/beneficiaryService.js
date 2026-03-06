import { BaseService } from '../../../../../base/baseService.js'
import { BeneficiaryRepository } from './beneficiaryRepository.js'

const VALID_STATUSES = ['Active', 'Suspended', 'Exited', 'Pending']

export class BeneficiaryService extends BaseService {
  constructor(repo) {
    super(repo.context)
    this.repo = repo
  }

  async listBySubject(subjectId) { return this.repo.findBySubject(subjectId) }
  async listByProgramme(programmeId) { return this.repo.findByProgramme(programmeId) }

  async enroll(programmeId, parsed) {
    const userId = this.getUserId()
    return this.repo.enroll({ programme_id: programmeId, ...parsed, status: 'Pending', approved_by: userId })
  }

  async updateStatus(programmeId, subjectId, status, exitReason, remarks) {
    if (!VALID_STATUSES.includes(status)) {
      return { valid: false }
    }
    const userId = this.getUserId()
    const payload = { status }
    if (status === 'Active') {
      payload.approved_at = new Date().toISOString()
      payload.approved_by = userId
    }
    const data = await this.repo.updateStatus(programmeId, subjectId, payload)
    if (status === 'Exited') {
      await this.repo.recordExit({
        programme_id: programmeId, subject_id: subjectId,
        subject_type: data.subject_type, exit_reason: exitReason || 'Manual exit',
        remarks, exited_by: userId,
      })
    }
    return { valid: true, data }
  }
}
