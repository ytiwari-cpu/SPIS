/**
 * IAM — Worker Register Controller
 *
 * Destructures request data and delegates to WorkerRegisterService.
 */

import { BaseController } from '../../../../base/baseController.js'
import { WorkerRegisterService } from './workerRegisterService.js'

export class WorkerRegisterController extends BaseController {
  constructor(context) {
    super(context)
    this.workerRegisterService = new WorkerRegisterService(context)
  }

  async register(body) {
    const { national_id, email, role, secret_key } = body
    try {
      const data = await this.workerRegisterService.register({ national_id, email, role, secret_key })
      this.respondOk({ success: true, data })
    } catch (error) {
      const statusCode = error?.statusCode || 500
      const code       = error?.code       || 'REGISTRATION_ERROR'
      this.log.error('Worker registration error', { error })
      this.context.response.status(statusCode).json({ success: false, error: { code, message: error.message || 'Registration failed' } })
    }
  }

  async verify(body) {
    const { national_id, email, role, otp, password } = body
    try {
      const data = await this.workerRegisterService.verify({ national_id, email, role, otp, password })
      this.respondOk({ success: true, data })
    } catch (error) {
      const statusCode = error?.statusCode || 500
      const code       = error?.code       || 'VERIFICATION_ERROR'
      this.log.error('Worker registration verification error', { error })
      this.context.response.status(statusCode).json({ success: false, error: { code, message: error.message || 'Verification failed' } })
    }
  }
}
