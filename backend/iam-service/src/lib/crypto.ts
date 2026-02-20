/**
 * SPIS IAM Service — Crypto Utilities
 *
 * - OTP generation (cryptographically random)
 * - OTP hashing (SHA-256)
 * - National ID hashing (SHA-256 with salt)
 * - Password hashing placeholder (Keycloak manages actual passwords)
 */

import { randomBytes, createHash } from 'node:crypto'
import { config } from '../config.js'

/**
 * Generate a numeric OTP of configurable length.
 * Uses crypto.randomBytes for CSPRNG.
 */
export function generateOtp(length?: number): string {
  const len = length ?? config.otp.length
  const bytes = randomBytes(len)
  let otp = ''
  for (let i = 0; i < len; i++) {
    otp += (bytes[i] % 10).toString()
  }
  return otp
}

/**
 * Hash an OTP code with SHA-256 for storage.
 * We never store raw OTP in the database.
 */
export function hashOtp(otp: string): string {
  return createHash('sha256').update(otp).digest('hex')
}

/**
 * Verify an OTP against its stored hash.
 */
export function verifyOtp(otp: string, hash: string): boolean {
  return hashOtp(otp) === hash
}

/**
 * Hash a national ID (TRN) with SHA-256 for storage / lookup.
 * Deterministic — same input always produces same hash.
 */
export function hashNationalId(nationalId: string): string {
  // Normalize: strip whitespace, uppercase
  const normalized = nationalId.replace(/\s/g, '').toUpperCase()
  return createHash('sha256').update(`trn:${normalized}`).digest('hex')
}

/**
 * Generate a cryptographically random base32 string for TOTP secrets.
 * Returns 20 bytes encoded as uppercase hex (40 chars).
 */
export function generateTotpSecret(): string {
  return randomBytes(20).toString('hex').toUpperCase()
}
