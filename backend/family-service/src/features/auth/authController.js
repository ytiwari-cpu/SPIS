/**
 * AuthController — handles /api/v1/auth routes
 *
 * Proxies authentication to IAM service and enriches response with family data.
 * Controller methods receive validated arguments directly from ApiSchema handler.arguments.
 */

import { BaseController } from '../../../../base/baseController.js'
import { ApplicationError } from '../../../../base/applicationError.js'
import { AuthService } from './authService.js'

export class AuthController extends BaseController {
  /** @param {import('../../../../base/apiContext.js').ApiContext} context */
  constructor(context) {
    super(context)
    this.authService = new AuthService(context)
  }

  async login({ national_id, password }) {
    if (!national_id || !password) {
      throw ApplicationError.badRequest('national_id and password are required')
    }
    const result = await this.authService.login(national_id, password)
    if (result.authFailed) {
      const status = result.status || 401
      // Preserve 423 (account locked) and 429 (rate limited) so the frontend sees the real error
      if (status === 423 || status === 429) {
        throw ApplicationError.create(status, {
          message: result.error,
          code:    result.errorCode || 'ACCOUNT_LOCKED',
          details: result.details,
        })
      }
      // Preserve 5xx from IAM — do not swallow service errors as 401
      if (status >= 500) {
        throw ApplicationError.create(status, {
          message: result.error,
          code:    result.errorCode || 'IAM_UNAVAILABLE',
          details: result.details,
        })
      }
      throw ApplicationError.unauthorized(result.error)
    }
    return this.respondOk({ success: true, data: result.data })
  }

  async otpLoginRequest({ national_id }) {
    if (!national_id) {
      throw ApplicationError.badRequest('national_id is required')
    }
    const { status, json } = await this.authService.proxyOtpLoginRequest(national_id)
    return this.context.response.status(status).json(json)
  }

  async otpLoginVerify({ national_id, otp }) {
    if (!national_id || !otp) {
      throw ApplicationError.badRequest('national_id and otp are required')
    }
    const result = await this.authService.verifyOtpLogin(national_id, otp)
    if (result.failed) {
      return this.context.response.status(result.status).json(result.json)
    }
    if (result.memberNotFound) {
      throw ApplicationError.notFound('No family registration found for this user. Please register your family first.')
    }
    if (result.familyNotFound) {
      throw ApplicationError.notFound('Family not found for authenticated member')
    }
    return this.respondOk({ success: true, data: result.data })
  }

  async me() {
    const req = this.context.request
    const result = await this.authService.me(req.headers.authorization, req.headers['x-family-id'])
    if (result.unauthenticated) {
      throw ApplicationError.unauthorized('Not authenticated.')
    }
    return this.respondOk({ success: true, data: result.data })
  }

  async logout() {
    return await this.respondOk({ success: true, message: 'Logged out successfully' })
  }
}
