/**
 * SPIS IAM Service — Admin Routes
 *
 * Routes for managing users, roles and permissions.
 * Authorization uses PERMISSIONS only, never role names.
 */

import { Router } from 'express'
import { requireAuth, requirePermissions } from '../middleware/auth.js'
import { ApiContext } from '../../../base/apiContext.js'
import { AdminController } from '../features/admin/adminController.js'

export const adminRouter = Router()

// ── Current user (auth only, no ADMIN permission needed) ──────────────────
adminRouter.get('/me/permissions', requireAuth(), async (req, res, next) => {
  try {
    const ctx = new ApiContext(req, res)
    await new AdminController(ctx).getMyPermissions()
  } catch (err) { next(err) }
})

// ── All other admin routes require ADMIN.ROLES.VIEW ───────────────────────
adminRouter.use(requireAuth(), requirePermissions('ADMIN.ROLES.VIEW'))

// ── Users ──────────────────────────────────────────────────────────────────
adminRouter.get('/users', async (req, res, next) => {
  try { await new AdminController(new ApiContext(req, res)).listUsers() } catch (err) { next(err) }
})
adminRouter.get('/users/:userId', async (req, res, next) => {
  try { await new AdminController(new ApiContext(req, res)).getUser() } catch (err) { next(err) }
})
adminRouter.put('/users/:userId/roles', async (req, res, next) => {
  try { await new AdminController(new ApiContext(req, res)).updateUserRoles() } catch (err) { next(err) }
})
adminRouter.post('/users/:userId/disable', async (req, res, next) => {
  try { await new AdminController(new ApiContext(req, res)).disableUser() } catch (err) { next(err) }
})
adminRouter.post('/users/:userId/enable', async (req, res, next) => {
  try { await new AdminController(new ApiContext(req, res)).enableUser() } catch (err) { next(err) }
})
adminRouter.get('/users/:userId/permissions', async (req, res, next) => {
  try { await new AdminController(new ApiContext(req, res)).listPermissions() } catch (err) { next(err) }
})

// ── Permissions ────────────────────────────────────────────────────────────
adminRouter.get('/permissions', async (req, res, next) => {
  try { await new AdminController(new ApiContext(req, res)).listPermissions() } catch (err) { next(err) }
})
adminRouter.get('/permissions/module/:module', async (req, res, next) => {
  try { await new AdminController(new ApiContext(req, res)).listPermissionsByModule() } catch (err) { next(err) }
})

// ── Roles ──────────────────────────────────────────────────────────────────
adminRouter.get('/roles', async (req, res, next) => {
  try { await new AdminController(new ApiContext(req, res)).listRoles() } catch (err) { next(err) }
})
adminRouter.post('/roles', async (req, res, next) => {
  try { await new AdminController(new ApiContext(req, res)).createRole() } catch (err) { next(err) }
})
adminRouter.get('/roles/:roleName', async (req, res, next) => {
  try { await new AdminController(new ApiContext(req, res)).getRole() } catch (err) { next(err) }
})
adminRouter.patch('/roles/:roleName', async (req, res, next) => {
  try { await new AdminController(new ApiContext(req, res)).updateRole() } catch (err) { next(err) }
})
adminRouter.delete('/roles/:roleName', async (req, res, next) => {
  try { await new AdminController(new ApiContext(req, res)).deleteRole() } catch (err) { next(err) }
})
adminRouter.post('/roles/:roleName/restore', async (req, res, next) => {
  try { await new AdminController(new ApiContext(req, res)).restoreRole() } catch (err) { next(err) }
})
adminRouter.delete('/roles/:roleName/permanent', async (req, res, next) => {
  try { await new AdminController(new ApiContext(req, res)).permanentDeleteRole() } catch (err) { next(err) }
})

// ── Role Permissions ───────────────────────────────────────────────────────
adminRouter.get('/roles/:roleName/permissions', async (req, res, next) => {
  try { await new AdminController(new ApiContext(req, res)).getRolePermissions() } catch (err) { next(err) }
})
adminRouter.put('/roles/:roleName/permissions', async (req, res, next) => {
  try { await new AdminController(new ApiContext(req, res)).updateRolePermissions() } catch (err) { next(err) }
})
adminRouter.post('/roles/:roleName/permissions', async (req, res, next) => {
  try { await new AdminController(new ApiContext(req, res)).grantPermission() } catch (err) { next(err) }
})
adminRouter.delete('/roles/:roleName/permissions/:permissionKey', async (req, res, next) => {
  try { await new AdminController(new ApiContext(req, res)).revokePermission() } catch (err) { next(err) }
})

// ── Audit Logs ─────────────────────────────────────────────────────────────
adminRouter.get('/audit-logs', async (req, res, next) => {
  try { await new AdminController(new ApiContext(req, res)).listAuditLogs() } catch (err) { next(err) }
})
adminRouter.get('/audit-logs/:id', async (req, res, next) => {
  try { await new AdminController(new ApiContext(req, res)).getAuditLog() } catch (err) { next(err) }
})
