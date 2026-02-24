/**
 * SPIS IAM Service — Password Reset Routes
 *
 * POST /iam/password-reset/request   — request OTP by national_id
 * POST /iam/password-reset/confirm   — verify OTP + set password
 */

import { Router } from 'express'
import { validate } from '../middleware/validate.js'
import { rateLimiters } from '../middleware/rateLimiter.js'
import { PasswordResetRequestSchema, PasswordResetConfirmSchema } from '../validators/schemas.js'
import { ApiContext } from '../../../base/apiContext.js'
import { PasswordResetController } from '../features/passwordReset/passwordResetController.js'

export const passwordResetRouter = Router()

passwordResetRouter.post('/request', rateLimiters.passwordResetRequest, validate(PasswordResetRequestSchema), async (req, res, next) => {
  try {
    const ctx = new ApiContext(req, res)
    await new PasswordResetController(ctx).request()
  } catch (err) { next(err) }
})

passwordResetRouter.post('/confirm', rateLimiters.passwordResetConfirm, validate(PasswordResetConfirmSchema), async (req, res, next) => {
  try {
    const ctx = new ApiContext(req, res)
    await new PasswordResetController(ctx).confirm()
  } catch (err) { next(err) }
})
