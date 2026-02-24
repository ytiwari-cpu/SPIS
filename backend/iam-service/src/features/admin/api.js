/**
 * IAM — Admin API
 *
 * Full RBAC management routes (users, roles, permissions, audit logs).
 * All routes require auth. Most require ADMIN.ROLES.VIEW permission.
 */

import { ApiSchema } from '../../../../base/apiSchema.js'
import { AdminController } from './adminController.js'
import { requireAuth, requirePermissions } from '../../middleware/auth.js'

const authOnly   = [requireAuth()]
const authAdmin  = [requireAuth(), requirePermissions('ADMIN.ROLES.VIEW')]

// ── Current user
const getMyPermissions  = { path: '/me/permissions',                            verb: 'GET',    handler: { controller: AdminController, method: 'getMyPermissions' },      middleware: authOnly }

// ── Users
const listUsers         = { path: '/users',                                     verb: 'GET',    handler: { controller: AdminController, method: 'listUsers' },            middleware: authAdmin }
const getUser           = { path: '/users/:userId',                             verb: 'GET',    handler: { controller: AdminController, method: 'getUser' },              middleware: authAdmin }
const updateUserRoles   = { path: '/users/:userId/roles',                       verb: 'PUT',    handler: { controller: AdminController, method: 'updateUserRoles' },      middleware: authAdmin }
const disableUser       = { path: '/users/:userId/disable',                     verb: 'POST',   handler: { controller: AdminController, method: 'disableUser' },          middleware: authAdmin }
const enableUser        = { path: '/users/:userId/enable',                      verb: 'POST',   handler: { controller: AdminController, method: 'enableUser' },           middleware: authAdmin }
const listUserPerms     = { path: '/users/:userId/permissions',                 verb: 'GET',    handler: { controller: AdminController, method: 'listPermissions' },      middleware: authAdmin }

// ── Permissions
const listPermissions      = { path: '/permissions',                            verb: 'GET',    handler: { controller: AdminController, method: 'listPermissions' },         middleware: authAdmin }
const listPermsByModule    = { path: '/permissions/module/:module',             verb: 'GET',    handler: { controller: AdminController, method: 'listPermissionsByModule' }, middleware: authAdmin }

// ── Roles
const listRoles         = { path: '/roles',                                     verb: 'GET',    handler: { controller: AdminController, method: 'listRoles' },            middleware: authAdmin }
const createRole        = { path: '/roles',                                     verb: 'POST',   handler: { controller: AdminController, method: 'createRole' },           middleware: authAdmin }
const getRole           = { path: '/roles/:roleName',                           verb: 'GET',    handler: { controller: AdminController, method: 'getRole' },              middleware: authAdmin }
const updateRole        = { path: '/roles/:roleName',                           verb: 'PATCH',  handler: { controller: AdminController, method: 'updateRole' },           middleware: authAdmin }
const deleteRole        = { path: '/roles/:roleName',                           verb: 'DELETE', handler: { controller: AdminController, method: 'deleteRole' },           middleware: authAdmin }
const restoreRole       = { path: '/roles/:roleName/restore',                   verb: 'POST',   handler: { controller: AdminController, method: 'restoreRole' },          middleware: authAdmin }
const permanentDelete   = { path: '/roles/:roleName/permanent',                 verb: 'DELETE', handler: { controller: AdminController, method: 'permanentDeleteRole' },  middleware: authAdmin }
const getRolePerms      = { path: '/roles/:roleName/permissions',               verb: 'GET',    handler: { controller: AdminController, method: 'getRolePermissions' },   middleware: authAdmin }
const updateRolePerms   = { path: '/roles/:roleName/permissions',               verb: 'PUT',    handler: { controller: AdminController, method: 'updateRolePermissions' }, middleware: authAdmin }
const grantPermission   = { path: '/roles/:roleName/permissions',               verb: 'POST',   handler: { controller: AdminController, method: 'grantPermission' },      middleware: authAdmin }
const revokePermission  = { path: '/roles/:roleName/permissions/:permissionKey', verb: 'DELETE', handler: { controller: AdminController, method: 'revokePermission' },    middleware: authAdmin }

// ── Audit Logs
const listAuditLogs     = { path: '/audit-logs',                                verb: 'GET',    handler: { controller: AdminController, method: 'listAuditLogs' },        middleware: authAdmin }
const getAuditLog       = { path: '/audit-logs/:logId',                         verb: 'GET',    handler: { controller: AdminController, method: 'getAuditLog' },          middleware: authAdmin }

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
