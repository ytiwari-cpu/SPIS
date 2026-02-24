import { BaseService }                from '../../../../base/baseService.js'
import { ProgrammeManagerRepository } from './programmeManagerRepository.js'

const IAM_SERVICE_URL = process.env.IAM_SERVICE_URL || 'http://localhost:3003'

export class ProgrammeManagerService extends BaseService {
  constructor(repo) {
    super(repo.context)
    this.repo = repo
  }

  async listFromIAM(authHeader) {
    try {
      // Fetch users who hold any admin-level role so all eligible managers appear
      const response = await fetch(
        `${IAM_SERVICE_URL}/iam/admin/users?role=Admin,SuperAdmin,ProgrammeManager&limit=200`,
        { headers: authHeader ? { Authorization: authHeader } : {} },
      )
      if (!response.ok) return []
      const json = await response.json()
      return json.data ?? []
    } catch {
      return []
    }
  }

  async listByProgramme(programmeId) { return this.repo.findByProgramme(programmeId) }

  async addManager(programmeId, targetUserId) {
    const callerId = this.getUserId()
    if (!this.hasPermission('PROGRAMME.MANAGERS.MANAGE') && !this.hasPermission('ADMIN.PROGRAMMES.EDIT')) {
      const isOwner = await this.isOwnerOrManager(programmeId, callerId)
      if (!isOwner) return { forbidden: true }
    }
    const data = await this.repo.addLink({ programme_id: programmeId, user_id: targetUserId, added_by: callerId })
    return { forbidden: false, data }
  }

  async removeManager(programmeId, targetUserId) {
    const callerId = this.getUserId()
    if (!this.hasPermission('PROGRAMME.MANAGERS.MANAGE') && !this.hasPermission('ADMIN.PROGRAMMES.EDIT')) {
      const creator = await this.repo.findProgrammeCreator(programmeId)
      if (creator !== callerId) return { forbidden: true }
    }
    await this.repo.removeLink(programmeId, targetUserId)
    return { forbidden: false }
  }

  async isOwnerOrManager(programmeId, userId) {
    const creator = await this.repo.findProgrammeCreator(programmeId)
    if (creator === userId) return true
    return this.repo.isManager(programmeId, userId)
  }
}
