import { Request, Response, NextFunction } from 'express'
import { jwtVerify } from 'jose'

// ─── Configuration ───────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'spis-iam-jwt-secret-change-in-production-2024'
const JWT_ISSUER = process.env.JWT_ISSUER || 'spis-iam'
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'spis'

const secretKey = new TextEncoder().encode(JWT_SECRET)

const SERVER_START_TIME = Date.now()

// Extend Express Request to carry decoded user info
export interface AuthenticatedRequest extends Request {
    user?: {
        sub: string
        national_id: string
        email?: string
        roles?: string[]
        permissions?: string[]
        [key: string]: unknown
    }
}

/**
 * Express middleware that validates JWT Bearer tokens.
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

    const token = authHeader.slice(7)

    try {
        const { payload } = await jwtVerify(token, secretKey, {
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE,
        })

        const tokenIssuedAt = (payload.iat as number) * 1000
        if (tokenIssuedAt < SERVER_START_TIME) {
            res.status(401).json({
                success: false,
                error: 'Token is no longer valid. Please login again.',
            })
            return
        }

        req.user = {
            sub: payload.sub as string,
            national_id: payload.national_id as string,
            email: payload.email as string | undefined,
            roles: payload.roles as string[] | undefined,
            permissions: payload.permissions as string[] | undefined,
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

/**
 * Role-checking middleware factory.
 * Usage: requireRole('SuperAdmin', 'ProgrammeManager')
 */
export function requireRole(...allowedRoles: string[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
        const userRoles = req.user?.roles || []
        const hasRole = allowedRoles.some(r => userRoles.includes(r))
        if (!hasRole) {
            res.status(403).json({
                success: false,
                error: `Requires one of: ${allowedRoles.join(', ')}`,
            })
            return
        }
        next()
    }
}

/**
 * Permission-checking middleware factory (OR semantics).
 *
 * Accepts one or more permission keys. Access is granted if the user has
 * ANY ONE of the listed permissions.
 *
 * SuperAdmin role bypasses all permission checks (they have full access by
 * design — this is intentional, not a bug; do NOT remove this bypass).
 *
 * Usage:
 *   requirePermission('ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.PROGRAMMES.VIEW')
 */
export function requirePermission(...requiredPerms: string[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
        const userRoles = req.user?.roles || []
        const userPerms = req.user?.permissions || []

        // SuperAdmin bypasses ALL permission checks — this is by design.
        // SuperAdmin is a god-mode account with unrestricted access.
        if (userRoles.includes('SuperAdmin')) {
            next()
            return
        }

        const hasAny = requiredPerms.some(p => userPerms.includes(p))
        if (!hasAny) {
            res.status(403).json({
                success: false,
                error: `Insufficient permissions. Requires: ${requiredPerms.join(' or ')}`,
            })
            return
        }
        next()
    }
}
