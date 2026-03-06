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

const auth = [requireAuth()]

// ── Current user (auth only, no admin permission needed) ─────
const getMyPermissions  = { path: '/me/permissions', verb: 'GET', handler: { controller: AdminController, method: 'getMyPermissions' }, middleware: auth }

// ── Users ────────────────────────────────────────────────────
const listUsers         = { path: '/users',                    verb: 'GET',    handler: { controller: AdminController, method: 'listUsers' },       middleware: auth, permission: 'ADMIN.ROLES.VIEW' }
const getUser           = { path: '/users/:userId',            verb: 'GET',    handler: { controller: AdminController, method: 'getUser' },         middleware: auth, permission: 'ADMIN.ROLES.VIEW' }
const updateUserRoles   = { path: '/users/:userId/roles',      verb: 'PUT',    handler: { controller: AdminController, method: 'updateUserRoles' }, middleware: auth, permission: 'ADMIN.ROLES.EDIT' }
const disableUser       = { path: '/users/:userId/disable',    verb: 'POST',   handler: { controller: AdminController, method: 'disableUser' },     middleware: auth, permission: 'ADMIN.ROLES.EDIT' }
const enableUser        = { path: '/users/:userId/enable',     verb: 'POST',   handler: { controller: AdminController, method: 'enableUser' },      middleware: auth, permission: 'ADMIN.ROLES.EDIT' }
const listUserPerms     = { path: '/users/:userId/permissions', verb: 'GET',   handler: { controller: AdminController, method: 'listPermissions' }, middleware: auth, permission: 'ADMIN.ROLES.VIEW' }

// ── Permissions ──────────────────────────────────────────────
const listPermissions   = { path: '/permissions',              verb: 'GET',    handler: { controller: AdminController, method: 'listPermissions' },         middleware: auth, permission: 'ADMIN.ROLES.VIEW' }
const listPermsByModule = { path: '/permissions/module/:module', verb: 'GET',  handler: { controller: AdminController, method: 'listPermissionsByModule' }, middleware: auth, permission: 'ADMIN.ROLES.VIEW' }

// ── Roles ────────────────────────────────────────────────────
const listRoles         = { path: '/roles',                     verb: 'GET',    handler: { controller: AdminController, method: 'listRoles' },            middleware: auth, permission: 'ADMIN.ROLES.VIEW' }
const createRole        = { path: '/roles',                     verb: 'POST',   handler: { controller: AdminController, method: 'createRole' },           middleware: auth, permission: 'ADMIN.ROLES.EDIT' }
const getRole           = { path: '/roles/:roleName',           verb: 'GET',    handler: { controller: AdminController, method: 'getRole' },              middleware: auth, permission: 'ADMIN.ROLES.VIEW' }
const updateRole        = { path: '/roles/:roleName',           verb: 'PATCH',  handler: { controller: AdminController, method: 'updateRole' },           middleware: auth, permission: 'ADMIN.ROLES.EDIT' }
const deleteRole        = { path: '/roles/:roleName',           verb: 'DELETE', handler: { controller: AdminController, method: 'deleteRole' },           middleware: auth, permission: 'ADMIN.ROLES.EDIT' }
const restoreRole       = { path: '/roles/:roleName/restore',   verb: 'POST',  handler: { controller: AdminController, method: 'restoreRole' },          middleware: auth, permission: 'ADMIN.ROLES.EDIT' }
const permanentDelete   = { path: '/roles/:roleName/permanent', verb: 'DELETE', handler: { controller: AdminController, method: 'permanentDeleteRole' },  middleware: auth, permission: 'ADMIN.ROLES.EDIT' }

// ── Role Permissions ─────────────────────────────────────────
const getRolePerms      = { path: '/roles/:roleName/permissions',               verb: 'GET',    handler: { controller: AdminController, method: 'getRolePermissions' },   middleware: auth, permission: 'ADMIN.ROLES.VIEW' }
const updateRolePerms   = { path: '/roles/:roleName/permissions',               verb: 'PUT',    handler: { controller: AdminController, method: 'updateRolePermissions' }, middleware: auth, permission: 'ADMIN.ROLES.EDIT' }
const grantPermission   = { path: '/roles/:roleName/permissions',               verb: 'POST',   handler: { controller: AdminController, method: 'grantPermission' },      middleware: auth, permission: 'ADMIN.ROLES.EDIT' }
const revokePermission  = { path: '/roles/:roleName/permissions/:permissionKey', verb: 'DELETE', handler: { controller: AdminController, method: 'revokePermission' },    middleware: auth, permission: 'ADMIN.ROLES.EDIT' }

// ── Audit Logs ───────────────────────────────────────────────
const listAuditLogs     = { path: '/audit-logs',      verb: 'GET', handler: { controller: AdminController, method: 'listAuditLogs' }, middleware: auth, permission: 'ADMIN.ROLES.VIEW' }
const getAuditLog       = { path: '/audit-logs/:logId', verb: 'GET', handler: { controller: AdminController, method: 'getAuditLog' }, middleware: auth, permission: 'ADMIN.ROLES.VIEW' }

export const AdminApi = new ApiSchema({
  name: 'Admin',
  url:  '/iam/admin',
  endpoints: [
    getMyPermissions,
    listUsers, getUser, updateUserRoles, disableUser, enableUser, listUserPerms,
    listPermissions, listPermsByModule,
    listRoles, createRole, getRole, updateRole, deleteRole, restoreRole, permanentDelete,
    getRolePerms, updateRolePerms, grantPermission, revokePermission,
    listAuditLogs, getAuditLog,
  ],
})
