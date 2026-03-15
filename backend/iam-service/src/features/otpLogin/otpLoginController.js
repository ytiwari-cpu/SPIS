import { BaseController } from '../../../../base/baseController.js'
import { OtpLoginService } from './otpLoginService.js'
import { z } from 'zod'

const OtpLoginRequestSchema = z.object({
  national_id: z.string().min(1).max(50),
})

const OtpLoginVerifySchema = z.object({
  national_id: z.string().min(1).max(50),
  otp:         z.string().length(6, 'OTP must be 6 digits'),
})

export class OtpLoginController extends BaseController {
  constructor(context) {
    super(context)
    this.otpLoginService = new OtpLoginService(context)
  }

  async request(body) {
    const res = this.context.response
    try {
      const parsed = OtpLoginRequestSchema.safeParse(body)
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error:   { code: 'VALIDATION_ERROR', message: parsed.error.errors.map(e => e.message).join(', ') },
        })
      }
      const result = await this.otpLoginService.requestOtp(parsed.data.national_id.replace(/\D/g, ''))
      return res.json({ success: true, data: result })
    } catch (error) {
      const statusCode = error?.statusCode || 500
      const code = statusCode === 404 ? 'NOT_FOUND' : statusCode === 409 ? 'NO_EMAIL' : 'OTP_REQUEST_ERROR'
      return res.status(statusCode).json({ success: false, error: { code, message: error.message } })
    }
  }

  async verify(body) {
    const res = this.context.response
    try {
      const parsed = OtpLoginVerifySchema.safeParse(body)
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error:   { code: 'VALIDATION_ERROR', message: parsed.error.errors.map(e => e.message).join(', ') },
        })
      }
      const ip        = this.context.request.ip || this.context.request.socket?.remoteAddress || 'unknown'
      const userAgent = this.context.request.headers?.['user-agent'] || null
      const result = await this.otpLoginService.verifyOtp({
        nationalId: parsed.data.national_id.replace(/\D/g, ''),
        otp:        parsed.data.otp,
        ip,
        userAgent,
      })
      return res.json({ success: true, data: result })
    } catch (error) {
      const statusCode = error?.statusCode || 500
      const code = statusCode === 400 ? 'INVALID_OTP'
        : statusCode === 404 ? 'NOT_FOUND'
          : statusCode === 429 ? 'TOO_MANY_ATTEMPTS'
            : 'OTP_VERIFY_ERROR'
      return res.status(statusCode).json({ success: false, error: { code, message: error.message } })
    }
  }
}
