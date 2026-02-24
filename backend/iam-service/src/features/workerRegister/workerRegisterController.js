/**
 * IAM — Worker Register Controller
 *
 * Destructures request data and delegates to WorkerRegisterService.
 */

import { BaseController } from '../../../../base/baseController.js'
import { WorkerRegisterService } from './workerRegisterService.js'
import { WorkerRegisterRepository } from './workerRegisterRepository.js'
import { logger } from '../../lib/logger.js'

export class WorkerRegisterController extends BaseController {
  constructor(ctx) {
    super(ctx)
    const repo = new WorkerRegisterRepository(ctx)
    this.service = new WorkerRegisterService(repo)
  }

  async register() {
    const { national_id, email, role, secret_key } = this.context.request.body
    try {
      const data = await this.service.register({ national_id, email, role, secret_key })
      this.respondOk({ success: true, data })
    } catch (error) {
      const statusCode = error?.statusCode || 500
      const code       = error?.code       || 'REGISTRATION_ERROR'
      logger.error('Worker registration error', { error })
      this.context.response.status(statusCode).json({ success: false, error: { code, message: error.message || 'Registration failed' } })
    }
  }

  async verify() {
    const { national_id, email, role, otp, password } = this.context.request.body
    try {
      const data = await this.service.verify({ national_id, email, role, otp, password })
      this.respondOk({ success: true, data })
    } catch (error) {
      const statusCode = error?.statusCode || 500
      const code       = error?.code       || 'VERIFICATION_ERROR'
      logger.error('Worker registration verification error', { error })
      this.context.response.status(statusCode).json({ success: false, error: { code, message: error.message || 'Verification failed' } })
    }
  }
}
