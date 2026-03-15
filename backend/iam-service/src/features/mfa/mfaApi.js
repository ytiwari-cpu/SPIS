/**
 * IAM — MFA API
 *
 * Routes:
 *   POST /iam/mfa/totp/enroll  — start TOTP enrollment (auth required)
 *   POST /iam/mfa/totp/verify  — complete TOTP enrollment (auth required)
 *   POST /iam/mfa/email/send   — send email OTP (auth required)
 *   POST /iam/mfa/email/verify — verify email OTP (auth required)
 */

import { ApiSchema } from '../../../../base/apiSchema.js'
import { MfaController } from './mfaController.js'
import { requireAuth } from '../../../../base/middleware/requireAuth.js'

const enrollTotp = {
  path:       '/totp/enroll',
  verb:       'POST',
  handler:    { controller: MfaController, method: 'enrollTotp', arguments: ['user'] },
  middleware: [requireAuth()],
}

const verifyTotp = {
  path:       '/totp/verify',
  verb:       'POST',
  handler:    { controller: MfaController, method: 'verifyTotp', arguments: ['request:body', 'user'] },
  middleware: [requireAuth()],
}

const sendEmailOtp = {
  path:       '/email/send',
  verb:       'POST',
  handler:    { controller: MfaController, method: 'sendEmailOtp', arguments: ['request:body', 'user'] },
  middleware: [requireAuth()],
}

const verifyEmailOtp = {
  path:       '/email/verify',
  verb:       'POST',
  handler:    { controller: MfaController, method: 'verifyEmailOtp', arguments: ['request:body', 'user'] },
  middleware: [requireAuth()],
}

export const MfaApi = new ApiSchema({
  name:      'Mfa',
  url:       '/iam/mfa',
  endpoints: [enrollTotp, verifyTotp, sendEmailOtp, verifyEmailOtp],
})
