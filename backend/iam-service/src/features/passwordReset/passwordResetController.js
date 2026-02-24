import { BaseController } from '../../../../base/baseController.js'
import { PasswordResetService } from './passwordResetService.js'
import { PasswordResetRepository } from './passwordResetRepository.js'

export class PasswordResetController extends BaseController {
  constructor(ctx) {
    super(ctx)
    const repo = new PasswordResetRepository(ctx)
    this.service = new PasswordResetService(repo)
  }

  async request() {
    const { national_id } = this.context.request.body
    try {
      const result = await this.service.requestReset(national_id)
      this.context.response.status(200).json({ success: true, ...result })
    } catch (err) {
      const statusCode = err?.statusCode || 500
      this.context.response.status(statusCode).json({ success: false, error: err.message })
    }
  }

  async confirm() {
    const { national_id, otp, new_password } = this.context.request.body
    try {
      const result = await this.service.confirmReset({
        nationalId:  national_id,
        otp,
        newPassword: new_password,
      })
      this.context.response.status(200).json({ success: true, ...result })
    } catch (err) {
      const statusCode = err?.statusCode || 500
      this.context.response.status(statusCode).json({ success: false, error: err.message })
    }
  }
}
