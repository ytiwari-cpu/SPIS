/**
 * SPIS IAM Service — JWT Authentication Middleware
 *
 * Validates Bearer tokens using HS256 (jose library).
 * Attaches decoded payload to req.user.
 */

import type { Request, Response, NextFunction } from 'express'
import { jwtVerify } from 'jose'
import { config } from '../config.js'
import { logger } from '../lib/logger.js'

const secretKey = new TextEncoder().encode(config.jwt.secret)

// Extend Express Request to carry user info
declare global {
  namespace Express {
    interface Request {
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
 * Require a valid JWT. Rejects with 401 if missing/invalid.
 */
export function requireAuth() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Missing bearer token' },
      })
      return
    }

    const token = authHeader.slice(7)

    try {
      const { payload } = await jwtVerify(token, secretKey, {
        issuer: config.jwt.issuer,
        audience: config.jwt.audience,
      })

      // Reject tokens issued before server start (development feature)
      if (payload.iat && payload.iat < config.jwt.serverStartTime) {
        logger.warn('Token issued before server start - rejecting', { 
          issued_at: payload.iat, 
          server_start: config.jwt.serverStartTime 
        })
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Token invalidated by server restart' },
        })
        return
      }

      req.user = {
        sub: payload.sub as string,
        national_id: payload.national_id as string | undefined,
        email: payload.email as string | undefined,
        roles: payload.roles as string[] | undefined,
        permissions: payload.permissions as string[] | undefined,
      }

      next()
    } catch (err) {
      const message =
        (err as Error).name === 'JWTExpired'
          ? 'Token has expired'
          : (err as Error).message

      logger.warn('JWT validation failed', { error: message })
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message },
      })
    }
  }
}

/**
 * Require specific roles. Must be used after requireAuth.
 */
export function requireRoles(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRoles = req.user?.roles || []
    const hasRole = roles.some(r => userRoles.includes(r))
    if (!hasRole) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: `Requires one of: ${roles.join(', ')}` },
      })
      return
    }
    next()
  }
}

/**
 * Require specific permissions. Must be used after requireAuth.
 */
export function requirePermissions(...permissions: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userPermissions = req.user?.permissions || []
    const hasPermission = permissions.some(p => userPermissions.includes(p))
    if (!hasPermission) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: `Requires one of: ${permissions.join(', ')}` },
      })
      return
    }
    next()
  }
}
