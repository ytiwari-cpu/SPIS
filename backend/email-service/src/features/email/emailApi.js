/**
 * emailApi.js — Email feature route definitions
 *
 * All routes, middleware, and Zod validation for the email feature.
 * Endpoints: POST /email/otp, /email/invite, /email/notify
 *
 * Zod schemas are INLINE per endpoint — no named exports, no separate schema file.
 * handler.arguments declares which context values the controller method receives.
 */

import { z } from 'zod'
import { ApiSchema } from '../../../../base/apiSchema.js'
import { EmailController } from './emailController.js'

export const EmailApi = new ApiSchema({
  name:      'Email',
  url:       '/email',
  endpoints: [
    {
      path:    '/otp',
      verb:    'POST',
      handler: { controller: EmailController, method: 'sendOtp', arguments: ['request:body'] },
      request: {
        body: z.object({
          to_email:   z.string().email('Invalid email address').max(255),
          otp_code:   z.string().min(4).max(10),
          expires_at: z.string().datetime({ message: 'expires_at must be ISO datetime' }),
          locale:     z.string().max(10).default('en'),
          purpose:    z.string().max(50).default('login'),
          request_id: z.string().uuid().optional(),
        }),
      },
      response: z.object({ success: z.boolean() }).passthrough(),
    },
    {
      path:    '/invite',
      verb:    'POST',
      handler: { controller: EmailController, method: 'sendInvite', arguments: ['request:body'] },
      request: {
        body: z.object({
          to_email:    z.string().email('Invalid email address').max(255),
          invite_link: z.string().url('Invalid invite link').max(2048),
          locale:      z.string().max(10).default('en'),
          request_id:  z.string().uuid().optional(),
        }),
      },
      response: z.object({ success: z.boolean() }).passthrough(),
    },
    {
      path:    '/notify',
      verb:    'POST',
      handler: { controller: EmailController, method: 'sendNotify', arguments: ['request:body'] },
      request: {
        body: z.object({
          to_email:      z.string().email('Invalid email address').max(255),
          template_code: z.string().min(1).max(100),
          variables:     z.record(z.unknown()).default({}),
          locale:        z.string().max(10).default('en'),
          request_id:    z.string().uuid().optional(),
        }),
      },
      response: z.object({ success: z.boolean() }).passthrough(),
    },
  ],
})
