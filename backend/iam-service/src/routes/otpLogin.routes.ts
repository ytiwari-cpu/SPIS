/**
 * SPIS IAM Service — OTP Login Routes
 *
 * POST /iam/otp-login/request   — request OTP by national_id
 * POST /iam/otp-login/verify    — verify OTP and login
 */

import { Router } from 'express'
import { rateLimiters } from '../middleware/rateLimiter.js'
import { ApiContext } from '../../../base/apiContext.js'
import { OtpLoginController } from '../features/otpLogin/otpLoginController.js'

export const otpLoginRouter = Router()

otpLoginRouter.post('/request', rateLimiters.passwordResetRequest, async (req, res, next) => {
  try {
    const ctx = new ApiContext(req, res)
    await new OtpLoginController(ctx).request()
  } catch (err) { next(err) }
})

otpLoginRouter.post('/verify', rateLimiters.passwordResetConfirm, async (req, res, next) => {
  try {
    const ctx = new ApiContext(req, res)
    await new OtpLoginController(ctx).verify()
  } catch (err) { next(err) }
})
