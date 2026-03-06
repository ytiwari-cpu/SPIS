/**
 * AuthController — handles /api/v1/auth routes
 *
 * Proxies authentication to IAM service and enriches response with family data.
 */

import { BaseController } from '../../../../../base/baseController.js'
import { ApplicationError } from '../../../../../base/applicationError.js'
import { AuthService } from './authService.js'
import { AuthRepository } from './authRepository.js'

export class AuthController extends BaseController {
  /** @param {import('../../../../../base/apiContext.js').ApiContext} ctx */
  constructor(ctx) {
    super(ctx)
    const repo = new AuthRepository()
    this.service = new AuthService(repo)
  }

  async login() {
    const { national_id, password } = this.context.req.body

    if (!national_id || !password) {
      throw ApplicationError.badRequest('national_id and password are required')
    }

    const result = await this.service.login(national_id, password)
    if (result.authFailed) throw ApplicationError.unauthorized(result.error)
    return this.respondOk({ success: true, data: result.data })
  }

  async otpLoginRequest() {
    const { national_id } = this.context.req.body
    if (!national_id) throw ApplicationError.badRequest('national_id is required')

    const { status, json } = await this.service.proxyOtpLoginRequest(national_id)
    return this.context.res.status(status).json(json)
  }

  async otpLoginVerify() {
    const { national_id, otp } = this.context.req.body
    if (!national_id || !otp) throw ApplicationError.badRequest('national_id and otp are required')

    const result = await this.service.verifyOtpLogin(national_id, otp)
    if (result.failed) return this.context.res.status(result.status).json(result.json)
    if (result.memberNotFound) throw ApplicationError.notFound('No family registration found for this user. Please register your family first.')
    if (result.familyNotFound) throw ApplicationError.notFound('Family not found for authenticated member')
    return this.respondOk({ success: true, data: result.data })
  }

  async me() {
    const req = this.context.req
    const result = await this.service.me(req.headers.authorization, req.headers['x-family-id'])
    if (result.unauthenticated) throw ApplicationError.unauthorized('Not authenticated.')
    return this.respondOk({ success: true, data: result.data })
  }

  async logout() {
    return this.respondOk({ success: true, message: 'Logged out successfully' })
  }
}
