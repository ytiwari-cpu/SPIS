/**
 * SPIS Email Service — Request Validation Schemas
 */

import { z } from 'zod'

export const SendOtpSchema = z.object({
  to_email: z.string().email('Invalid email address'),
  otp_code: z.string().min(4).max(10),
  expires_at: z.string().datetime({ message: 'expires_at must be ISO datetime' }),
  locale: z.string().max(10).default('en'),
  purpose: z.string().max(50).default('login'),
  request_id: z.string().uuid().optional(),
})

export const SendInviteSchema = z.object({
  to_email: z.string().email('Invalid email address'),
  invite_link: z.string().url('Invalid invite link'),
  locale: z.string().max(10).default('en'),
  request_id: z.string().uuid().optional(),
})

export const SendNotifySchema = z.object({
  to_email: z.string().email('Invalid email address'),
  template_code: z.string().min(1).max(100),
  variables: z.record(z.unknown()).default({}),
  locale: z.string().max(10).default('en'),
  request_id: z.string().uuid().optional(),
})
