import { BaseController } from '../../../../base/baseController.js'
import { InviteService } from './inviteService.js'

export class InviteController extends BaseController {
  constructor(context) {
    super(context)
    this.inviteService = new InviteService(context)
  }

  async create(body) {
    try {
      const result = await this.inviteService.createInvitedAccount({
        registryId:     body.registry_id,
        email:          body.email,
        nationalIdHash: body.national_id_hash,
        nationalId:     body.national_id,
      })
      this.respondCreated({ success: true, ...result })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }
}
