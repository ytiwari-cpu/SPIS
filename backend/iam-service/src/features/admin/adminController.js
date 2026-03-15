import { BaseController } from '../../../../base/baseController.js'
import { AdminService } from './adminService.js'

export class AdminController extends BaseController {
  constructor(context) {
    super(context)
    this.adminService = new AdminService(context)
  }

  // ── Current user ────────────────────────────────────────────────────────

  async getMyPermissions(user) {
    try {
      const userId      = user.sub
      const permissions = await this.adminService.getMyPermissions(userId)
      this.respondOk({ success: true, data: { user_id: userId, permissions } })
    } catch (error) {
      this.log.error('Error fetching current user permissions', { user_id: this.context.user?.sub, error: error.message })
      this.respondError({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch user permissions' } })
    }
  }

  // ── User management ─────────────────────────────────────────────────────

  async listUsers(query) {
    try {
      const { page, limit, status, role, search } = query
      const result = await this.adminService.listUsers({
        page, limit, status, role, search,
      })
      this.respondOk({
        success:    true,
        data:       result.users,
        pagination: result.pagination,
      })
    } catch (error) {
      this.log.error('Error listing users', { error: error.message })
      this.respondError({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch users' } })
    }
  }

  async getUser(params) {
    try {
      const user = await this.adminService.getUser(params.userId)
      if (!user) {
        return this.respondNotFound({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } })
      }
      this.respondOk({ success: true, data: user })
    } catch (error) {
      this.log.error('Error fetching user', { error: error.message })
      this.respondError({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch user' } })
    }
  }

  async updateUserRoles(params, body) {
    try {
      const { roles } = body
      if (!roles || !Array.isArray(roles)) {
        return this.respondBadRequest({ success: false, error: { code: 'VALIDATION_ERROR', message: 'roles must be an array' } })
      }
      const user = await this.adminService.updateUserRoles(params.userId, roles)
      this.log.info('User roles updated', { user_id: params.userId, roles, updated_by: this.context.user?.email || 'system' })
      this.respondOk({ success: true, data: user })
    } catch (error) {
      this.log.error('Error updating user roles', { error: error.message })
      this.respondError({ success: false, error: { code: 'UPDATE_ERROR', message: 'Failed to update user roles' } })
    }
  }

  async disableUser(params) {
    try {
      await this.adminService.disableUser(params.userId)
      this.respondOk({ success: true, data: { message: 'User disabled' } })
    } catch (error) {
      this.respondError({ success: false, error: { code: 'UPDATE_ERROR', message: 'Failed to disable user' } })
    }
  }

  async enableUser(params) {
    try {
      await this.adminService.enableUser(params.userId)
      this.respondOk({ success: true, data: { message: 'User enabled' } })
    } catch (error) {
      this.respondError({ success: false, error: { code: 'UPDATE_ERROR', message: 'Failed to enable user' } })
    }
  }

  // ── Roles ────────────────────────────────────────────────────────────────

  async listRoles(query) {
    try {
      const { is_active } = query
      // Default to active=true; accept 'false' string from query string
      const isActive = is_active === 'false' ? false : true
      const roles = await this.adminService.listRoles(isActive)
      this.respondOk({ success: true, data: roles })
    } catch (error) {
      this.respondError({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch roles' } })
    }
  }

  async getRole(params) {
    try {
      const role = await this.adminService.getRole(params.roleName)
      if (!role) {
        return this.respondNotFound({ success: false, error: { code: 'NOT_FOUND', message: 'Role not found' } })
      }
      this.respondOk({ success: true, data: role })
    } catch (error) {
      this.respondError({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch role' } })
    }
  }

  async createRole(body) {
    try {
      const role = await this.adminService.createRole(body)
      this.respondCreated({ success: true, data: role })
    } catch (error) {
      this.respondError({ success: false, error: { code: 'CREATE_ERROR', message: error.message } })
    }
  }

  async updateRole(params, body) {
    try {
      const { name, description, permissions } = body
      const updated = await this.adminService.updateRole(params.roleName, { name, description, permissions })
      this.respondOk({ success: true, data: updated })
    } catch (error) {
      this.respondError({ success: false, error: { code: 'UPDATE_ERROR', message: error.message } })
    }
  }

  async deleteRole(params) {
    try {
      await this.adminService.deleteRole(params.roleId)
      this.respondOk({ success: true, data: { message: 'Role soft-deleted' } })
    } catch (error) {
      this.respondError({ success: false, error: { code: 'DELETE_ERROR', message: error.message } })
    }
  }

  async restoreRole(params) {
    try {
      const restored = await this.adminService.restoreRole(params.roleName)
      this.respondOk({ success: true, data: restored })
    } catch (error) {
      this.respondError({ success: false, error: { code: 'RESTORE_ERROR', message: error.message } })
    }
  }

  async permanentDeleteRole({roleId}) {
    console.log('>>>>>>>>>>>>> role name', roleId)
    try {
      await this.adminService.permanentlyDeleteRole(roleId)
      this.respondOk({ success: true, data: { message: 'Role permanently deleted' } })
    } catch (error) {
      this.respondError({ success: false, error: { code: 'DELETE_ERROR', message: error.message } })
    }
  }

  // ── Permissions ──────────────────────────────────────────────────────────

  async listPermissions() {
    try {
      const permissions = await this.adminService.listPermissions()
      this.respondOk({ success: true, data: permissions })
    } catch (error) {
      this.respondError({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch permissions' } })
    }
  }

  async listPermissionsByModule() {
    try {
      const permissions = await this.adminService.listPermissionsByModule()
      this.respondOk({ success: true, data: permissions })
    } catch (error) {
      this.respondError({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch permissions' } })
    }
  }

  async getRolePermissions(params) {
    try {
      const permissions = await this.adminService.getRolePermissions(params.roleName)
      this.respondOk({ success: true, data: permissions })
    } catch (error) {
      this.respondError({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch role permissions' } })
    }
  }

  async updateRolePermissions(params, body) {
    try {
      const { permissions } = body
      if (!permissions || !Array.isArray(permissions)) {
        return this.respondBadRequest({ success: false, error: { code: 'VALIDATION_ERROR', message: 'permissions must be an array' } })
      }
      await this.adminService.replaceRolePermissions(params.roleName, permissions)
      this.respondOk({ success: true, data: { message: 'Role permissions updated' } })
    } catch (error) {
      this.respondError({ success: false, error: { code: 'UPDATE_ERROR', message: error.message } })
    }
  }

  async grantPermission(params, body) {
    try {
      const { permission_code } = body
      await this.adminService.grantPermission(params.roleName, permission_code, this.context.user?.sub)
      this.respondOk({ success: true, data: { message: 'Permission granted' } })
    } catch (error) {
      this.respondError({ success: false, error: { code: 'GRANT_ERROR', message: error.message } })
    }
  }

  async revokePermission(params) {
    try {
      await this.adminService.revokePermission(params.roleName, params.permissionKey)
      this.respondOk({ success: true, data: { message: 'Permission revoked' } })
    } catch (error) {
      this.respondError({ success: false, error: { code: 'REVOKE_ERROR', message: error.message } })
    }
  }

  // ── Audit logs ───────────────────────────────────────────────────────────

  async listAuditLogs(query) {
    try {
      const {
        page, limit,
        actor_sub, action, resource_type,
        method, status_code,
        start_date, end_date,
      } = query
      const result = await this.adminService.listAuditLogs({
        page,
        limit,
        actor_sub,
        action,
        resource_type,
        method,
        status_code,
        start_date,
        end_date,
      })
      this.respondOk({
        success:    true,
        data:       result.logs,
        pagination: result.pagination,
      })
    } catch (error) {
      this.respondError({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch audit logs' } })
    }
  }

  async getAuditLog(params) {
    try {
      const log = await this.adminService.getAuditLog(params.logId)
      if (!log) {
        return this.respondNotFound({ success: false, error: { code: 'NOT_FOUND', message: 'Audit log not found' } })
      }
      this.respondOk({ success: true, data: log })
    } catch (error) {
      this.respondError({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch audit log' } })
    }
  }
}
