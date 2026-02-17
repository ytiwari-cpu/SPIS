/**
 * SPIS IAM Service — Password Reset Routes
 *
 * POST /iam/password-reset/request   — request OTP by national_id
 * POST /iam/password-reset/confirm   — verify OTP + set password
 */

import { Router, type Request, type Response, type NextFunction } from 'express'
import { validate } from '../middleware/validate.js'
import { rateLimiters } from '../middleware/rateLimiter.js'
import { PasswordResetRequestSchema, PasswordResetConfirmSchema } from '../validators/schemas.js'
import { requestPasswordReset, confirmPasswordReset } from '../services/passwordReset.js'

export const passwordResetRouter = Router()

// POST /iam/password-reset/request
passwordResetRouter.post(
  '/request',
  rateLimiters.passwordResetRequest,
  validate(PasswordResetRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await requestPasswordReset(req.body.national_id)
      res.status(200).json({ success: true, ...result })
    } catch (err) {
      next(err)
    }
  },
)

// POST /iam/password-reset/confirm
passwordResetRouter.post(
  '/confirm',
  rateLimiters.passwordResetConfirm,
  validate(PasswordResetConfirmSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await confirmPasswordReset({
        nationalId: req.body.national_id,
        otp: req.body.otp,
        newPassword: req.body.new_password,
      })
      res.status(200).json({ success: true, ...result })
    } catch (err) {
      next(err)
    }
  },
)
