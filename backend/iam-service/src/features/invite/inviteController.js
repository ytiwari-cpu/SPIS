import { BaseController } from '../../../../base/baseController.js'
import { InviteService } from './inviteService.js'
import { InviteRepository } from './inviteRepository.js'

export class InviteController extends BaseController {
  constructor(ctx) {
    super(ctx)
    const repo = new InviteRepository(ctx)
    this.service = new InviteService(repo)
  }

  async create() {
    try {
      const result = await this.service.createInvitedAccount({
        registryId:     this.context.request.body.registry_id,
        email:          this.context.request.body.email,
        nationalIdHash: this.context.request.body.national_id_hash,
        nationalId:     this.context.request.body.national_id,
      })
      this.respondCreated({ success: true, ...result })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }
}
