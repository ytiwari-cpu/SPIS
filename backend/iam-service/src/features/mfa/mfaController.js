import { BaseController } from '../../../../base/baseController.js'
import { MfaService } from './mfaService.js'

export class MfaController extends BaseController {
  constructor(context) {
    super(context)
    this.mfaService = new MfaService(context)
  }

  async enrollTotp(user) {
    try {
      const result = await this.mfaService.enrollTotp(user.sub)
      this.respondOk({ success: true, data: result })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async verifyTotp(body, user) {
    try {
      const result = await this.mfaService.verifyTotpEnrollment(user.sub, body.code)
      this.context.response.status(200).json({ success: true, ...result })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async sendEmailOtp(body, user) {
    try {
      const result = await this.mfaService.sendEmailOtp(user.sub, body.purpose)
      this.respondOk({ success: true, ...result })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async verifyEmailOtp(body, user) {
    try {
      const valid = await this.mfaService.verifyEmailOtp(user.sub, body.code, body.purpose)
      if (valid) {
        this.respondOk({ success: true, message: 'OTP verified' })
      } else {
        this.respondBadRequest({ success: false, error: { code: 'INVALID_OTP', message: 'Invalid or expired OTP' } })
      }
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }
}
