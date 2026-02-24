import { BaseController } from '../../../../base/baseController.js'
import { AdminService } from './adminService.js'
import { AdminRepository } from './adminRepository.js'
import { logger } from '../../lib/logger.js'

export class AdminController extends BaseController {
  constructor(ctx) {
    super(ctx)
    const repo = new AdminRepository(ctx)
    this.service = new AdminService(repo)
  }

  // ── Current user ────────────────────────────────────────────────────────

  async getMyPermissions() {
    try {
      const userId      = this.context.user.sub
      const permissions = await this.service.getMyPermissions(userId)
      this.respondOk({ success: true, data: { user_id: userId, permissions } })
    } catch (error) {
      logger.error('Error fetching current user permissions', { user_id: this.context.user?.sub, error: error.message })
      this.respondError({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch user permissions' } })
    }
  }

  // ── User management ─────────────────────────────────────────────────────

  async listUsers() {
    try {
      const { page, limit, status, role, search } = this.context.request.query
      const result   = await this.service.listUsers({
        page:   page   ? parseInt(page, 10)  : 1,
        limit:  limit  ? parseInt(limit, 10) : 20,
        status, role, search,
      })
      const pageNum  = page  ? parseInt(page, 10)  : 1
      const limitNum = limit ? parseInt(limit, 10) : 20
      this.respondOk({
        success: true,
        data: result.users,
        pagination: { page: pageNum, limit: limitNum, total: result.total, totalPages: Math.ceil(result.total / limitNum) },
      })
    } catch (error) {
      logger.error('Error listing users', { error: error.message })
      this.respondError({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch users' } })
    }
  }

  async getUser() {
    try {
      const { userId } = this.context.request.params
      const user = await this.service.getUser(userId)
      if (!user) return this.respondNotFound({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } })
      this.respondOk({ success: true, data: user })
    } catch (error) {
      logger.error('Error fetching user', { error: error.message })
      this.respondError({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch user' } })
    }
  }

  async updateUserRoles() {
    try {
      const { userId } = this.context.request.params
      const { roles }  = this.context.request.body
      if (!roles || !Array.isArray(roles)) {
        return this.respondBadRequest({ success: false, error: { code: 'VALIDATION_ERROR', message: 'roles must be an array' } })
      }
      const user = await this.service.updateUserRoles(userId, roles)
      logger.info('User roles updated', { user_id: userId, roles, updated_by: this.context.user?.email || 'system' })
      this.respondOk({ success: true, data: user })
    } catch (error) {
      logger.error('Error updating user roles', { error: error.message })
      this.respondError({ success: false, error: { code: 'UPDATE_ERROR', message: 'Failed to update user roles' } })
    }
  }

  async disableUser() {
    try {
      await this.service.disableUser(this.context.request.params.userId)
      this.respondOk({ success: true, data: { message: 'User disabled' } })
    } catch (error) {
      this.respondError({ success: false, error: { code: 'UPDATE_ERROR', message: 'Failed to disable user' } })
    }
  }

  async enableUser() {
    try {
      await this.service.enableUser(this.context.request.params.userId)
      this.respondOk({ success: true, data: { message: 'User enabled' } })
    } catch (error) {
      this.respondError({ success: false, error: { code: 'UPDATE_ERROR', message: 'Failed to enable user' } })
    }
  }

  // ── Roles ────────────────────────────────────────────────────────────────

  async listRoles() {
    try {
      const { is_active } = this.context.request.query
      // Default to active=true; accept 'false' string from query string
      const isActive = is_active === 'false' ? false : true
      const roles = await this.service.listRoles(isActive)
      this.respondOk({ success: true, data: roles })
    } catch (error) {
      this.respondError({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch roles' } })
    }
  }

  async getRole() {
    try {
      const role = await this.service.getRole(this.context.request.params.roleName)
      if (!role) return this.respondNotFound({ success: false, error: { code: 'NOT_FOUND', message: 'Role not found' } })
      this.respondOk({ success: true, data: role })
    } catch (error) {
      this.respondError({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch role' } })
    }
  }

  async createRole() {
    try {
      const { name, description, permissions } = this.context.request.body
      if (!name) return this.respondBadRequest({ success: false, error: { code: 'VALIDATION_ERROR', message: 'name is required' } })
      const role = await this.service.createRole({ name, description, permissions: permissions || [] })
      this.respondCreated({ success: true, data: role })
    } catch (error) {
      this.respondError({ success: false, error: { code: 'CREATE_ERROR', message: error.message } })
    }
  }

  async updateRole() {
    try {
      const { roleName } = this.context.request.params
      const { name, description, permissions } = this.context.request.body
      const updated = await this.service.updateRole(roleName, { name, description, permissions })
      this.respondOk({ success: true, data: updated })
    } catch (error) {
      this.respondError({ success: false, error: { code: 'UPDATE_ERROR', message: error.message } })
    }
  }

  async deleteRole() {
    try {
      await this.service.deleteRole(this.context.request.params.roleName)
      this.respondOk({ success: true, data: { message: 'Role soft-deleted' } })
    } catch (error) {
      this.respondError({ success: false, error: { code: 'DELETE_ERROR', message: error.message } })
    }
  }

  async restoreRole() {
    try {
      const restored = await this.service.restoreRole(this.context.request.params.roleName)
      this.respondOk({ success: true, data: restored })
    } catch (error) {
      this.respondError({ success: false, error: { code: 'RESTORE_ERROR', message: error.message } })
    }
  }

  async permanentDeleteRole() {
    try {
      await this.service.permanentlyDeleteRole(this.context.request.params.roleName)
      this.respondOk({ success: true, data: { message: 'Role permanently deleted' } })
    } catch (error) {
      this.respondError({ success: false, error: { code: 'DELETE_ERROR', message: error.message } })
    }
  }

  // ── Permissions ──────────────────────────────────────────────────────────

  async listPermissions() {
    try {
      const permissions = await this.service.listPermissions()
      this.respondOk({ success: true, data: permissions })
    } catch (error) {
      this.respondError({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch permissions' } })
    }
  }

  async listPermissionsByModule() {
    try {
      const permissions = await this.service.listPermissionsByModule()
      this.respondOk({ success: true, data: permissions })
    } catch (error) {
      this.respondError({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch permissions' } })
    }
  }

  async getRolePermissions() {
    try {
      const permissions = await this.service.getRolePermissions(this.context.request.params.roleName)
      this.respondOk({ success: true, data: permissions })
    } catch (error) {
      this.respondError({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch role permissions' } })
    }
  }

  async updateRolePermissions() {
    try {
      const { roleName }    = this.context.request.params
      const { permissions } = this.context.request.body
      if (!permissions || !Array.isArray(permissions)) {
        return this.respondBadRequest({ success: false, error: { code: 'VALIDATION_ERROR', message: 'permissions must be an array' } })
      }
      await this.service.replaceRolePermissions(roleName, permissions)
      this.respondOk({ success: true, data: { message: 'Role permissions updated' } })
    } catch (error) {
      this.respondError({ success: false, error: { code: 'UPDATE_ERROR', message: error.message } })
    }
  }

  async grantPermission() {
    try {
      const { roleName } = this.context.request.params
      const { permission_code } = this.context.request.body
      await this.service.grantPermission(roleName, permission_code, this.context.user?.sub)
      this.respondOk({ success: true, data: { message: 'Permission granted' } })
    } catch (error) {
      this.respondError({ success: false, error: { code: 'GRANT_ERROR', message: error.message } })
    }
  }

  async revokePermission() {
    try {
      const { roleName, permissionKey } = this.context.request.params
      await this.service.revokePermission(roleName, permissionKey)
      this.respondOk({ success: true, data: { message: 'Permission revoked' } })
    } catch (error) {
      this.respondError({ success: false, error: { code: 'REVOKE_ERROR', message: error.message } })
    }
  }

  // ── Audit logs ───────────────────────────────────────────────────────────

  async listAuditLogs() {
    try {
      const {
        page, limit,
        actor_sub, action, resource_type,
        method, status_code,
        start_date, end_date,
      } = this.context.request.query
      const pageNum  = page  ? parseInt(page, 10)  : 1
      const limitNum = limit ? parseInt(limit, 10) : 20
      const result = await this.service.listAuditLogs({
        page:          pageNum,
        limit:         limitNum,
        actor_sub,
        action,
        resource_type,
        method,
        status_code:   status_code ? parseInt(status_code, 10) : undefined,
        start_date,
        end_date,
      })
      this.respondOk({
        success: true,
        data: result.logs,
        pagination: {
          page:       pageNum,
          limit:      limitNum,
          total:      result.total,
          totalPages: Math.ceil(result.total / limitNum),
        },
      })
    } catch (error) {
      this.respondError({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch audit logs' } })
    }
  }

  async getAuditLog() {
    try {
      const log = await this.service.getAuditLog(this.context.request.params.logId)
      if (!log) return this.respondNotFound({ success: false, error: { code: 'NOT_FOUND', message: 'Audit log not found' } })
      this.respondOk({ success: true, data: log })
    } catch (error) {
      this.respondError({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch audit log' } })
    }
  }
}
