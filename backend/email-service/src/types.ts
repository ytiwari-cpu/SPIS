/**
 * SPIS Email Service — Core Types
 */

// ═══════════════════════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════════════════════

export type EmailStatus = 'queued' | 'processing' | 'sent' | 'failed'

export type EmailPurpose = 'otp' | 'invite' | 'notify'

export type ProviderName = 'sendgrid' | 'smtp'

export type ProviderStatus = 'active' | 'down' | 'cooldown'

// ═══════════════════════════════════════════════════════════════
// DB ROW TYPES
// ═══════════════════════════════════════════════════════════════

export interface EmailRequestRow {
  request_id: string
  to_email: string
  template_code: string
  payload_json: Record<string, unknown>
  status: EmailStatus
  attempts: number
  last_error: string | null
  provider_used: ProviderName | null
  created_at: string
  sent_at: string | null
}

export interface EmailProviderRow {
  provider_name: ProviderName
  status: ProviderStatus
  consecutive_failures: number
  last_heartbeat: string | null
  cooldown_until: string | null
}

export interface BounceFeedbackRow {
  id: string
  message_id: string
  to_email: string
  reason: string
  received_at: string
}

export interface RateLimitRow {
  key: string
  window_start: string
  count: number
  expires_at: string
}

export interface TemplateVersionRow {
  template_code: string
  version: number
  locale: string
  subject: string
  body: string
  created_at: string
  deprecated_at: string | null
}

// ═══════════════════════════════════════════════════════════════
// API REQUEST / RESPONSE TYPES
// ═══════════════════════════════════════════════════════════════

export interface SendOtpRequest {
  to_email: string
  otp_code: string
  expires_at: string
  locale?: string
  purpose?: string
  request_id?: string
}

export interface SendInviteRequest {
  to_email: string
  invite_link: string
  locale?: string
  request_id?: string
}

export interface SendNotifyRequest {
  to_email: string
  template_code: string
  variables: Record<string, unknown>
  locale?: string
  request_id?: string
}

export interface EmailApiResponse {
  success: boolean
  request_id: string
  status: EmailStatus
  message?: string
  error?: string
}

// ═══════════════════════════════════════════════════════════════
// QUEUE MESSAGE TYPES
// ═══════════════════════════════════════════════════════════════

export interface EmailSendMessage {
  request_id: string
  to_email: string
  template_code: string
  variables: Record<string, unknown>
  locale: string
  attempt: number
}

export interface EmailSentMessage {
  request_id: string
  to_email: string
  template_code: string
  provider: ProviderName
  sent_at: string
}

export interface EmailFailedMessage {
  request_id: string
  to_email: string
  template_code: string
  error: string
  attempts: number
  final: boolean
}

// ═══════════════════════════════════════════════════════════════
// PROVIDER ADAPTER INTERFACE
// ═══════════════════════════════════════════════════════════════

export interface RenderedEmail {
  to: string
  subject: string
  html: string
  text?: string
}

export interface SendResult {
  success: boolean
  messageId?: string
  error?: string
}

export interface EmailProviderAdapter {
  name: ProviderName
  send(email: RenderedEmail): Promise<SendResult>
  healthCheck(): Promise<boolean>
}
