import { BaseController }              from '../../../../base/baseController.js'
import { ProgrammeManagerService }     from './programmeManagerService.js'
import { ProgrammeManagerRepository }  from './programmeManagerRepository.js'

export class ProgrammeManagerController extends BaseController {
  constructor(ctx) {
    super(ctx)
    const repo = new ProgrammeManagerRepository(ctx)
    this.service = new ProgrammeManagerService(repo)
  }

  async listFromIAM() {
    try {
      const data = await this.service.listFromIAM(this.context.request.headers.authorization)
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

  async add() {
    try {
      const { user_id } = this.context.request.body
      if (!user_id) { this.respondBadRequest({ success: false, error: 'user_id is required' }); return }
      const result = await this.service.addManager(this.context.request.params.programmeId, user_id)
      if (result.forbidden) {
        this.respondForbidden({ success: false, error: 'Only programme owner or SuperAdmin can add managers' }); return
      }
      this.respondCreated({ success: true, data: result.data })
    } catch (err) {
      if (err?.code === '23505') {
        this.respondJson({ success: false, error: 'This manager already has access to this programme' }, 409); return
      }
      this.respondError({ success: false, error: err.message })
    }
  }

  async remove() {
    try {
      const result = await this.service.removeManager(
        this.context.request.params.programmeId,
        this.context.request.params.userId,
      )
      if (result.forbidden) {
        this.respondForbidden({ success: false, error: 'Only programme owner or SuperAdmin can remove managers' }); return
      }
      this.respondOk({ success: true, message: 'Manager removed from programme' })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }
}
