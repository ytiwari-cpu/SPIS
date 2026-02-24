/**
 * IAM — Password Reset API
 *
 * Routes:
 *   POST /iam/password-reset/request   — request OTP
 *   POST /iam/password-reset/confirm   — verify OTP + set new password
 */

import { ApiSchema } from '../../../../base/apiSchema.js'
import { PasswordResetController } from './passwordResetController.js'
import { rateLimiters } from '../../middleware/rateLimiter.js'

const request = {
  path:       '/request',
  verb:       'POST',
  handler:    { controller: PasswordResetController, method: 'request' },
  middleware: [rateLimiters.passwordResetRequest],
}

const confirm = {
  path:       '/confirm',
  verb:       'POST',
  handler:    { controller: PasswordResetController, method: 'confirm' },
  middleware: [rateLimiters.passwordResetConfirm],
}

export const PasswordResetApi = new ApiSchema({
  name:      'PasswordReset',
  url:       '/iam/password-reset',
  endpoints: [request, confirm],
})
