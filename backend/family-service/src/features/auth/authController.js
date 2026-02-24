/**
 * AuthController — handles /api/v1/auth routes
 *
 * Proxies authentication to IAM service and enriches response with family data.
 */

import { AuthService } from './authService.js'
import { AuthRepository } from './authRepository.js'

export class AuthController {
  /** @param {import('../../../../base/apiContext.js').ApiContext} ctx */
  constructor(ctx) {
    this.ctx = ctx
    this.req = ctx.req
    this.res = ctx.res
    const repo = new AuthRepository()
    this.service = new AuthService(repo)
  }

  async login() {
    const { req, res } = this
    const { national_id, password } = req.body

    if (!national_id || !password) {
      return res.status(400).json({ success: false, error: 'national_id and password are required' })
    }

    try {
      const result = await this.service.login(national_id, password)
      if (result.authFailed) return res.status(401).json({ success: false, error: result.error })
      return res.json({ success: true, data: result.data })
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message })
    }
  }

  async otpLoginRequest() {
    const { req, res } = this
    const { national_id } = req.body
    if (!national_id) return res.status(400).json({ success: false, error: 'national_id is required' })

    const { status, json } = await this.service.proxyOtpLoginRequest(national_id)
    return res.status(status).json(json)
  }

  async otpLoginVerify() {
    const { req, res } = this
    const { national_id, otp } = req.body
    if (!national_id || !otp) return res.status(400).json({ success: false, error: 'national_id and otp are required' })

    const result = await this.service.verifyOtpLogin(national_id, otp)
    if (result.failed) return res.status(result.status).json(result.json)
    if (result.memberNotFound) return res.status(404).json({ success: false, error: 'No family registration found for this user. Please register your family first.' })
    if (result.familyNotFound) return res.status(404).json({ success: false, error: 'Family not found for authenticated member' })
    return res.json({ success: true, data: result.data })
  }

  async me() {
    const { req, res } = this
    const result = await this.service.me(req.headers.authorization, req.headers['x-family-id'])
    if (result.unauthenticated) return res.status(401).json({ success: false, error: 'Not authenticated.' })
    return res.json({ success: true, data: result.data })
  }

  async logout() {
    return this.res.json({ success: true, message: 'Logged out successfully' })
  }
}
