import { BaseController } from '../../../../base/baseController.js'
import { LoginService } from './loginService.js'
import { LoginRepository } from './loginRepository.js'
import { z } from 'zod'

const LoginSchema = z.object({
  national_id: z.string().min(1, 'National ID is required').max(50),
  password:    z.string().min(1, 'Password is required').max(128),
})

export class LoginController extends BaseController {
  constructor(ctx) {
    super(ctx)
    const repo = new LoginRepository(ctx)
    this.service = new LoginService(repo)
  }

  async login() {
    const req = this.context.request
    const res = this.context.response
    try {
      const parsed = LoginSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: {
            code:    'VALIDATION_ERROR',
            message: parsed.error.errors.map(e => e.message).join(', '),
          },
        })
      }

      const { national_id, password } = parsed.data
      const result = await this.service.loginWithCredentials({
        nationalId: national_id.replace(/\D/g, ''),
        password,
        ip:        req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
      })

      return res.json({ success: true, data: result })
    } catch (error) {
      const statusCode = error?.statusCode || 500
      const message    = error?.message || 'Internal server error'
      if (statusCode >= 500) this.log.error('Login error', { error: message })
      return res.status(statusCode).json({
        success: false,
        error: {
          code:    statusCode === 401 ? 'INVALID_CREDENTIALS' : 'LOGIN_ERROR',
          message,
        },
      })
    }
  }
}
