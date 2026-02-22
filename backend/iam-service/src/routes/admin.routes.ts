/**
 * SPIS IAM Service — Admin Routes
 * 
 * Routes for managing users, roles and permissions.
 * 
 * NOTE: Authorization uses PERMISSIONS only, never role names.
 * This ensures scalability — role names can be renamed/removed without code changes.
 */

import { Router, type Request, type Response, type NextFunction } from 'express'
import { requireAuth, requirePermissions } from '../middleware/auth.js'
import {
  getAllPermissions,
  getPermissionsByModule,
  getRolePermissions,
  grantPermissionToRole,
  revokePermissionFromRole,
  getUserPermissions,
  listUsers,
  getUserById,
  updateUserStatus,
  setUserRoles,
  getUserRoles,
  getAllRoles,
  getRoleByName,
  // New role CRUD functions
  createRole,
  updateRole,
  deleteRole,
  roleNameExists,
  getAllRolesEnhanced,
  replaceRolePermissions,
  restoreRole,
  permanentlyDeleteRole,
  getRoleByNameIncludingInactive,
  // Audit log functions
  getAuditLogs,
  getAuditLogById,
} from '../db/repository.js'
import { logger } from '../lib/logger.js'

export const adminRouter = Router()

// ════════════════════════════════════════════════════════════════════════════
// CURRENT USER ROUTES (require auth only)
// ════════════════════════════════════════════════════════════════════════════

/**
 * GET /me/permissions
 * Get effective permissions for the currently logged-in user
 */
adminRouter.get(
  '/me/permissions',
  requireAuth(),
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const userId = req.user?.sub as string
      const permissions = await getUserPermissions(userId)

      return res.json({
        success: true,
        data: {
          user_id: userId,
          permissions,
        },
      })
    } catch (error) {
      logger.error('Error fetching current user permissions', {
        user_id: req.user?.sub,
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

// All other admin routes require authentication and admin permissions
// NOTE: We use PERMISSIONS, not role names, for scalability
adminRouter.use(requireAuth(), requirePermissions('ADMIN.ROLES.VIEW'))

// ════════════════════════════════════════════════════════════════════════════
// USER MANAGEMENT ROUTES
// ════════════════════════════════════════════════════════════════════════════

/**
 * GET /admin/users
 * List all users with optional filters
 */
adminRouter.get(
  '/users',
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const { page, limit, status, role, search } = req.query
      
      const result = await listUsers({
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
        status: status as string | undefined,
        role: role as string | undefined,
        search: search as string | undefined,
      })

      logger.info('Fetching IAM admin users', { count: result.total, page, role })

      return res.json({
        success: true,
        data: result.users,
        pagination: {
          page: page ? parseInt(page as string, 10) : 1,
          limit: limit ? parseInt(limit as string, 10) : 20,
          total: result.total,
          totalPages: Math.ceil(result.total / (limit ? parseInt(limit as string, 10) : 20)),
        },
      })
    } catch (error) {
      logger.error('Error listing users', { error: (error as Error).message })
      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch users',
        },
      })
    }
  }
)

/**
 * GET /admin/users/:userId
 * Get a single user by ID
 */
adminRouter.get(
  '/users/:userId',
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const { userId } = req.params
      const user = await getUserById(userId)
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'User not found',
          },
        })
      }

      const roles = await getUserRoles(userId)

      return res.json({
        success: true,
        data: { ...user, roles },
      })
    } catch (error) {
      logger.error('Error fetching user', { error: (error as Error).message })
      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch user',
        },
      })
    }
  }
)

/**
 * PUT /admin/users/:userId/roles
 * Update user roles
 */
adminRouter.put(
  '/users/:userId/roles',
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const { userId } = req.params
      const { roles } = req.body as { roles: string[] }

      if (!roles || !Array.isArray(roles)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'roles must be an array',
          },
        })
      }

      await setUserRoles(userId, roles)

      logger.info('User roles updated', {
        user_id: userId,
        roles,
        updated_by: req.user?.email || 'system',
      })

      return res.json({
        success: true,
        data: { user_id: userId, roles },
      })
    } catch (error) {
      logger.error('Error updating user roles', { error: (error as Error).message })
      return res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_ERROR',
          message: 'Failed to update user roles',
        },
      })
    }
  }
)

/**
 * POST /admin/users/:userId/disable
 * Disable a user
 */
adminRouter.post(
  '/users/:userId/disable',
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const { userId } = req.params
      await updateUserStatus(userId, 'disabled')

      logger.info('User disabled', {
        user_id: userId,
        disabled_by: req.user?.email || 'system',
      })

      return res.json({
        success: true,
        message: 'User disabled',
      })
    } catch (error) {
      logger.error('Error disabling user', { error: (error as Error).message })
      return res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_ERROR',
          message: 'Failed to disable user',
        },
      })
    }
  }
)

/**
 * POST /admin/users/:userId/enable
 * Enable a user
 */
adminRouter.post(
  '/users/:userId/enable',
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const { userId } = req.params
      await updateUserStatus(userId, 'active')

      logger.info('User enabled', {
        user_id: userId,
        enabled_by: req.user?.email || 'system',
      })

      return res.json({
        success: true,
        message: 'User enabled',
      })
    } catch (error) {
      logger.error('Error enabling user', { error: (error as Error).message })
      return res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_ERROR',
          message: 'Failed to enable user',
        },
      })
    }
  }
)

// ════════════════════════════════════════════════════════════════════════════
// PERMISSION MANAGEMENT ROUTES
// ════════════════════════════════════════════════════════════════════════════

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

// ════════════════════════════════════════════════════════════════════════════
// ROLES MANAGEMENT ROUTES
// ════════════════════════════════════════════════════════════════════════════

/**
 * GET /admin/roles
 * List all roles with metadata
 * Query params:
 *   - is_active: 'true' | 'false' (default: 'true')
 */
adminRouter.get(
  '/roles',
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const isActiveParam = req.query.is_active as string | undefined
      const isActive = isActiveParam !== 'false' // Default to true
      
      const roles = await getAllRolesEnhanced(isActive)

      return res.json({
        success: true,
        data: roles,
      })
    } catch (error) {
      logger.error('Error fetching roles', { error: (error as Error).message })
      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch roles',
        },
      })
    }
  }
)

/**
 * GET /admin/roles/:roleName
 * Get role details with permissions
 */
adminRouter.get(
  '/roles/:roleName',
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const { roleName } = req.params
      
      const roleDetails = await getRoleByName(roleName)
      if (!roleDetails) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Role not found',
          },
        })
      }

      const permissions = await getRolePermissions(roleName)

      return res.json({
        success: true,
        data: {
          ...roleDetails,
          permissions,
        },
      })
    } catch (error) {
      logger.error('Error fetching role details', {
        role: req.params.roleName,
        error: (error as Error).message,
      })
      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch role details',
        },
      })
    }
  }
)

/**
 * PUT /admin/roles/:roleName/permissions
 * Replace all permissions for a role (transactional)
 * 
 * Body: { permissions: string[] }
 */
adminRouter.put(
  '/roles/:roleName/permissions',
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const { roleName } = req.params
      const { permissions } = req.body as { permissions?: string[] }

      if (!Array.isArray(permissions)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'permissions must be an array of permission keys',
          },
        })
      }

      const grantedBy = req.user?.email || 'system'
      
      // Get current permissions to determine changes
      const currentPermissions = await getRolePermissions(roleName)
      const currentKeys = currentPermissions.map(p => p.permission_key)
      
      // Determine which permissions to add/remove
      const toAdd = permissions.filter(p => !currentKeys.includes(p))
      const toRemove = currentKeys.filter(p => !permissions.includes(p))

      // Start transaction-like operations
      try {
        // Remove permissions that are no longer needed
        for (const permissionKey of toRemove) {
          await revokePermissionFromRole(roleName, permissionKey)
        }

        // Add new permissions
        for (const permissionKey of toAdd) {
          await grantPermissionToRole(roleName, permissionKey, grantedBy)
        }

        logger.info('Role permissions updated', {
          role: roleName,
          added: toAdd.length,
          removed: toRemove.length,
          updated_by: grantedBy,
        })

        return res.json({
          success: true,
          message: `Updated permissions for role '${roleName}'`,
          data: {
            added: toAdd,
            removed: toRemove,
          },
        })
      } catch (dbError) {
        logger.error('Error updating role permissions (transaction)', {
          role: roleName,
          error: (dbError as Error).message,
        })
        throw dbError
      }
    } catch (error) {
      logger.error('Error updating role permissions', {
        role: req.params.roleName,
        error: (error as Error).message,
      })
      return res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_ERROR',
          message: 'Failed to update role permissions',
        },
      })
    }
  }
)

// ════════════════════════════════════════════════════════════════════════════
// ROLE CRUD ROUTES (Full CRUD support)
// ════════════════════════════════════════════════════════════════════════════

/**
 * POST /admin/roles
 * Create a new role
 * Requires: ADMIN.ROLES.CREATE permission
 */
adminRouter.post(
  '/roles',
  requirePermissions('ADMIN.ROLES.CREATE'),
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const { role_name, display_name, description } = req.body as {
        role_name?: string
        display_name?: string
        description?: string
      }

      // Validation
      if (!role_name || !display_name) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'role_name and display_name are required',
          },
        })
      }

      // Validate role_name format (alphanumeric + underscore, no spaces)
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(role_name)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'role_name must start with a letter and contain only letters, numbers, and underscores',
          },
        })
      }

      // Check uniqueness
      const exists = await roleNameExists(role_name)
      if (exists) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'CONFLICT',
            message: `Role '${role_name}' already exists`,
          },
        })
      }

      const role = await createRole({
        role_name,
        display_name,
        description,
        created_by: req.user?.sub,
      })

      logger.info('Role created', {
        role_name,
        created_by: req.user?.email || 'system',
      })

      return res.status(201).json({
        success: true,
        data: role,
      })
    } catch (error) {
      logger.error('Error creating role', { error: (error as Error).message })
      return res.status(500).json({
        success: false,
        error: {
          code: 'CREATE_ERROR',
          message: 'Failed to create role',
        },
      })
    }
  }
)

/**
 * PATCH /admin/roles/:roleName
 * Update role name/description
 * Requires: ADMIN.ROLES.EDIT permission
 */
adminRouter.patch(
  '/roles/:roleName',
  requirePermissions('ADMIN.ROLES.EDIT'),
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const { roleName } = req.params
      const { display_name, description } = req.body as {
        display_name?: string
        description?: string
      }

      // Check if role exists
      const existingRole = await getRoleByName(roleName)
      if (!existingRole) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Role not found',
          },
        })
      }

      const updatedRole = await updateRole(roleName, { display_name, description })

      logger.info('Role updated', {
        role_name: roleName,
        updated_by: req.user?.email || 'system',
      })

      return res.json({
        success: true,
        data: updatedRole,
      })
    } catch (error) {
      logger.error('Error updating role', { error: (error as Error).message })
      return res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_ERROR',
          message: 'Failed to update role',
        },
      })
    }
  }
)

/**
 * DELETE /admin/roles/:roleName
 * Delete a custom role (system roles cannot be deleted)
 * Requires: ADMIN.ROLES.DELETE permission
 */
adminRouter.delete(
  '/roles/:roleName',
  requirePermissions('ADMIN.ROLES.DELETE'),
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const { roleName } = req.params

      // Check if role exists
      const existingRole = await getRoleByName(roleName)
      if (!existingRole) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Role not found',
          },
        })
      }

      // Check if it's a system role
      if (existingRole.is_system) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'System roles cannot be deleted',
          },
        })
      }

      const deleted = await deleteRole(roleName)

      if (!deleted) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'DELETE_ERROR',
            message: 'Failed to delete role',
          },
        })
      }

      logger.info('Role deleted', {
        role_name: roleName,
        deleted_by: req.user?.email || 'system',
      })

      return res.json({
        success: true,
        message: `Role '${roleName}' deleted`,
      })
    } catch (error) {
      logger.error('Error deleting role', { error: (error as Error).message })
      return res.status(500).json({
        success: false,
        error: {
          code: 'DELETE_ERROR',
          message: 'Failed to delete role',
        },
      })
    }
  }
)

/**
 * POST /admin/roles/:roleName/restore
 * Restore a soft-deleted role (set is_active = true)
 * Requires: ADMIN.ROLES.DELETE permission
 */
adminRouter.post(
  '/roles/:roleName/restore',
  requirePermissions('ADMIN.ROLES.DELETE'),
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const { roleName } = req.params

      // Check if role exists (including inactive)
      const existingRole = await getRoleByNameIncludingInactive(roleName)
      if (!existingRole) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Role not found',
          },
        })
      }

      // Check if it's already active
      if (existingRole.is_active) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'ALREADY_ACTIVE',
            message: 'Role is already active',
          },
        })
      }

      const restored = await restoreRole(roleName)

      if (!restored) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'RESTORE_ERROR',
            message: 'Failed to restore role',
          },
        })
      }

      logger.info('Role restored', {
        role_name: roleName,
        restored_by: req.user?.email || 'system',
      })

      return res.json({
        success: true,
        message: `Role '${roleName}' restored`,
      })
    } catch (error) {
      logger.error('Error restoring role', { error: (error as Error).message })
      return res.status(500).json({
        success: false,
        error: {
          code: 'RESTORE_ERROR',
          message: 'Failed to restore role',
        },
      })
    }
  }
)

/**
 * DELETE /admin/roles/:roleName/permanent
 * Permanently delete an inactive role from the database
 * Requires: ADMIN.ROLES.DELETE permission
 */
adminRouter.delete(
  '/roles/:roleName/permanent',
  requirePermissions('ADMIN.ROLES.DELETE'),
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const { roleName } = req.params

      // Check if role exists (including inactive)
      const existingRole = await getRoleByNameIncludingInactive(roleName)
      if (!existingRole) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Role not found',
          },
        })
      }

      // System roles cannot be permanently deleted
      if (existingRole.role_type === 'system') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'System roles cannot be permanently deleted',
          },
        })
      }

      // Active roles cannot be permanently deleted
      if (existingRole.is_active) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'ROLE_ACTIVE',
            message: 'Active roles cannot be permanently deleted. Deactivate the role first.',
          },
        })
      }

      const deleted = await permanentlyDeleteRole(roleName)

      if (!deleted) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'DELETE_ERROR',
            message: 'Failed to permanently delete role',
          },
        })
      }

      logger.info('Role permanently deleted', {
        role_name: roleName,
        deleted_by: req.user?.email || 'system',
      })

      return res.json({
        success: true,
        message: `Role '${roleName}' permanently deleted`,
      })
    } catch (error) {
      const errorMessage = (error as Error).message
      logger.error('Error permanently deleting role', { error: errorMessage })
      return res.status(500).json({
        success: false,
        error: {
          code: 'DELETE_ERROR',
          message: errorMessage || 'Failed to permanently delete role',
        },
      })
    }
  }
)

// ════════════════════════════════════════════════════════════════════════════
// AUDIT LOG ROUTES
// ════════════════════════════════════════════════════════════════════════════

/**
 * GET /admin/audit-logs
 * Query audit logs with filters
 * Requires: ADMIN.AUDITLOGS.VIEW permission
 */
adminRouter.get(
  '/audit-logs',
  requirePermissions('ADMIN.AUDITLOGS.VIEW'),
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const {
        start_date,
        end_date,
        actor_sub,
        action,
        resource_type,
        status_code,
        method,
        page,
        limit,
      } = req.query

      const result = await getAuditLogs({
        start_date: start_date as string,
        end_date: end_date as string,
        actor_sub: actor_sub as string,
        action: action as string,
        resource_type: resource_type as string,
        status_code: status_code ? parseInt(status_code as string, 10) : undefined,
        method: method as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 50,
      })

      return res.json({
        success: true,
        data: result.logs,
        pagination: {
          page: page ? parseInt(page as string, 10) : 1,
          limit: limit ? parseInt(limit as string, 10) : 50,
          total: result.total,
          totalPages: Math.ceil(result.total / (limit ? parseInt(limit as string, 10) : 50)),
        },
      })
    } catch (error) {
      logger.error('Error fetching audit logs', { error: (error as Error).message })
      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch audit logs',
        },
      })
    }
  }
)

/**
 * GET /admin/audit-logs/:id
 * Get single audit log entry
 * Requires: ADMIN.AUDITLOGS.VIEW permission
 */
adminRouter.get(
  '/audit-logs/:id',
  requirePermissions('ADMIN.AUDITLOGS.VIEW'),
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const { id } = req.params
      const log = await getAuditLogById(id)

      if (!log) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Audit log entry not found',
          },
        })
      }

      return res.json({
        success: true,
        data: log,
      })
    } catch (error) {
      logger.error('Error fetching audit log', { error: (error as Error).message })
      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch audit log',
        },
      })
    }
  }
)
