/**
 * AuditService — business logic for audit log queries.
 *
 * Thin wrapper over AuditRepository — added for layer completeness.
 * No business rules currently — just delegates to repo.
 */

import { BaseService } from '../../../../base/baseService.js'
import { AuditRepository } from './auditRepository.js'

export class AuditService extends BaseService {
  /** @param {import('./auditRepository.js').AuditRepository} repo */
  constructor(context) {
    super(context)
    this.auditRepository = new AuditRepository(context)
  }

  async getProgrammeHistory(programmeId) {
    return await this.auditRepository.findProgrammeHistory(programmeId)
  }

  async getRulesHistory(programmeId) {
    return await this.auditRepository.findRulesHistory(programmeId)
  }

  async getExitHistory(programmeId) {
    return await this.auditRepository.findExitHistory(programmeId)
  }

  async getAllHistory() {
    return await this.auditRepository.findAllHistory()
  }
}
