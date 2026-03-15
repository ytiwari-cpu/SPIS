import { BaseController } from '../../../../base/baseController.js'
import { PasswordResetService } from './passwordResetService.js'

export class PasswordResetController extends BaseController {
  constructor(context) {
    super(context)
    this.passwordResetService = new PasswordResetService(context)
  }

  async request(body) {
    const { national_id } = body
    try {
      const result = await this.passwordResetService.requestReset(national_id)
      this.context.response.status(200).json({ success: true, ...result })
    } catch (err) {
      const statusCode = err?.statusCode || 500
      this.context.response.status(statusCode).json({ success: false, error: err.message })
    }
  }

  async confirm(body) {
    const { national_id, otp, new_password } = body
    try {
      const result = await this.passwordResetService.confirmReset({
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
