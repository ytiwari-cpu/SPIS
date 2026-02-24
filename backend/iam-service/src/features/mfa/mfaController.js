import { BaseController } from '../../../../base/baseController.js'
import { MfaService } from './mfaService.js'
import { MfaRepository } from './mfaRepository.js'

export class MfaController extends BaseController {
  constructor(ctx) {
    super(ctx)
    const repo = new MfaRepository(ctx)
    this.service = new MfaService(repo)
  }

  async enrollTotp() {
    try {
      const result = await this.service.enrollTotp(this.context.user.sub)
      this.respondOk({ success: true, data: result })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async verifyTotp() {
    try {
      const result = await this.service.verifyTotpEnrollment(this.context.user.sub, this.context.request.body.code)
      this.context.response.status(200).json({ success: true, ...result })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async sendEmailOtp() {
    try {
      const result = await this.service.sendEmailOtp(this.context.user.sub, this.context.request.body.purpose)
      this.respondOk({ success: true, ...result })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async verifyEmailOtp() {
    try {
      const valid = await this.service.verifyEmailOtp(
        this.context.user.sub,
        this.context.request.body.code,
        this.context.request.body.purpose,
      )
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
