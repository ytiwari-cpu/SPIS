/**
 * backend/base/middleware/requireAuth.js
 *
 * Centralized JWT authentication middleware for all SPIS backend services.
 *
 * Extracted from family-service and iam-service (both had near-identical copies).
 * Uses jose HS256 verification.
 *
 * Usage:
 *   import { requireAuth, requirePermissions } from '../../../../base/middleware/requireAuth.js'
 *
 *   // Basic auth
 *   app.use(requireAuth({ jwtSecret: 'xxx', jwtIssuer: 'SPIS', jwtAudience: 'spis-api' }))
 *
 *   // Permission guard
 *   app.use('/families', requireAuth(opts), requirePermissions('family:read'))
 */

import { jwtVerify } from 'jose'

/**
 * @typedef {{
 *   jwtSecret?: string,
 *   jwtIssuer?: string,
 *   jwtAudience?: string,
 *   serverStartTime?: number,
 *   logger?: { warn: Function },
 * }} AuthOptions
 */

/**
 * Require a valid JWT Bearer token. Populates req.user on success.
 *
 * @param {AuthOptions} [options]
 * @returns {import('express').RequestHandler}
 */
export function requireAuth(options = {}) {
  const secret    = options.jwtSecret    || process.env.JWT_SECRET
  const issuer    = options.jwtIssuer    || process.env.JWT_ISSUER
  const audience  = options.jwtAudience  || process.env.JWT_AUDIENCE
  const startTime = options.serverStartTime ?? (process.env.SERVER_START_TIME ? parseInt(process.env.SERVER_START_TIME, 10) : null)
  const log       = options.logger || { warn: (msg, meta) => console.warn(`[WARN] ${msg}`, meta ?? '') }

  if (!secret) {
    throw new Error('requireAuth: JWT_SECRET must be provided via options or environment variable')
  }

  const secretKey = new TextEncoder().encode(secret)

  return async (req, res, next) => {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing bearer token' } })
      return
    }

    const token = authHeader.slice(7)

    try {
      const verifyOpts = {}
      if (issuer)   verifyOpts.issuer   = issuer
      if (audience) verifyOpts.audience  = audience

      const { payload } = await jwtVerify(token, secretKey, verifyOpts)

      // Reject tokens issued before the last server restart
      if (startTime && payload.iat && payload.iat < startTime) {
        res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Token invalidated by server restart' } })
        return
      }

      req.user = {
        sub:         payload.sub,
        national_id: payload.national_id,
        email:       payload.email,
        roles:       payload.roles   || [],
        permissions: payload.permissions || [],
      }

      next()
    } catch (err) {
      const message = err.name === 'JWTExpired' ? 'Token has expired' : err.message
      log.warn('JWT validation failed', { error: message })
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message } })
    }
  }
}

/**
 * Require specific permissions. Must be used after requireAuth().
 * SuperAdmin bypasses all permission checks.
 *
 * @param {...string} permissions
 * @returns {import('express').RequestHandler}
 */
export function requirePermissions(...permissions) {
  return (req, res, next) => {
    const userRoles = req.user?.roles || []
    if (userRoles.includes('SuperAdmin')) return next()

    const userPerms = req.user?.permissions || []
    const hasPerm = permissions.some(p => userPerms.includes(p))
    if (!hasPerm) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: `Requires one of: ${permissions.join(', ')}` },
      })
      return
    }
    next()
  }
}
