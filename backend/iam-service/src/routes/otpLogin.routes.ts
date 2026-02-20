/**
 * SPIS IAM Service — OTP Login Routes
 *
 * POST /iam/otp-login/request   — request OTP by national_id (checks users, then family_member)
 * POST /iam/otp-login/verify    — verify OTP and login
 */

import { Router, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { rateLimiters } from '../middleware/rateLimiter.js'
import { requestOtpLogin, verifyOtpLogin } from '../services/otpLogin.js'
import { logger } from '../lib/logger.js'

export const otpLoginRouter = Router()

const OtpLoginRequestSchema = z.object({
  national_id: z.string().min(1, 'National ID is required').max(50),
})

const OtpLoginVerifySchema = z.object({
  national_id: z.string().min(1, 'National ID is required').max(50),
  otp: z.string().length(6, 'OTP must be 6 digits'),
})

/**
 * POST /iam/otp-login/request
 * Request OTP for login (searches users table first, then family_member)
 */
otpLoginRouter.post(
  '/request',
  rateLimiters.passwordResetRequest, // Reuse password reset rate limiter
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const parsed = OtpLoginRequestSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.errors.map((e) => e.message).join(', '),
          },
        })
      }

      const { national_id } = parsed.data
      const cleanNationalId = national_id.replace(/\D/g, '')

      const result = await requestOtpLogin(cleanNationalId)

      return res.json({
        success: true,
        data: result,
      })
    } catch (error) {
      const statusCode = (error as Error & { statusCode?: number }).statusCode || 500
      const message = (error as Error).message || 'Internal server error'

      if (statusCode >= 500) {
        logger.error('OTP login request error', { error: message })
      }

      return res.status(statusCode).json({
        success: false,
        error: {
          code: statusCode === 404 ? 'NOT_FOUND' : statusCode === 409 ? 'NO_EMAIL' : 'OTP_REQUEST_ERROR',
          message,
        },
      })
    }
  },
)

/**
 * POST /iam/otp-login/verify
 * Verify OTP and login
 */
otpLoginRouter.post(
  '/verify',
  rateLimiters.passwordResetConfirm, // Reuse password reset rate limiter
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const parsed = OtpLoginVerifySchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.errors.map((e) => e.message).join(', '),
          },
        })
      }

      const { national_id, otp } = parsed.data
      const cleanNationalId = national_id.replace(/\D/g, '')

      const result = await verifyOtpLogin({
        nationalId: cleanNationalId,
        otp,
        ip: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
      })

      return res.json({
        success: true,
        data: result,
      })
    } catch (error) {
      const statusCode = (error as Error & { statusCode?: number }).statusCode || 500
      const message = (error as Error).message || 'Internal server error'

      if (statusCode >= 500) {
        logger.error('OTP login verify error', { error: message })
      }

      return res.status(statusCode).json({
        success: false,
        error: {
          code: statusCode === 400 ? 'INVALID_OTP' : statusCode === 404 ? 'NOT_FOUND' : statusCode === 429 ? 'TOO_MANY_ATTEMPTS' : 'OTP_VERIFY_ERROR',
          message,
        },
      })
    }
  },
)
