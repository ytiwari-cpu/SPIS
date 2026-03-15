// base/auth/mfaCipher.js
import crypto from 'crypto'

const ALGORITHM  = 'aes-256-gcm'
const IV_LENGTH  = 16    // 128-bit IV

/**
 * Get the 32-byte AES key from env.
 * MFA_ENCRYPTION_KEY must be a 64-character hex string.
 * Generate once with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
function getKey() {
  const hex = process.env.MFA_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error('MFA_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)')
  }
  return Buffer.from(hex, 'hex')
}

/**
 * Encrypt a TOTP hex secret for storage.
 * Output format: "iv:ciphertext:authTag" (all base64url-encoded)
 */
export function encryptSecret(plaintext) {
  const key    = getKey()
  const iv     = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(plaintext, 'utf8', 'base64url')
  encrypted += cipher.final('base64url')
  const tag = cipher.getAuthTag().toString('base64url')
  return `${iv.toString('base64url')}:${encrypted}:${tag}`
}

/**
 * Decrypt a TOTP secret from storage.
 * Input format: "iv:ciphertext:authTag" (all base64url-encoded)
 */
export function decryptSecret(stored) {
  const key = getKey()
  const [ivB64, ciphertextB64, tagB64] = stored.split(':')
  const iv  = Buffer.from(ivB64, 'base64url')
  const tag = Buffer.from(tagB64, 'base64url')
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  let decrypted = decipher.update(ciphertextB64, 'base64url', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

/**
 * Detect whether a stored value is already encrypted.
 * Plaintext TOTP secrets are hex strings ([0-9a-f]+) — they NEVER contain ':'.
 * Encrypted values are always in "iv:ciphertext:tag" format with exactly 2 ':' separators.
 */
export function isEncrypted(value) {
  if (!value || typeof value !== 'string') {
    return false
  }
  return value.includes(':') && value.split(':').length === 3
}
