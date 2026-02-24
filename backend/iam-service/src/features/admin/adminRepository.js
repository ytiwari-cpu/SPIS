/**
 * IAM — Admin Repository
 *
 * All DB queries for user/role/permission/audit management.
 */

import { BaseDbRepository } from '../../../../base/baseDbRepository.js'
import { pool } from '../../db/pool.js'
import {
  getAllPermissions, getPermissionsByModule, getRolePermissions,
  grantPermissionToRole, revokePermissionFromRole, getUserPermissions,
  listUsers, getUserById, updateUserStatus, setUserRoles, getUserRoles,
  getAllRoles, getRoleByName, createRole, updateRole, deleteRole,
  getAllRolesEnhanced, replaceRolePermissions, restoreRole,
  permanentlyDeleteRole, getRoleByNameIncludingInactive,
  getAuditLogs, getAuditLogById,
} from '../../db/repository.js'

export class AdminRepository extends BaseDbRepository {
  constructor(ctx) {
    super(ctx, pool)
  }

  // ── Permissions ──────────────────────────────────────────────────────
  getAllPermissions()                              { return getAllPermissions() }
  getPermissionsByModule(module)                  { return getPermissionsByModule(module) }
  getRolePermissions(roleName)                    { return getRolePermissions(roleName) }
  grantPermission(roleName, permissionKey, by)    { return grantPermissionToRole(roleName, permissionKey, by) }
  revokePermission(roleName, permissionKey)       { return revokePermissionFromRole(roleName, permissionKey) }
  getUserPermissions(userId)                      { return getUserPermissions(userId) }
  replaceRolePermissions(roleName, permissions)   { return replaceRolePermissions(roleName, permissions) }

  // ── Users ────────────────────────────────────────────────────────────
  listUsers(params)                               { return listUsers(params) }
  getUserById(userId)                             { return getUserById(userId) }
  updateUserStatus(userId, status)                { return updateUserStatus(userId, status) }
  setUserRoles(userId, roles)                     { return setUserRoles(userId, roles) }
  getUserRoles(userId)                            { return getUserRoles(userId) }

  // ── Roles ────────────────────────────────────────────────────────────
  getAllRoles()                                    { return getAllRoles() }
  getAllRolesEnhanced(isActive = true)                    { return getAllRolesEnhanced(isActive) }
  getRoleByName(roleName)                         { return getRoleByName(roleName) }
  getRoleByNameIncludingInactive(roleName)         { return getRoleByNameIncludingInactive(roleName) }
  createRole(params)                              { return createRole(params) }
  updateRole(roleName, params)                    { return updateRole(roleName, params) }
  deleteRole(roleName)                            { return deleteRole(roleName) }
  restoreRole(roleName)                           { return restoreRole(roleName) }
  permanentlyDeleteRole(roleName)                 { return permanentlyDeleteRole(roleName) }

  // ── Audit Logs ───────────────────────────────────────────────────────
  getAuditLogs(filters)                           { return getAuditLogs(filters) }
  getAuditLogById(id)                             { return getAuditLogById(id) }
}
