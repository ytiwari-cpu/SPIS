/**
 * IAM — Admin Service
 *
 * Business logic for user/role/permission/audit administration.
 */

import { BaseService } from '../../../../base/baseService.js'
import { AdminRepository } from './adminRepository.js'

export class AdminService extends BaseService {
  /** @param {AdminRepository} repo */
  constructor(repo) {
    super(repo.context)
    this.repo = repo
  }

  // ── Current user ────────────────────────────────────────────────────

  getMyPermissions(userId) {
    return this.repo.getUserPermissions(userId)
  }

  // ── Users ────────────────────────────────────────────────────────────

  listUsers({ page = 1, limit = 20, status, role, search } = {}) {
    return this.repo.listUsers({ page, limit, status, role, search })
  }

  async getUser(userId) {
    const user  = await this.repo.getUserById(userId)
    if (!user) return null
    const roles = await this.repo.getUserRoles(userId)
    return { ...user, roles }
  }

  async updateUserRoles(userId, roles) {
    await this.repo.setUserRoles(userId, roles)
    return this.getUser(userId)
  }

  disableUser(userId)  { return this.repo.updateUserStatus(userId, 'disabled') }
  enableUser(userId)   { return this.repo.updateUserStatus(userId, 'active') }

  // ── Roles ────────────────────────────────────────────────────────────

  listRoles(isActive = true)              { return this.repo.getAllRolesEnhanced(isActive) }
  async getRole(roleName) {
    const role = await this.repo.getRoleByName(roleName)
    if (!role) return null
    const permissions = await this.repo.getRolePermissions(roleName)
    return { ...role, permissions }
  }
  createRole(params)                     { return this.repo.createRole(params) }
  updateRole(roleName, params)           { return this.repo.updateRole(roleName, params) }
  deleteRole(roleName)                   { return this.repo.deleteRole(roleName) }
  restoreRole(roleName)                  { return this.repo.restoreRole(roleName) }
  permanentlyDeleteRole(roleName)        { return this.repo.permanentlyDeleteRole(roleName) }

  // ── Permissions ──────────────────────────────────────────────────────

  listPermissions()                      { return this.repo.getAllPermissions() }
  listPermissionsByModule()              { return this.repo.getPermissionsByModule() }
  getRolePermissions(roleName)           { return this.repo.getRolePermissions(roleName) }
  replaceRolePermissions(roleName, perms){ return this.repo.replaceRolePermissions(roleName, perms) }
  grantPermission(roleName, key, by)     { return this.repo.grantPermission(roleName, key, by) }
  revokePermission(roleName, key)        { return this.repo.revokePermission(roleName, key) }

  // ── Audit Logs ───────────────────────────────────────────────────────

  listAuditLogs(filters)  { return this.repo.getAuditLogs(filters) }
  getAuditLog(id)         { return this.repo.getAuditLogById(id) }
}
