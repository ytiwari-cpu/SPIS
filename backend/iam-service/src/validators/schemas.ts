/**
 * SPIS IAM Service — Zod Request Schemas
 */

import { z } from 'zod'

// ── Password Reset ──────────────────────────────────────────

export const PasswordResetRequestSchema = z.object({
  national_id: z.string().min(1, 'National ID (TRN) is required').max(50),
})

export const PasswordResetConfirmSchema = z.object({
  national_id: z.string().min(1, 'National ID is required').max(50),
  otp: z.string().min(4, 'OTP is required').max(10),
  new_password: z.string().min(8, 'Password must be at least 8 characters').max(128),
})

// ── Invite ──────────────────────────────────────────────────

export const InviteSchema = z.object({
  registry_id: z.string().min(1, 'registry_id is required'),
  email: z.string().email('Invalid email address'),
  national_id_hash: z.string().min(1).optional(),
  national_id: z.string().min(1).max(50).optional(),
}).refine(
  (value) => Boolean(value.national_id_hash || value.national_id),
  { message: 'Either national_id_hash or national_id is required' },
)

// ── MFA: TOTP ───────────────────────────────────────────────

export const TotpVerifySchema = z.object({
  code: z.string().length(6, 'TOTP code must be 6 digits').regex(/^\d+$/, 'TOTP code must be numeric'),
})

// ── MFA: Email OTP ──────────────────────────────────────────

export const EmailOtpSendSchema = z.object({
  purpose: z.enum(['password_reset', 'mfa_email', 'invite']),
})

export const EmailOtpVerifySchema = z.object({
  code: z.string().min(4).max(10),
  purpose: z.enum(['password_reset', 'mfa_email', 'invite']),
})
