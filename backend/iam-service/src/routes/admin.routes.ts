/**
 * SPIS IAM Service — Admin Routes
 * 
 * Routes for managing roles and permissions (SuperAdmin only)
 */

import { Router, type Request, type Response, type NextFunction } from 'express'
import { requireAuth, requireRoles } from '../middleware/auth.js'
import {
  getAllPermissions,
  getPermissionsByModule,
  getRolePermissions,
  grantPermissionToRole,
  revokePermissionFromRole,
  getUserPermissions,
} from '../db/repository.js'
import { logger } from '../lib/logger.js'

export const adminRouter = Router()

// All admin routes require authentication and SuperAdmin or Admin role
adminRouter.use(requireAuth(), requireRoles('SuperAdmin', 'Admin'))

/**
 * GET /admin/permissions
 * Get all available permissions
 */
adminRouter.get(
  '/permissions',
  async (_req: Request, res: Response, _next: NextFunction) => {
    try {
      const permissions = await getAllPermissions()
      
      // Group by module for easier frontend consumption
      const byModule: Record<string, typeof permissions> = {}
      for (const perm of permissions) {
        if (!byModule[perm.module]) {
          byModule[perm.module] = []
        }
        byModule[perm.module].push(perm)
      }

      return res.json({
        success: true,
        data: {
          permissions,
          byModule,
        },
      })
    } catch (error) {
      logger.error('Error fetching permissions', { error: (error as Error).message })
      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch permissions',
        },
      })
    }
  }
)

/**
 * GET /admin/permissions/module/:module
 * Get permissions by module
 */
adminRouter.get(
  '/permissions/module/:module',
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const { module } = req.params
      const permissions = await getPermissionsByModule(module)

      return res.json({
        success: true,
        data: permissions,
      })
    } catch (error) {
      logger.error('Error fetching permissions by module', { error: (error as Error).message })
      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch permissions',
        },
      })
    }
  }
)

/**
 * GET /admin/roles/:roleName/permissions
 * Get all permissions for a specific role
 */
adminRouter.get(
  '/roles/:roleName/permissions',
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const { roleName } = req.params
      const permissions = await getRolePermissions(roleName)

      return res.json({
        success: true,
        data: {
          role: roleName,
          permissions: permissions.map(p => p.permission_key),
          details: permissions,
        },
      })
    } catch (error) {
      logger.error('Error fetching role permissions', { 
        role: req.params.roleName,
        error: (error as Error).message 
      })
      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch role permissions',
        },
      })
    }
  }
)

/**
 * POST /admin/roles/:roleName/permissions
 * Grant a permission to a role
 * 
 * Body: { permission_key: string }
 */
adminRouter.post(
  '/roles/:roleName/permissions',
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const { roleName } = req.params
      const { permission_key } = req.body as { permission_key?: string }

      if (!permission_key) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'permission_key is required',
          },
        })
      }

      const grantedBy = req.user?.email || 'system'
      
      await grantPermissionToRole(roleName, permission_key, grantedBy)

      logger.info('Permission granted to role', {
        role: roleName,
        permission: permission_key,
        granted_by: grantedBy,
      })

      return res.json({
        success: true,
        message: `Permission '${permission_key}' granted to role '${roleName}'`,
      })
    } catch (error) {
      logger.error('Error granting permission', {
        role: req.params.roleName,
        error: (error as Error).message,
      })
      return res.status(500).json({
        success: false,
        error: {
          code: 'GRANT_ERROR',
          message: 'Failed to grant permission',
        },
      })
    }
  }
)

/**
 * DELETE /admin/roles/:roleName/permissions/:permissionKey
 * Revoke a permission from a role
 */
adminRouter.delete(
  '/roles/:roleName/permissions/:permissionKey',
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const { roleName, permissionKey } = req.params

      await revokePermissionFromRole(roleName, permissionKey)

      logger.info('Permission revoked from role', {
        role: roleName,
        permission: permissionKey,
        revoked_by: req.user?.email || 'system',
      })

      return res.json({
        success: true,
        message: `Permission '${permissionKey}' revoked from role '${roleName}'`,
      })
    } catch (error) {
      logger.error('Error revoking permission', {
        role: req.params.roleName,
        permission: req.params.permissionKey,
        error: (error as Error).message,
      })
      return res.status(500).json({
        success: false,
        error: {
          code: 'REVOKE_ERROR',
          message: 'Failed to revoke permission',
        },
      })
    }
  }
)

/**
 * GET /admin/users/:userId/permissions
 * Get all permissions for a specific user (via their roles)
 */
adminRouter.get(
  '/users/:userId/permissions',
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const { userId } = req.params
      const permissions = await getUserPermissions(userId)

      return res.json({
        success: true,
        data: {
          user_id: userId,
          permissions,
        },
      })
    } catch (error) {
      logger.error('Error fetching user permissions', {
        user_id: req.params.userId,
        error: (error as Error).message,
      })
      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch user permissions',
        },
      })
    }
  }
)
