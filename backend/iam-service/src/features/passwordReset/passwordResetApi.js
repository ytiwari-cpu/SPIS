/**
 * IAM — Password Reset API
 *
 * Routes:
 *   POST /iam/password-reset/request   — request OTP
 *   POST /iam/password-reset/confirm   — verify OTP + set new password
 */

import { z } from 'zod'
import { ApiSchema } from '../../../../base/apiSchema.js'
import { PasswordResetController } from './passwordResetController.js'

// ── Inline Zod schemas ──────────────────────────────────────

export const PasswordResetRequestSchema = z.object({
  national_id: z.string().min(1, 'National ID (TRN) is required').max(50),
})

export const PasswordResetConfirmSchema = z.object({
  national_id:  z.string().min(1, 'National ID is required').max(50),
  otp:          z.string().min(4, 'OTP is required').max(10),
  new_password: z.string().min(8, 'Password must be at least 8 characters').max(72),
})

const request = {
  path:    '/request',
  verb:    'POST',
  handler: { controller: PasswordResetController, method: 'request', arguments: ['request:body'] },
  request: { body: PasswordResetRequestSchema },
}

const confirm = {
  path:    '/confirm',
  verb:    'POST',
  handler: { controller: PasswordResetController, method: 'confirm', arguments: ['request:body'] },
  request: { body: PasswordResetConfirmSchema },
}

export const PasswordResetApi = new ApiSchema({
  name:      'PasswordReset',
  url:       '/iam/password-reset',
  endpoints: [request, confirm],
})
