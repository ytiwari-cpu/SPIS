import { BaseController } from '../../../../base/baseController.js'
import { LoginService } from './loginService.js'
import { z } from 'zod'

const LoginSchema = z.object({
  national_id: z.string().min(1, 'National ID is required').max(50),
  password:    z.string().min(1, 'Password is required').max(72),
})

export class LoginController extends BaseController {
  constructor(context) {
    super(context)
    this.loginService = new LoginService(context)
  }

  async login(body) {
    const res = this.context.response
    try {
      const parsed = LoginSchema.safeParse(body)
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error:   {
            code:    'VALIDATION_ERROR',
            message: parsed.error.errors.map(e => e.message).join(', '),
          },
        })
      }

      const { national_id, password } = parsed.data
      const req = this.context.request
      const ip = req.ip || req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown'
      const userAgent = req.headers?.['user-agent'] || 'unknown'

      const result = await this.loginService.loginWithCredentials({
        nationalId: national_id.replace(/\D/g, ''),
        password,
        ip,
        userAgent,
      })

      return res.json({ success: true, data: result })
    } catch (error) {
      const statusCode = error?.statusCode || 500
      const message    = error?.message || 'Internal server error'
      if (statusCode >= 500) {
        this.log.error('Login error', { error: message })
      }
      return res.status(statusCode).json({
        success: false,
        error:   {
          code: error?.code || (statusCode === 401 ? 'INVALID_CREDENTIALS' : 'LOGIN_ERROR'),
          message,
          ...(error?.details ? { details: error.details } : {}),
        },
      })
    }
  }
}
