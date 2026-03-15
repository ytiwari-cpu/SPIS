/**
 * IAM — OTP Login API
 *
 * Routes:
 *   POST /iam/otp-login/request   — request OTP by national_id
 *   POST /iam/otp-login/verify    — verify OTP and login
 */

import { ApiSchema } from '../../../../base/apiSchema.js'
import { OtpLoginController } from './otpLoginController.js'

const request = {
  path:    '/request',
  verb:    'POST',
  handler: { controller: OtpLoginController, method: 'request', arguments: ['request:body'] },
}

const verify = {
  path:    '/verify',
  verb:    'POST',
  handler: { controller: OtpLoginController, method: 'verify', arguments: ['request:body'] },
}

export const OtpLoginApi = new ApiSchema({
  name:      'OtpLogin',
  url:       '/iam/otp-login',
  endpoints: [request, verify],
})
