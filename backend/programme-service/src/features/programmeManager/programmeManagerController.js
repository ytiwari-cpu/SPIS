import { BaseController }          from '../../../../base/baseController.js'
import { ProgrammeManagerService } from './programmeManagerService.js'

export class ProgrammeManagerController extends BaseController {
  constructor(context) {
    super(context)
    this.programmeManagerService = new ProgrammeManagerService(context)
  }

  async listFromIAM() {
    try {
      // Authorization header extracted in service via this.context.request.headers
      const data = await this.programmeManagerService.listFromIAM()
      this.respondOk({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async listByProgramme(params) {
    try {
      const data = await this.programmeManagerService.listByProgramme(params.programmeId)
      this.respondOk({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async add(params, body) {
    try {
      const { user_id } = body
      if (!user_id) {
        this.respondBadRequest({ success: false, error: 'user_id is required' })
        return
      }
      const result = await this.programmeManagerService.addManager(params.programmeId, user_id)
      if (result.forbidden) {
        this.respondForbidden({ success: false, error: 'Only programme owner or SuperAdmin can add managers' })
        return
      }
      this.respondCreated({ success: true, data: result.data })
    } catch (err) {
      if (err?.code === '23505') {
        this.respondJson({ success: false, error: 'This manager already has access to this programme' }, 409)
        return
      }
      this.respondError({ success: false, error: err.message })
    }
  }

  async remove(params) {
    try {
      const result = await this.programmeManagerService.removeManager(params.programmeId, params.userId)
      if (result.forbidden) {
        this.respondForbidden({ success: false, error: 'Only programme owner or SuperAdmin can remove managers' })
        return
      }
      this.respondOk({ success: true, message: 'Manager removed from programme' })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }
}
