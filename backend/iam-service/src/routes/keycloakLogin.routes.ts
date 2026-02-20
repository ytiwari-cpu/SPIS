/**
 * SPIS IAM Service — Keycloak Login Route
 *
 * POST /iam/keycloak/login
 *   Body: { national_id: string, password: string }
 *   Returns: Keycloak RS256 JWT token + user info + roles
 * 
 * This endpoint authenticates users via Keycloak using the
 * Resource Owner Password Credentials Grant (ROPC).
 * 
 * The returned token is signed by Keycloak using RS256 (RSA + SHA-256)
 * with Keycloak's private key. Any service can verify this token
 * using Keycloak's public key from the JWKS endpoint.
 */

import { Router, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { loginWithKeycloak } from '../services/keycloakLogin.js'
import { logger } from '../lib/logger.js'

export const keycloakLoginRouter = Router()

const LoginSchema = z.object({
  national_id: z.string().min(1, 'National ID is required').max(50),
  password: z.string().min(1, 'Password is required').max(128),
})

/**
 * POST /iam/keycloak/login
 * 
 * Authenticate user via Keycloak and return RS256 signed JWT.
 * 
 * Request Body:
 * {
 *   "national_id": "12345678901234",
 *   "password": "userPassword123"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "access_token": "eyJhbGciOiJSUzI1NiIs...",  ← RS256 signed by Keycloak
 *     "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
 *     "token_type": "Bearer",
 *     "expires_in": 300,
 *     "user_id": "local-uuid",
 *     "keycloak_sub": "keycloak-uuid",
 *     "email": "user@example.com",
 *     "roles": ["Citizen", "CaseWorker"],
 *     "permissions": ["view_family", "submit_grievance"]
 *   }
 * }
 */
keycloakLoginRouter.post(
  '/',
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      // Validate request body
      const parsed = LoginSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.errors.map((e) => e.message).join(', '),
          },
        })
      }

      const { national_id, password } = parsed.data

      // Clean national_id (digits only)
      const cleanNationalId = national_id.replaceAll(/\D/g, '')

      // Authenticate via Keycloak
      const result = await loginWithKeycloak({
        nationalId: cleanNationalId,
        password,
        ip: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
      })

      return res.json({
        success: true,
        data: result,
      })
    } catch (error) {
      const statusCode = (error as Error & { statusCode?: number }).statusCode || 500
      const message = (error as Error).message || 'Internal server error'

      if (statusCode >= 500) {
        logger.error('Keycloak login error', { error: message })
      }

      return res.status(statusCode).json({
        success: false,
        error: {
          code: statusCode === 401 ? 'INVALID_CREDENTIALS' : 'LOGIN_ERROR',
          message,
        },
      })
    }
  },
)

/**
 * GET /iam/keycloak/jwks-info
 * 
 * Returns information about Keycloak's JWKS endpoint for debugging.
 * This shows where to find the public keys used to verify tokens.
 */
keycloakLoginRouter.get(
  '/jwks-info',
  async (_req: Request, res: Response) => {
    const keycloakBase = process.env.KEYCLOAK_BASE_URL || 'http://localhost:8080'
    const realm = process.env.KEYCLOAK_REALM || 'spis-dev'

    return res.json({
      success: true,
      data: {
        description: 'Keycloak RS256 JWT verification info',
        jwks_uri: `${keycloakBase}/realms/${realm}/protocol/openid-connect/certs`,
        issuer: `${keycloakBase}/realms/${realm}`,
        algorithm: 'RS256',
        explanation: {
          step1: 'Keycloak signs tokens with PRIVATE KEY (stored in Keycloak)',
          step2: 'Backend fetches PUBLIC KEYS from JWKS endpoint',
          step3: 'Backend verifies token signature using PUBLIC KEY',
          step4: 'If valid, token is authentic and untampered',
        },
      },
    })
  },
)
