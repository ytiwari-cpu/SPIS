/**
 * SPIS IAM Service — Keycloak JWT Authentication Middleware
 *
 * Validates Keycloak RS256 tokens using JWKS public keys.
 * 
 * HOW IT WORKS:
 * 1. Extract Bearer token from Authorization header
 * 2. Decode JWT header to get `kid` (key ID)
 * 3. Fetch public keys from Keycloak JWKS endpoint
 * 4. Find the public key matching `kid`
 * 5. Verify RS256 signature: RSA_VERIFY(hash, signature, PUBLIC_KEY)
 * 6. Check token claims (issuer, expiration)
 * 7. Attach decoded payload to req.user
 */

import type { Request, Response, NextFunction } from 'express'
import { verifyKeycloakToken, type DecodedKeycloakToken } from '../lib/keycloak.js'
import { getUserPermissions } from '../db/repository.js'
import { logger } from '../lib/logger.js'

// Extend Express Request to carry Keycloak user info
declare global {
  namespace Express {
    interface Request {
      keycloakUser?: DecodedKeycloakToken & {
        permissions?: string[]
        localUserId?: string
      }
      // Keep backwards compatibility with existing code
      user?: {
        sub: string
        national_id?: string
        email?: string
        roles?: string[]
        permissions?: string[]
        [key: string]: unknown
      }
    }
  }
}

/**
 * Require a valid Keycloak RS256 JWT.
 * 
 * Verification steps:
 * 1. Extract token from "Bearer <token>" header
 * 2. Fetch JWKS from Keycloak (cached by jose library)
 * 3. Verify signature using public key (RS256)
 * 4. Validate issuer and expiration
 * 5. Optionally fetch local permissions
 */
export function requireKeycloakAuth(options?: { fetchLocalPermissions?: boolean }) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization
    
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Missing bearer token' },
      })
      return
    }

    const token = authHeader.slice(7)

    try {
      // Verify token using Keycloak's public key (RS256)
      // This fetches JWKS from Keycloak and verifies the RSA signature
      const decoded = await verifyKeycloakToken(token)

      // Extract roles from Keycloak token
      const roles = decoded.realm_access?.roles || []

      // Build user object
      const keycloakUser: Request['keycloakUser'] = {
        ...decoded,
        permissions: [],
      }

      // Optionally fetch local permissions from our DB
      if (options?.fetchLocalPermissions && decoded.sub) {
        try {
          // decoded.sub is the Keycloak user ID, we need to map it to local user
          // For now, we'll use the preferred_username (national_id) to look up permissions
          // This could be optimized with a keycloak_id → local_user_id mapping
          const permissions = await getUserPermissions(decoded.sub)
          keycloakUser.permissions = permissions
        } catch {
          // If we can't fetch permissions, continue with empty array
          logger.warn('Could not fetch local permissions for Keycloak user', { sub: decoded.sub })
        }
      }

      // Set both keycloakUser and legacy user for backwards compatibility
      req.keycloakUser = keycloakUser
      req.user = {
        sub: decoded.sub,
        national_id: decoded.preferred_username,
        email: decoded.email,
        roles: roles,
        permissions: keycloakUser.permissions,
      }

      next()
    } catch (err) {
      const message =
        (err as Error).name === 'JWTExpired'
          ? 'Token has expired'
          : (err as Error).message

      logger.warn('Keycloak JWT validation failed', { error: message })
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message },
      })
    }
  }
}

/**
 * Require specific Keycloak realm roles.
 * Must be used after requireKeycloakAuth.
 */
export function requireKeycloakRoles(...requiredRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRoles = req.keycloakUser?.realm_access?.roles || req.user?.roles || []
    
    const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role))
    
    if (!hasRequiredRole) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Required roles: ${requiredRoles.join(' or ')}`,
        },
      })
      return
    }

    next()
  }
}

/**
 * Require specific permissions (from local DB).
 * Must be used after requireKeycloakAuth with fetchLocalPermissions: true.
 */
export function requirePermissions(...requiredPermissions: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userPermissions = req.keycloakUser?.permissions || req.user?.permissions || []
    
    const hasAllPermissions = requiredPermissions.every(perm => userPermissions.includes(perm))
    
    if (!hasAllPermissions) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Required permissions: ${requiredPermissions.join(', ')}`,
        },
      })
      return
    }

    next()
  }
}

/**
 * EXPLANATION: RS256 Verification Process
 * 
 * When verifyKeycloakToken(token) is called:
 * 
 * 1. PARSE JWT
 *    Input: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImFiYzEyMyJ9.eyJzdWIiOi..."
 *    Split by ".": [header_b64, payload_b64, signature_b64]
 *    
 * 2. DECODE HEADER
 *    base64url_decode(header_b64) → { "alg": "RS256", "typ": "JWT", "kid": "abc123" }
 *    The `kid` tells us which public key to use
 * 
 * 3. FETCH JWKS (Public Keys)
 *    GET https://keycloak/realms/spis-dev/protocol/openid-connect/certs
 *    Response: {
 *      "keys": [{
 *        "kid": "abc123",        ← Match with JWT header
 *        "kty": "RSA",
 *        "alg": "RS256",
 *        "n": "0vx7agoebG...",   ← RSA modulus (part of public key)
 *        "e": "AQAB"             ← RSA exponent (part of public key)
 *      }]
 *    }
 * 
 * 4. RECONSTRUCT PUBLIC KEY
 *    From n (modulus) and e (exponent), construct RSA public key
 * 
 * 5. VERIFY SIGNATURE
 *    a. Compute hash: SHA256(header_b64 + "." + payload_b64)
 *    b. Decrypt signature with public key: RSA_PUBLIC_DECRYPT(signature)
 *    c. Compare: decrypted_signature === hash
 *    d. If match → signature is valid
 * 
 * 6. VALIDATE CLAIMS
 *    - Check `iss` (issuer) matches expected Keycloak URL
 *    - Check `exp` (expiration) is in the future
 *    - Check `aud` (audience) if required
 * 
 * WHY THIS IS SECURE:
 * - Only Keycloak has the PRIVATE KEY to create valid signatures
 * - Anyone can verify using the PUBLIC KEY
 * - If payload is modified, hash changes, signature becomes invalid
 * - If signature is modified, RSA verification fails
 */
