import { Request, Response, NextFunction } from 'express'
import { jwtVerify } from 'jose'

// ─── Configuration ───────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'spis-iam-jwt-secret-change-in-production-2024'
const JWT_ISSUER = process.env.JWT_ISSUER || 'spis-iam'
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'spis'

const secretKey = new TextEncoder().encode(JWT_SECRET)

// Server start time - tokens issued before this are invalid
const SERVER_START_TIME = Date.now()

// Extend Express Request to carry decoded user info
export interface AuthenticatedRequest extends Request {
  user?: {
    sub: string
    national_id: string
    email?: string
    roles?: string[]
    permissions?: string[]  // ADDED: Permission-based authorization
    [key: string]: unknown
  }
}

/**
 * Express middleware that validates JWT Bearer tokens.
 * Extracts token from `Authorization: Bearer <token>` header.
 * On success, populates `req.user` with the decoded payload.
 * Invalidates tokens issued before server start time.
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'Authentication required. Provide a valid Bearer token.',
    })
    return
  }

  const token = authHeader.slice(7) // strip "Bearer "

  try {
    const { payload } = await jwtVerify(token, secretKey, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    })

    // Check if token was issued before server started (invalidate old tokens)
    const tokenIssuedAt = (payload.iat as number) * 1000 // Convert to milliseconds
    if (tokenIssuedAt < SERVER_START_TIME) {
      res.status(401).json({
        success: false,
        error: 'Token is no longer valid. Please login again.',
      })
      return
    }

    // Attach decoded user to request (including permissions for authorization)
    req.user = {
      sub: payload.sub as string,
      national_id: payload.national_id as string,
      email: payload.email as string | undefined,
      roles: payload.roles as string[] | undefined,
      permissions: payload.permissions as string[] | undefined,  // ADDED
    }

    next()
  } catch (err) {
    const message =
      (err as Error).name === 'JWTExpired'
        ? 'Token has expired. Please login again.'
        : 'Invalid or malformed token.'

    res.status(401).json({
      success: false,
      error: message,
    })
  }
}
