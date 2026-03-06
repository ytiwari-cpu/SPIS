/**
 * backend/base/middleware/requirePermission.js
 *
 * Route-level permission enforcement middleware.
 *
 * Supports three endpoint-declaration forms:
 *
 *   1. permission: "admin.roles.view"
 *      → User must have exactly that permission.
 *
 *   2. permissionsAnyOf: ["audit.read", "admin.audit.read"]
 *      → User must have AT LEAST ONE of the listed permissions.
 *
 *   3. permissionsAllOf: ["programme.update", "programme.write"]
 *      → User must have ALL of the listed permissions.
 *
 * SuperAdmin role bypasses all permission checks (by design).
 *
 * Returns:
 *   401 if req.user is missing (not authenticated)
 *   403 if authenticated but missing required permissions
 *
 * Usage (auto-injected by ApiSchema, but can also be used manually):
 *
 *   import { requirePermission } from '../../../../base/middleware/requirePermission.js'
 *
 *   // Single
 *   app.get('/admin/users', requirePermission({ permission: 'ADMIN.USERS.VIEW' }))
 *
 *   // Any-of
 *   app.get('/audit', requirePermission({ permissionsAnyOf: ['AUDIT.READ', 'ADMIN.AUDIT.READ'] }))
 *
 *   // All-of
 *   app.post('/publish', requirePermission({ permissionsAllOf: ['PROGRAMME.EDIT', 'PROGRAMME.PUBLISH'] }))
 */

/**
 * Create permission-checking middleware from an endpoint config.
 *
 * @param {{ permission?: string, permissionsAnyOf?: string[], permissionsAllOf?: string[] }} config
 * @returns {import('express').RequestHandler}
 */
export function requirePermission(config) {
  const { permission, permissionsAnyOf, permissionsAllOf } = config

  return (req, res, next) => {
    // ── Must be authenticated ──────────────────────────────────
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      })
    }

    // ── SuperAdmin bypasses all permission checks ──────────────
    const userRoles = req.user.roles || []
    if (userRoles.includes('SuperAdmin')) {
      return next()
    }

    const userPerms = req.user.permissions || []

    // ── Single permission ──────────────────────────────────────
    if (permission) {
      if (!userPerms.includes(permission)) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: `Requires permission: ${permission}` },
        })
      }
      return next()
    }

    // ── Any-of: at least one required ──────────────────────────
    if (permissionsAnyOf && permissionsAnyOf.length > 0) {
      const hasAny = permissionsAnyOf.some(p => userPerms.includes(p))
      if (!hasAny) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: `Requires one of: ${permissionsAnyOf.join(', ')}` },
        })
      }
      return next()
    }

    // ── All-of: every permission required ──────────────────────
    if (permissionsAllOf && permissionsAllOf.length > 0) {
      const missing = permissionsAllOf.filter(p => !userPerms.includes(p))
      if (missing.length > 0) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: `Missing permissions: ${missing.join(', ')}` },
        })
      }
      return next()
    }

    // No permission config → pass through (endpoint is public or auth-only)
    next()
  }
}
