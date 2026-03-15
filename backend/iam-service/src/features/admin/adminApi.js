/**
 * IAM — Admin API
 *
 * Full RBAC management routes (users, roles, permissions, audit logs).
 * All routes require auth. Most require ADMIN.ROLES.VIEW permission.
 *
 * Permission binding is declarative via the `permission` field — the
 * ApiSchema auto-injects requirePermission middleware.
 */

import { ApiSchema } from '../../../../base/apiSchema.js'
import { AdminController } from './adminController.js'
import { requireAuth } from '../../../../base/middleware/requireAuth.js'
import { z } from 'zod'

const auth = [requireAuth()]

// ── Current user (auth only, no admin permission needed) ─────
const getMyPermissions = {
  path:       '/me/permissions',
  verb:       'GET',
  handler:    { controller: AdminController, method: 'getMyPermissions', arguments: ['user'] },
  middleware: auth,
}

// ── Users ────────────────────────────────────────────────────
const listUsers = {
  path:       '/users',
  verb:       'GET',
  handler:    { controller: AdminController, method: 'listUsers', arguments: ['request:query'] },
  middleware: auth,
  permission: 'ADMIN.ROLES.VIEW',
  response:   z.object({ success: z.boolean(), data: z.array(z.any()) }),
}

const getUser = {
  path:       '/users/:userId',
  verb:       'GET',
  handler:    { controller: AdminController, method: 'getUser', arguments: ['request:params'] },
  middleware: auth,
  permission: 'ADMIN.ROLES.VIEW',
}

const updateUserRoles = {
  path:       '/users/:userId/roles',
  verb:       'PUT',
  handler:    { controller: AdminController, method: 'updateUserRoles', arguments: ['request:params', 'request:body'] },
  middleware: auth,
  permission: 'ADMIN.ROLES.EDIT',
}

const disableUser = {
  path:       '/users/:userId/disable',
  verb:       'POST',
  handler:    { controller: AdminController, method: 'disableUser', arguments: ['request:params'] },
  middleware: auth,
  permission: 'ADMIN.ROLES.EDIT',
}

const enableUser = {
  path:       '/users/:userId/enable',
  verb:       'POST',
  handler:    { controller: AdminController, method: 'enableUser', arguments: ['request:params'] },
  middleware: auth,
  permission: 'ADMIN.ROLES.EDIT',
}

const listUserPerms = {
  path:       '/users/:userId/permissions',
  verb:       'GET',
  handler:    { controller: AdminController, method: 'listPermissions', arguments: [] },
  middleware: auth,
  permission: 'ADMIN.ROLES.VIEW',
}

// ── Permissions ──────────────────────────────────────────────
const listPermissions = {
  path:       '/permissions',
  verb:       'GET',
  handler:    { controller: AdminController, method: 'listPermissions', arguments: [] },
  middleware: auth,
  permission: 'ADMIN.ROLES.VIEW',
  cache:      { ttl: 300, prefix: 'iam:permissions' },
  response:   z.object({ success: z.boolean(), data: z.array(z.any()) }),
}

const listPermsByModule = {
  path:       '/permissions/module/:module',
  verb:       'GET',
  handler:    { controller: AdminController, method: 'listPermissionsByModule', arguments: [] },
  middleware: auth,
  permission: 'ADMIN.ROLES.VIEW',
}

// ── Roles ────────────────────────────────────────────────────
const listRoles = {
  path:       '/roles',
  verb:       'GET',
  handler:    { controller: AdminController, method: 'listRoles', arguments: ['request:query'] },
  middleware: auth,
  permission: 'ADMIN.ROLES.VIEW',
  response:   z.object({ success: z.boolean() }),
}

const createRole = {
  path:       '/roles',
  verb:       'POST',
  handler:    { controller: AdminController, method: 'createRole', arguments: ['request:body'] },
  middleware: auth,
  permission: 'ADMIN.ROLES.EDIT',
}

const getRole = {
  path:       '/roles/:roleName',
  verb:       'GET',
  handler:    { controller: AdminController, method: 'getRole', arguments: ['request:params'] },
  middleware: auth,
  permission: 'ADMIN.ROLES.VIEW',
}

const updateRole = {
  path:       '/roles/:roleName',
  verb:       'PATCH',
  handler:    { controller: AdminController, method: 'updateRole', arguments: ['request:params', 'request:body'] },
  middleware: auth,
  permission: 'ADMIN.ROLES.EDIT',
}

const deleteRole = {
  path:       '/roles/:roleId',
  verb:       'DELETE',
  handler:    { controller: AdminController, method: 'deleteRole', arguments: ['request:params'] },
  middleware: auth,
  permission: 'ADMIN.ROLES.EDIT',
  response:   z.object({ success: z.boolean() }),
}

const restoreRole = {
  path:       '/roles/:roleName/restore',
  verb:       'POST',
  handler:    { controller: AdminController, method: 'restoreRole', arguments: ['request:params'] },
  middleware: auth,
  permission: 'ADMIN.ROLES.EDIT',
}

const permanentDelete = {
  path:       '/roles/:roleId/permanent',
  verb:       'DELETE',
  handler:    { controller: AdminController, method: 'permanentDeleteRole', arguments: ['request:params'] },
  middleware: auth,
  permission: 'ADMIN.ROLES.EDIT',
}

// ── Role Permissions ─────────────────────────────────────────
const getRolePerms = {
  path:       '/roles/:roleName/permissions',
  verb:       'GET',
  handler:    { controller: AdminController, method: 'getRolePermissions', arguments: ['request:params'] },
  middleware: auth,
  permission: 'ADMIN.ROLES.VIEW',
}

const updateRolePerms = {
  path:       '/roles/:roleName/permissions',
  verb:       'PUT',
  handler:    { controller: AdminController, method: 'updateRolePermissions', arguments: ['request:params', 'request:body'] },
  middleware: auth,
  permission: 'ADMIN.ROLES.EDIT',
}

const grantPermission = {
  path:       '/roles/:roleName/permissions',
  verb:       'POST',
  handler:    { controller: AdminController, method: 'grantPermission', arguments: ['request:params', 'request:body'] },
  middleware: auth,
  permission: 'ADMIN.ROLES.EDIT',
}

const revokePermission = {
  path:       '/roles/:roleName/permissions/:permissionKey',
  verb:       'DELETE',
  handler:    { controller: AdminController, method: 'revokePermission', arguments: ['request:params'] },
  middleware: auth,
  permission: 'ADMIN.ROLES.EDIT',
}

// ── Audit Logs ───────────────────────────────────────────────
const listAuditLogs = {
  path:       '/audit-logs',
  verb:       'GET',
  handler:    { controller: AdminController, method: 'listAuditLogs', arguments: ['request:query'] },
  middleware: auth,
  permission: 'ADMIN.ROLES.VIEW',
}

const getAuditLog = {
  path:       '/audit-logs/:logId',
  verb:       'GET',
  handler:    { controller: AdminController, method: 'getAuditLog', arguments: ['request:params'] },
  middleware: auth,
  permission: 'ADMIN.ROLES.VIEW',
}

export const AdminApi = new ApiSchema({
  name:      'Admin',
  url:       '/iam/admin',
  endpoints: [
    getMyPermissions,
    listUsers, getUser, updateUserRoles, disableUser, enableUser, listUserPerms,
    listPermissions, listPermsByModule,
    listRoles, createRole, getRole, updateRole, deleteRole, restoreRole, permanentDelete,
    getRolePerms, updateRolePerms, grantPermission, revokePermission,
    listAuditLogs, getAuditLog,
  ],
})
