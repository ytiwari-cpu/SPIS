/**
 * backend/base/middleware/requirePermission.js
 *
 * Route-level permission enforcement middleware.
 *
 * Supports three endpoint-declaration forms:
 *
 *   1. permission: "x"           → requires permission x
 *   2. permission: ["x", "y"]    → requires BOTH x AND y
 *   3. permission: { anyOf: ["x", "y"] } → requires at least ONE of x, y
 *
 * No role-based bypass — SuperAdmin has all permissions assigned at the DB level.
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
 *   // AND (array)
 *   app.post('/publish', requirePermission({ permission: ['PROGRAMME.EDIT', 'PROGRAMME.PUBLISH'] }))
 *
 *   // OR (anyOf)
 *   app.get('/audit', requirePermission({ permission: { anyOf: ['AUDIT.READ', 'ADMIN.AUDIT.READ'] } }))
 */

/**
 * Create permission-checking middleware from an endpoint config.
 *
 * @param {{ permission?: string | string[] | { anyOf: string[] } }} config
 * @returns {import('express').RequestHandler}
 */
export function requirePermission(config) {
  const { permission } = config

  return (req, res, next) => {
    // ── Must be authenticated ──────────────────────────────────
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error:   { code: 'UNAUTHORIZED', message: 'Authentication required' },
      })
    }

    const userPerms = req.user.permissions || []

    // ── String: single required permission ─────────────────────
    if (typeof permission === 'string') {
      if (!userPerms.includes(permission)) {
        return res.status(403).json({
          success: false,
          error:   { code: 'FORBIDDEN', message: `Requires permission: ${permission}` },
        })
      }
      return next()
    }

    // ── Array: AND semantics — all must be present ─────────────
    if (Array.isArray(permission)) {
      const missing = permission.filter(p => !userPerms.includes(p))
      if (missing.length > 0) {
        return res.status(403).json({
          success: false,
          error:   { code: 'FORBIDDEN', message: `Missing permissions: ${missing.join(', ')}` },
        })
      }
      return next()
    }

    // ── Object { anyOf }: OR semantics — at least one ──────────
    if (permission && typeof permission === 'object' && Array.isArray(permission.anyOf)) {
      const hasAny = permission.anyOf.some(p => userPerms.includes(p))
      if (!hasAny) {
        return res.status(403).json({
          success: false,
          error:   { code: 'FORBIDDEN', message: `Requires one of: ${permission.anyOf.join(', ')}` },
        })
      }
      return next()
    }

    // No permission config → pass through (endpoint is public or auth-only)
    next()
  }
}
