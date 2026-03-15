/**
 * IAM — Admin Service
 *
 * Business logic for user/role/permission/audit administration.
 */

import { BaseService } from '../../../../base/baseService.js'
import { ApplicationError } from '../../../../base/applicationError.js'
import { redis } from '../../lib/redis.js'
import { config } from '../../config.js'
import { AdminRepository } from './adminRepository.js'

export class AdminService extends BaseService {
  /**
   * @param {import('../../../../base/apiContext.js').ApiContext} ctx
   * @param {import('./adminRepository.js').AdminRepository} repo
   */
  constructor(context) {
    super(context)
    this.adminRepository = new AdminRepository(context)
  }

  // ── Token revocation ────────────────────────────────────────────────

  /**
   * Revoke all tokens for a user by adding them to a Redis blocklist.
   * TTL matches max token lifetime so the entry auto-expires.
   */
  async revokeToken(userId) {
    const ttl = config.jwt.expiresInSeconds || 3600
    await redis.set(`token:revoked:${userId}`, '1', 'EX', ttl)
  }

  // ── Current user ────────────────────────────────────────────────────

  getMyPermissions(userId) {
    return this.adminRepository.getUserPermissions(userId)
  }

  // ── Users ────────────────────────────────────────────────────────────

  async listUsers({ page, limit, status, role, search } = {}) {
    const pageNum  = page  ? parseInt(page, 10)  : 1
    const limitNum = limit ? parseInt(limit, 10) : 20
    const result = await this.adminRepository.listUsers({ page: pageNum, limit: limitNum, status, role, search })
    return {
      users:      result.users,
      pagination: {
        page:       pageNum,
        limit:      limitNum,
        total:      result.total,
        totalPages: Math.ceil(result.total / limitNum),
      },
    }
  }

  async getUser(userId) {
    const user  = await this.adminRepository.getUserById(userId)
    if (!user) {
      return null
    }
    const roles = await this.adminRepository.getUserRoles(userId)
    return { ...user, roles }
  }

  async updateUserRoles(userId, roles) {
    await this.adminRepository.setUserRoles(userId, roles)
    return this.getUser(userId)
  }

  disableUser(userId)  {
    return this.adminRepository.updateUserStatus(userId, 'disabled')
  }
  enableUser(userId)   {
    return this.adminRepository.updateUserStatus(userId, 'active')
  }

  // ── Roles ────────────────────────────────────────────────────────────

  listRoles(isActive = true)              {
    return this.adminRepository.getAllRolesEnhanced(isActive)
  }
  async getRole(roleName) {
    const role = await this.adminRepository.getRoleByName(roleName)
    if (!role) {
      return null
    }
    const permissions = await this.adminRepository.getRolePermissions(roleName)
    return { ...role, permissions }
  }
  createRole(params)                     {
    return this.adminRepository.createRole(params)
  }
  updateRole(roleName, params)           {
    return this.adminRepository.updateRole(roleName, params)
  }
  deleteRole(roleId)                     {
    return this.adminRepository.deleteRole(roleId)
  }
  restoreRole(roleName)                  {
    return this.adminRepository.restoreRole(roleName)
  }

  async permanentlyDeleteRole(roleId) {
    const role = await this.adminRepository.getRoleByNameIncludingInactive(roleId)
    if (!role) {
      return false
    }
    if (role.role_type === 'system') {
      throw ApplicationError.forbidden('System roles cannot be permanently deleted')
    }
    if (role.is_active) {
      throw ApplicationError.badRequest('Active roles cannot be permanently deleted. Deactivate the role first.')
    }
    return this.adminRepository.permanentlyDeleteRole(roleId)
  }

  // ── Permissions ──────────────────────────────────────────────────────

  listPermissions()                      {
    return this.adminRepository.getAllPermissions()
  }
  listPermissionsByModule()              {
    return this.adminRepository.getPermissionsByModule()
  }
  getRolePermissions(roleName)           {
    return this.adminRepository.getRolePermissions(roleName)
  }
  replaceRolePermissions(roleName, perms){
    return this.adminRepository.replaceRolePermissions(roleName, perms)
  }

  async grantPermission(roleName, permissionKey, grantedBy) {
    const isPermissionExists = await this.adminRepository.isRolePermissionExists(roleName, permissionKey)
    if (isPermissionExists) {
      return
    }
    await this.adminRepository.insertRolePermission(roleName, permissionKey, grantedBy)
  }

  revokePermission(roleName, key)        {
    return this.adminRepository.revokePermission(roleName, key)
  }

  // ── Audit Logs ───────────────────────────────────────────────────────

  async listAuditLogs(filters) {
    const pageNum    = filters.page        ? parseInt(filters.page, 10)        : 1
    const limitNum   = filters.limit       ? parseInt(filters.limit, 10)       : 20
    const statusCode = filters.status_code ? parseInt(filters.status_code, 10) : undefined
    const result = await this.adminRepository.getAuditLogs({
      ...filters,
      page:        pageNum,
      limit:       limitNum,
      status_code: statusCode,
    })
    return {
      logs:       result.logs,
      pagination: {
        page:       pageNum,
        limit:      limitNum,
        total:      result.total,
        totalPages: Math.ceil(result.total / limitNum),
      },
    }
  }
  getAuditLog(id)         {
    return this.adminRepository.getAuditLogById(id)
  }
}
