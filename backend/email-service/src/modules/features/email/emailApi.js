/**
 * emailApi.js — Email feature route definitions
 *
 * All routes, middleware, and Zod validation for the email feature.
 * Endpoints: POST /email/otp, /email/invite, /email/notify
 *
 * Zod schemas are defined inline — no separate validator file.
 */

import { z } from 'zod'
import { ApiSchema } from '../../../../../base/apiSchema.js'
import { EmailController } from './emailController.js'

// ═══════════════════════════════════════════════════════════════
// ZOD SCHEMAS (inline — single source of truth)
// ═══════════════════════════════════════════════════════════════

export const SendOtpSchema = z.object({
  to_email:   z.string().email('Invalid email address'),
  otp_code:   z.string().min(4).max(10),
  expires_at: z.string().datetime({ message: 'expires_at must be ISO datetime' }),
  locale:     z.string().max(10).default('en'),
  purpose:    z.string().max(50).default('login'),
  request_id: z.string().uuid().optional(),
})

export const SendInviteSchema = z.object({
  to_email:    z.string().email('Invalid email address'),
  invite_link: z.string().url('Invalid invite link'),
  locale:      z.string().max(10).default('en'),
  request_id:  z.string().uuid().optional(),
})

export const SendNotifySchema = z.object({
  to_email:      z.string().email('Invalid email address'),
  template_code: z.string().min(1).max(100),
  variables:     z.record(z.unknown()).default({}),
  locale:        z.string().max(10).default('en'),
  request_id:    z.string().uuid().optional(),
})

// ═══════════════════════════════════════════════════════════════
// ROUTE DEFINITIONS
// ═══════════════════════════════════════════════════════════════

const sendOtp = {
  path:       '/otp',
  verb:       'POST',
  handler:    { controller: EmailController, method: 'sendOtp' },
  middleware: [],
  validation: { body: SendOtpSchema },
}

const sendInvite = {
  path:       '/invite',
  verb:       'POST',
  handler:    { controller: EmailController, method: 'sendInvite' },
  middleware: [],
  validation: { body: SendInviteSchema },
}

const sendNotify = {
  path:       '/notify',
  verb:       'POST',
  handler:    { controller: EmailController, method: 'sendNotify' },
  middleware: [],
  validation: { body: SendNotifySchema },
}

export const EmailApi = new ApiSchema({
  name:      'Email',
  url:       '/email',
  endpoints: [sendOtp, sendInvite, sendNotify],
})
