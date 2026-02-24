/**
 * SPIS IAM Service — Core Types
 */

// ═══════════════════════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════════════════════

export type UserStatus = 'pending' | 'active' | 'locked' | 'disabled'

// System roles plus any custom role name (string)
export type SystemRoleName = 'Citizen' | 'CaseWorker' | 'ProgrammeManager' | 'Admin' | 'SuperAdmin' | 'Worker'
export type RoleName = string

export type MfaFactorType = 'totp' | 'sms' | 'email'

export type MfaFactorStatus = 'pending' | 'active' | 'disabled'

export type LoginOutcome = 'success' | 'fail_password' | 'fail_mfa' | 'fail_locked' | 'fail_disabled'

export type OtpPurpose = 'password_reset' | 'mfa_email' | 'invite' | 'worker_registration' | 'otp_login'

// ═══════════════════════════════════════════════════════════════
// DB ROW TYPES  (auth_db)
// ═══════════════════════════════════════════════════════════════

export interface UserRow {
  user_id: string           // UUID PK
  email: string             // login identifier
  mfa_enabled: boolean
  mfa_secret: string | null // encrypted TOTP secret
  status: UserStatus
  registry_id: string | null  // FK reference to registry service
  national_id_hash: string | null  // hashed TRN
  failed_login_attempts: number
  locked_until: string | null
  created_at: string
  updated_at: string
}

export interface UserRoleRow {
  user_id: string
  role_name: string  // Can be system or custom role
  created_at: string
}

export interface MfaFactorRow {
  id: string                // UUID PK
  user_id: string
  factor_type: MfaFactorType
  secret: string | null     // TOTP secret (encrypted)
  phone: string | null      // SMS number
  email: string | null      // email for OTP
  status: MfaFactorStatus
  created_at: string
  updated_at: string
}

export interface LoginEventRow {
  id: string                // UUID PK
  user_id: string
  ip: string
  user_agent: string
  outcome: LoginOutcome
  created_at: string
}

export interface PasswordResetTokenRow {
  id: string                // UUID PK
  user_id: string
  otp_hash: string          // hashed OTP
  purpose: OtpPurpose
  expires_at: string
  attempt_count: number
  max_attempts: number
  used: boolean
  created_at: string
}

// ═══════════════════════════════════════════════════════════════
// API REQUEST / RESPONSE TYPES
// ═══════════════════════════════════════════════════════════════

export interface PasswordResetRequestBody {
  national_id: string
}

export interface PasswordResetConfirmBody {
  national_id: string
  otp: string
  new_password: string
}

export interface InviteRequestBody {
  registry_id: string
  email: string
  national_id_hash?: string
  national_id?: string
}

export interface TotpEnrollResponse {
  provisioning_uri: string
  qr_code: string           // data URI (PNG)
  secret: string            // base32 secret for manual entry
}

export interface TotpVerifyBody {
  code: string
}

export interface EmailOtpSendBody {
  purpose: OtpPurpose
}

export interface EmailOtpVerifyBody {
  code: string
  purpose: OtpPurpose
}

export interface IamApiResponse {
  success: boolean
  message?: string
  data?: unknown
  error?: { code: string; message: string }
}

// ═══════════════════════════════════════════════════════════════
// EVENT PAYLOADS  (RabbitMQ)
// ═══════════════════════════════════════════════════════════════

/** Inbound from Registry */
export interface CreateAuthAccountEvent {
  registry_id: string
  email: string
  national_id_hash?: string
  national_id?: string
}

/** Inbound from Registry */
export interface UserContactUpdatedEvent {
  registry_id: string
  email?: string
  phone?: string
}

/** Inbound from Registry */
export interface UserDeletedEvent {
  registry_id: string
}

/** Outbound from IAM */
export interface AuthAccountCreatedEvent {
  user_id: string
  registry_id: string
  email: string
}

/** Outbound from IAM */
export interface PasswordResetRequestedEvent {
  user_id: string
  registry_id: string
  channel: 'email'
  otp_id: string
}

/** Outbound from IAM */
export interface MfaEnabledEvent {
  user_id: string
  factor_type: MfaFactorType
  timestamp: string
}

// ═══════════════════════════════════════════════════════════════
// KEYCLOAK TYPES
// ═══════════════════════════════════════════════════════════════

export interface KeycloakUserPayload {
  username: string
  email: string
  enabled: boolean
  attributes?: Record<string, string[]>
  credentials?: Array<{
    type: string
    value: string
    temporary: boolean
  }>
}

// ═══════════════════════════════════════════════════════════════
// JWT / GATEWAY TYPES
// ═══════════════════════════════════════════════════════════════

export interface JwtPayload {
  sub: string               // user_id
  registry_id?: string
  roles?: string[]
  acr?: string              // MFA level
  auth_time?: number
  iss: string
  aud: string | string[]
  exp: number
  iat: number
}
