// base/auth/signToken.js
import { SignJWT } from 'jose'

/**
 * Sign a SPIS access token with permissions embedded in the payload.
 *
 * @param {{ userId: string, email: string, roles: string[], permissions: string[], registryId?: string }} claims
 *   — do NOT include nationalId; it is PII and must never be in a JWT payload (see N7)
 * @param {{ secret: string, expiresInSeconds: number, issuer: string, audience: string }} config
 * @returns {Promise<string>} signed JWT
 */
export async function signToken(claims, config) {
  const secret = new TextEncoder().encode(config.secret)
  const now    = Math.floor(Date.now() / 1000)

  // ⚠️ national_id is NOT included in the JWT payload. JWTs are only signed, not encrypted —
  // the payload is base64url-encoded and readable by anyone who holds the token.
  // national_id is the most sensitive PII in the system and must never travel in a JWT.
  // Use user_id (sub) + registry_id for all identity lookups; fetch national_id from the DB
  // only when explicitly required by a permissioned endpoint.
  return await new SignJWT({
    sub:         claims.userId,
    email:       claims.email,
    // national_id intentionally omitted — PII, never put in JWT payload
    roles:       claims.roles        || [],
    permissions: claims.permissions  || [],   // ← embedded — zero DB queries per request
    registry_id: claims.registryId   || undefined,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(now)
    .setExpirationTime(now + config.expiresInSeconds)
    .setIssuer(config.issuer)
    .setAudience(config.audience)
    .sign(secret)
}
