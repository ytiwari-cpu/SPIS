/**
 * SPIS IAM Service — MFA Routes
 *
 * POST /iam/mfa/totp/enroll   — start TOTP enrollment (returns QR + secret)
 * POST /iam/mfa/totp/verify   — verify TOTP code to complete enrollment
 * POST /iam/mfa/email/send    — send email OTP
 * POST /iam/mfa/email/verify  — verify email OTP
 */

import { Router, type Request, type Response, type NextFunction } from 'express'
import { validate } from '../middleware/validate.js'
import { requireAuth } from '../middleware/auth.js'
import { rateLimiters } from '../middleware/rateLimiter.js'
import { TotpVerifySchema, EmailOtpSendSchema, EmailOtpVerifySchema } from '../validators/schemas.js'
import { enrollTotp, verifyTotpEnrollment, sendEmailOtp, verifyEmailOtp } from '../services/mfa.js'

export const mfaRouter = Router()

// All MFA routes require authentication
mfaRouter.use(requireAuth())

// POST /iam/mfa/totp/enroll
mfaRouter.post(
  '/totp/enroll',
  rateLimiters.mfaOperation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await enrollTotp(req.user!.sub)
      res.status(200).json({ success: true, data: result })
    } catch (err) {
      next(err)
    }
  },
)

// POST /iam/mfa/totp/verify
mfaRouter.post(
  '/totp/verify',
  rateLimiters.mfaOperation,
  validate(TotpVerifySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await verifyTotpEnrollment(req.user!.sub, req.body.code)
      res.status(200).json({ success: true, ...result })
    } catch (err) {
      next(err)
    }
  },
)

// POST /iam/mfa/email/send
mfaRouter.post(
  '/email/send',
  rateLimiters.mfaOperation,
  validate(EmailOtpSendSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await sendEmailOtp(req.user!.sub, req.body.purpose)
      res.status(200).json({ success: true, ...result })
    } catch (err) {
      next(err)
    }
  },
)

// POST /iam/mfa/email/verify
mfaRouter.post(
  '/email/verify',
  rateLimiters.mfaOperation,
  validate(EmailOtpVerifySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const valid = await verifyEmailOtp(req.user!.sub, req.body.code, req.body.purpose)
      if (valid) {
        res.status(200).json({ success: true, message: 'OTP verified' })
      } else {
        res.status(400).json({ success: false, error: { code: 'INVALID_OTP', message: 'Invalid or expired OTP' } })
      }
    } catch (err) {
      next(err)
    }
  },
)
