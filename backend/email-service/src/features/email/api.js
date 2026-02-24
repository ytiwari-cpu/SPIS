/**
 * email/api.js — route definitions for the email feature
 */

import { ApiSchema } from '../../../../base/apiSchema.js'
import { EmailController } from './emailController.js'

const sendOtp    = { path: '/otp',    verb: 'POST', handler: { controller: EmailController, method: 'sendOtp' },    middleware: [] }
const sendInvite = { path: '/invite', verb: 'POST', handler: { controller: EmailController, method: 'sendInvite' }, middleware: [] }
const sendNotify = { path: '/notify', verb: 'POST', handler: { controller: EmailController, method: 'sendNotify' }, middleware: [] }

export const EmailApi = new ApiSchema({
  name:      'Email',
  url:       '/email',
  endpoints: [sendOtp, sendInvite, sendNotify],
})
