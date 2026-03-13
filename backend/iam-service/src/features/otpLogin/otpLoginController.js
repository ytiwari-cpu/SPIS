import { BaseController } from '../../../../base/baseController.js'
import { OtpLoginService } from './otpLoginService.js'
import { OtpLoginRepository } from './otpLoginRepository.js'
import { z } from 'zod'
import { jwtVerify } from 'jose'
import { config } from '../../config.js'

const OtpLoginRequestSchema = z.object({
  national_id: z.string().min(1).max(50),
})

const OtpLoginVerifySchema = z.object({
  national_id: z.string().min(1).max(50),
  otp:         z.string().length(6, 'OTP must be 6 digits'),
})

const SetInitialPasswordSchema = z.object({
  new_password: z.string().min(8, 'Password must be at least 8 characters'),
})

export class OtpLoginController extends BaseController {
  constructor(ctx) {
    super(ctx)
    const repo = new OtpLoginRepository(ctx)
    this.service = new OtpLoginService(repo)
  }

  async request() {
    const req = this.context.request
    const res = this.context.response
    try {
      const parsed = OtpLoginRequestSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: parsed.error.errors.map(e => e.message).join(', ') },
        })
      }
      const result = await this.service.requestOtp(parsed.data.national_id.replace(/\D/g, ''))
      return res.json({ success: true, data: result })
    } catch (error) {
      const statusCode = error?.statusCode || 500
      const code = statusCode === 404 ? 'NOT_FOUND' : statusCode === 409 ? 'NO_EMAIL' : 'OTP_REQUEST_ERROR'
      return res.status(statusCode).json({ success: false, error: { code, message: error.message } })
    }
  }

  async verify() {
    const req = this.context.request
    const res = this.context.response
    try {
      const parsed = OtpLoginVerifySchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: parsed.error.errors.map(e => e.message).join(', ') },
        })
      }
      const result = await this.service.verifyOtp({
        nationalId: parsed.data.national_id.replace(/\D/g, ''),
        otp:        parsed.data.otp,
        ip:         req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown',
        userAgent:  req.headers['user-agent'] || 'unknown',
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

  async setPassword() {
    const req = this.context.request
    const res = this.context.response
    try {
      // Extract national_id from the Bearer JWT
      const authHeader = req.headers['authorization'] || ''
      if (!authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing or invalid token' } })
      }
      const token = authHeader.slice(7)
      const secret = new TextEncoder().encode(config.jwt.secret)
      let payload
      try {
        const verified = await jwtVerify(token, secret)
        payload = verified.payload
      } catch {
        return res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' } })
      }

      const nationalId = payload.national_id
      if (!nationalId) {
        return res.status(400).json({ success: false, error: { code: 'MISSING_NATIONAL_ID', message: 'national_id not in token' } })
      }

      const parsed = SetInitialPasswordSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors.map(e => e.message).join(', ') } })
      }

      const nationalIdStr = typeof nationalId === 'string' ? nationalId : ''
      const result = await this.service.setInitialPassword(nationalIdStr, parsed.data.new_password)
      return res.json({ success: true, data: result })
    } catch (error) {
      const statusCode = error?.statusCode || 500
      return res.status(statusCode).json({ success: false, error: { code: 'SET_PASSWORD_ERROR', message: error.message } })
    }
  }
}
