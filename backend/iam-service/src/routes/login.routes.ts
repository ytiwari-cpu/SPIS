/**
 * SPIS IAM Service — Login Route
 *
 * POST /iam/login
 *   Body: { national_id: string, password: string }
 *   Returns: JWT token + user info + roles
 */

import { Router, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { loginWithCredentials } from '../services/login.js'
import { logger } from '../lib/logger.js'

export const loginRouter = Router()

const LoginSchema = z.object({
  national_id: z.string().min(1, 'National ID is required').max(50),
  password: z.string().min(1, 'Password is required').max(128),
})

loginRouter.post(
  '/',
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      // Validate request body
      const parsed = LoginSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.errors.map((e) => e.message).join(', '),
          },
        })
      }

      const { national_id, password } = parsed.data

      // Clean national_id (digits only)
      const cleanNationalId = national_id.replace(/\D/g, '')

      const result = await loginWithCredentials({
        nationalId: cleanNationalId,
        password,
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
        logger.error('Login error', { error: message })
      }

      return res.status(statusCode).json({
        success: false,
        error: {
          code: statusCode === 401 ? 'INVALID_CREDENTIALS' : 'LOGIN_ERROR',
          message,
        },
      })
    }
  },
)
