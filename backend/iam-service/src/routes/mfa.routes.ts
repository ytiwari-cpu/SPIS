/**
 * SPIS IAM Service — MFA Routes
 *
 * POST /iam/mfa/totp/enroll   — start TOTP enrollment
 * POST /iam/mfa/totp/verify   — verify TOTP code
 * POST /iam/mfa/email/send    — send email OTP
 * POST /iam/mfa/email/verify  — verify email OTP
 */

import { Router } from 'express'
import { validate } from '../middleware/validate.js'
import { requireAuth } from '../middleware/auth.js'
import { rateLimiters } from '../middleware/rateLimiter.js'
import { TotpVerifySchema, EmailOtpSendSchema, EmailOtpVerifySchema } from '../validators/schemas.js'
import { ApiContext } from '../../../base/apiContext.js'
import { MfaController } from '../features/mfa/mfaController.js'

export const mfaRouter = Router()

mfaRouter.use(requireAuth())

mfaRouter.post('/totp/enroll', rateLimiters.mfaOperation, async (req, res, next) => {
  try {
    const ctx = new ApiContext(req, res)
    await new MfaController(ctx).enrollTotp()
  } catch (err) { next(err) }
})

mfaRouter.post('/totp/verify', rateLimiters.mfaOperation, validate(TotpVerifySchema), async (req, res, next) => {
  try {
    const ctx = new ApiContext(req, res)
    await new MfaController(ctx).verifyTotp()
  } catch (err) { next(err) }
})

mfaRouter.post('/email/send', rateLimiters.mfaOperation, validate(EmailOtpSendSchema), async (req, res, next) => {
  try {
    const ctx = new ApiContext(req, res)
    await new MfaController(ctx).sendEmailOtp()
  } catch (err) { next(err) }
})

mfaRouter.post('/email/verify', rateLimiters.mfaOperation, validate(EmailOtpVerifySchema), async (req, res, next) => {
  try {
    const ctx = new ApiContext(req, res)
    await new MfaController(ctx).verifyEmailOtp()
  } catch (err) { next(err) }
})
