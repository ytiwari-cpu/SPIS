import axios from 'axios'

// ════════════════════════════════════════════════════════════════════════════
// IAM SERVICE CLIENT
// ════════════════════════════════════════════════════════════════════════════

const IAM_BASE_URL = 'http://localhost:3003'

const iamApi = axios.create({
  baseURL: IAM_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})

// ════════════════════════════════════════════════════════════════════════════
// PASSWORD RESET API
// ════════════════════════════════════════════════════════════════════════════

export interface PasswordResetRequestPayload {
  national_id: string
}

export interface PasswordResetRequestResponse {
  success: boolean
  message: string
  otp_id: string
}

export interface PasswordResetConfirmPayload {
  national_id: string
  otp: string
  new_password: string
}

export interface PasswordResetConfirmResponse {
  success: boolean
  message: string
  user_id: string
}

/**
 * Request OTP for password reset by national ID
 */
export async function requestPasswordReset(
  nationalId: string,
): Promise<PasswordResetRequestResponse> {
  const response = await iamApi.post<PasswordResetRequestResponse>(
    '/iam/password-reset/request',
    { national_id: normalizeNationalId(nationalId) },
  )
  return response.data
}

/**
 * Confirm password reset with OTP and new password
 */
export async function confirmPasswordReset(
  nationalId: string,
  otp: string,
  newPassword: string,
): Promise<PasswordResetConfirmResponse> {
  const response = await iamApi.post<PasswordResetConfirmResponse>(
    '/iam/password-reset/confirm',
    {
      national_id: normalizeNationalId(nationalId),
      otp,
      new_password: newPassword,
    },
  )
  return response.data
}

// ════════════════════════════════════════════════════════════════════════════
// UTILITIES
// ════════════════════════════════════════════════════════════════════════════

function normalizeNationalId(value: string): string {
  return value.replace(/\D/g, '')
}
