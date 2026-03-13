/**
 * IAM — OTP Login API
 *
 * Routes:
 *   POST /iam/otp-login/request   — request OTP by national_id
 *   POST /iam/otp-login/verify    — verify OTP and login
 */

import { ApiSchema } from '../../../../base/apiSchema.js'
import { OtpLoginController } from './otpLoginController.js'
import { rateLimiters } from '../../middleware/rateLimiter.js'

const request = {
  path:       '/request',
  verb:       'POST',
  handler:    { controller: OtpLoginController, method: 'request' },
  middleware: [rateLimiters.passwordResetRequest],
}

const verify = {
  path:       '/verify',
  verb:       'POST',
  handler:    { controller: OtpLoginController, method: 'verify' },
  middleware: [rateLimiters.passwordResetConfirm],
}

const setPassword = {
  path:    '/set-initial-password',
  verb:    'POST',
  handler: { controller: OtpLoginController, method: 'setPassword' },
}

export const OtpLoginApi = new ApiSchema({
  name:      'OtpLogin',
  url:       '/iam/otp-login',
  endpoints: [request, verify, setPassword],
})
