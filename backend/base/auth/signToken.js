// base/auth/signToken.js
import { SignJWT } from 'jose'

/**
 * Sign a SPIS access token with permissions embedded in the payload.
 *
 * @param {{ userId: string, email: string, nationalId?: string, roles: string[], permissions: string[], registryId?: string }} claims
 * @param {{ secret: string, expiresInSeconds: number, issuer: string, audience: string }} config
 * @returns {Promise<string>} signed JWT
 */
export async function signToken(claims, config) {
  const secret = new TextEncoder().encode(config.secret)
  const now    = Math.floor(Date.now() / 1000)

  return await new SignJWT({
    sub:         claims.userId,
    email:       claims.email,
    national_id: claims.nationalId   || undefined,
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
