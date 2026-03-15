/**
 * IAM — Admin Repository
 *
 * All DB queries for user/role/permission/audit management.
 */

import { BaseRepository } from '../../../../base/baseRepository.js'
import { QueryHelper }    from '../../../../base/queryHelper.js'

export class AdminRepository extends BaseRepository {
  constructor(context) {
    super(context)
  }

  // ── Permissions ──────────────────────────────────────────────────────

  async getAllPermissions() {
    const { text, values } = new QueryHelper(this.tables.PERMISSIONS)
      .select('*')
      .orderBy('module')
      .orderBy('permission_key')
      .toParam()
    return await this.runQuery(text, values, true)
  }

  async getPermissionsByModule(module) {
    const { text, values } = new QueryHelper(this.tables.PERMISSIONS)
      .select('*')
      .where('module', '=', module)
      .orderBy('permission_key')
      .toParam()
    return await this.runQuery(text, values, true)
  }

  async getRolePermissions(roleName) {
    const { text, values } = new QueryHelper(this.tables.PERMISSIONS)
      .select('p')
      .field('p.*')
      .join(this.tables.ROLE_PERMISSIONS, 'rp', 'rp.permission_key = p.permission_key')
      .where('rp.role_name', '=', roleName)
      .orderBy('p.module')
      .orderBy('p.permission_key')
      .toParam()
    return await this.runQuery(text, values, true)
  }

  async isRolePermissionExists(roleName, permissionKey) {
    const { text, values } = new QueryHelper(this.tables.ROLE_PERMISSIONS)
      .count('*')
      .where('role_name', '=', roleName)
      .where('permission_key', '=', permissionKey)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return parseInt(rows[0]?.count ?? '0', 10) > 0
  }

  async insertRolePermission(roleName, permissionKey, grantedBy) {
    const { text, values } = new QueryHelper(this.tables.ROLE_PERMISSIONS)
      .insert({ role_name: roleName, permission_key: permissionKey, granted_by: grantedBy })
      .toParam()
    await this.runQuery(text, values, false)
  }

  async revokePermission(roleName, permissionKey) {
    const { text, values } = new QueryHelper(this.tables.ROLE_PERMISSIONS)
      .delete()
      .where('role_name',      '=', roleName)
      .where('permission_key', '=', permissionKey)
      .toParam()
    await this.runQuery(text, values, false)
  }

  async getUserPermissions(userId) {
    const { text, values } = new QueryHelper(this.tables.PERMISSIONS)
      .select('p')
      .field('DISTINCT p.permission_key')
      .join(this.tables.ROLE_PERMISSIONS, 'rp', 'rp.permission_key = p.permission_key')
      .join(this.tables.USER_ROLES, 'ur', 'rp.role_name = ur.role_name::text')
      .where('ur.user_id', '=', userId)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows.map(r => r.permission_key)
  }

  async replaceRolePermissions(roleName, permissionKeys, grantedBy) {
    const { text: fetchText, values: fetchValues } = new QueryHelper(this.tables.ROLE_PERMISSIONS)
      .select('permission_key')
      .where('role_name', '=', roleName)
      .toParam()
    const current     = await this.runQuery(fetchText, fetchValues, true)
    const currentKeys = current.map(p => p.permission_key)

    const toAdd    = permissionKeys.filter(k => !currentKeys.includes(k))
    const toRemove = currentKeys.filter(k => !permissionKeys.includes(k))

    for (const permKey of toRemove) {
      const { text, values } = new QueryHelper(this.tables.ROLE_PERMISSIONS)
        .delete()
        .where('role_name',      '=', roleName)
        .where('permission_key', '=', permKey)
        .toParam()
      await this.runQuery(text, values, false)
    }

    for (const permKey of toAdd) {
      const { text, values } = new QueryHelper(this.tables.ROLE_PERMISSIONS)
        .insert({ role_name: roleName, permission_key: permKey, granted_by: grantedBy })
        .toParam()
      await this.runQuery(text, values, false)
    }
    return { added: toAdd, removed: toRemove }
  }

  // ── Users ────────────────────────────────────────────────────────────

  async getUserById(userId) {
    const { text, values } = new QueryHelper(this.tables.USERS)
      .select('user_id, email, status, registry_id, national_id_hash, mfa_enabled, failed_login_attempts, locked_until, created_at, updated_at')
      .where('user_id', '=', userId)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0] ?? null
  }

  async updateUserStatus(userId, status) {
    const { text, values } = new QueryHelper(this.tables.USERS)
      .update({ status })
      .where('user_id', '=', userId)
      .toParam()
    await this.runQuery(text, values, false)
  }

  async getUserRoles(userId) {
    const { text, values } = new QueryHelper(this.tables.USER_ROLES)
      .select('*')
      .where('user_id', '=', userId)
      .toParam()
    return await this.runQuery(text, values, true)
  }

  async setUserRoles(userId, roles) {
    const { text: delText, values: delValues } = new QueryHelper(this.tables.USER_ROLES)
      .delete()
      .where('user_id', '=', userId)
      .toParam()
    await this.runQuery(delText, delValues, false)

    for (const role of roles) {
      const { text, values } = new QueryHelper(this.tables.USER_ROLES)
        .insert({ user_id: userId, role_name: role })
        .toParam()
      await this.runQuery(text, values, false)
    }
  }

  async listUsers({ page = 1, limit = 20, status, role, search } = {}) {
    const offset = (page - 1) * limit
    const roles = role ? role.split(',').map(r => r.trim()).filter(Boolean) : []
    const needsRoleJoin = roles.length > 0

    const applyFilters = (qh) => {
      if (status) {
        qh.where('u.status', '=', status)
      }
      if (roles.length) {
        qh.whereIn('ur.role_name', roles)
      }
      if (search) {
        qh.where('u.email', 'ILIKE', `%${search}%`)
      }
      return qh
    }

    // Count query
    const countQh = new QueryHelper(this.tables.USERS).select('u')
    if (needsRoleJoin) {
      countQh.field('COUNT(DISTINCT u.user_id)', 'total')
      countQh.join(this.tables.USER_ROLES, 'ur', 'u.user_id = ur.user_id')
    } else {
      countQh.field('COUNT(*)', 'total')
    }
    applyFilters(countQh)
    const { text: countText, values: countValues } = countQh.toParam()
    const countRows = await this.runQuery(countText, countValues, true)
    const total = parseInt(countRows[0]?.total || '0', 10)

    // Main query
    const cols = ['u.user_id', 'u.email', 'u.status', 'u.registry_id', 'u.national_id_hash', 'u.mfa_enabled', 'u.failed_login_attempts', 'u.locked_until', 'u.created_at', 'u.updated_at']
    const rolesSub = 'COALESCE((SELECT json_agg(json_build_object(\'role_name\', ur2.role_name, \'created_at\', ur2.created_at)) FROM user_roles ur2 WHERE ur2.user_id = u.user_id), \'[]\'::json)'

    const mainQh = new QueryHelper(this.tables.USERS).select('u')
    cols.forEach(c => mainQh.field(c))
    mainQh.field(rolesSub, 'roles')

    if (needsRoleJoin) {
      mainQh.join(this.tables.USER_ROLES, 'ur', 'u.user_id = ur.user_id')
      mainQh.groupBy(cols.join(', '))
    }
    applyFilters(mainQh)
    mainQh.orderBy('u.created_at', 'DESC').limit(limit).offset(offset)

    const { text, values } = mainQh.toParam()
    const rows = await this.runQuery(text, values, true)
    return { users: rows, total }
  }

  // ── Roles ────────────────────────────────────────────────────────────

  async getAllRoles() {
    const unionTable   = '(SELECT DISTINCT role_name::text AS role_name FROM user_roles UNION SELECT DISTINCT role_name FROM role_permissions) r'
    const userCountSub = '(SELECT role_name::text AS role_name, COUNT(*) as user_count FROM user_roles GROUP BY role_name::text) u'
    const permCountSub = '(SELECT role_name, COUNT(*) as permission_count FROM role_permissions GROUP BY role_name) p'

    const { text, values } = new QueryHelper(unionTable)
      .field('r.role_name')
      .field('r.role_name', 'display_name')
      .field(`CASE
           WHEN r.role_name = 'Citizen'          THEN 'Regular citizens accessing the portal'
           WHEN r.role_name = 'CaseWorker'        THEN 'Staff managing citizen cases'
           WHEN r.role_name = 'ProgrammeManager'  THEN 'Staff managing programmes'
           WHEN r.role_name = 'Admin'             THEN 'System administrators'
           WHEN r.role_name = 'SuperAdmin'        THEN 'Full system access'
           ELSE 'Custom role'
         END`, 'description')
      .field('r.role_name IN (\'Citizen\',\'CaseWorker\',\'ProgrammeManager\',\'Admin\',\'SuperAdmin\')', 'is_system')
      .field('COALESCE(u.user_count, 0)', 'user_count')
      .field('COALESCE(p.permission_count, 0)', 'permission_count')
      .field('NOW()', 'created_at')
      .left_join(userCountSub, 'r.role_name = u.role_name')
      .left_join(permCountSub, 'r.role_name = p.role_name')
      .orderByExpr('CASE r.role_name WHEN \'SuperAdmin\' THEN 1 WHEN \'Admin\' THEN 2 WHEN \'ProgrammeManager\' THEN 3 WHEN \'CaseWorker\' THEN 4 WHEN \'Citizen\' THEN 5 ELSE 6 END')
      .orderBy('r.role_name')
      .toParam()
    return await this.runQuery(text, values, true)
  }

  async getAllRolesEnhanced(isActive = true) {
    const userCountSub = '(SELECT role_name::text AS role_name, COUNT(*) as user_count FROM user_roles GROUP BY role_name::text) u'
    const permCountSub = '(SELECT role_name, COUNT(*) as permission_count FROM role_permissions GROUP BY role_name) p'

    const { text, values } = new QueryHelper(this.tables.ROLES)
      .select('r')
      .field('r.*')
      .field('COALESCE(u.user_count, 0)::int', 'user_count')
      .field('COALESCE(p.permission_count, 0)::int', 'permission_count')
      .left_join(userCountSub, 'r.role_name = u.role_name')
      .left_join(permCountSub, 'r.role_name = p.role_name')
      .where('r.is_active', '=', isActive)
      .orderByExpr('CASE r.role_type WHEN \'system\' THEN 0 ELSE 1 END')
      .orderByExpr('CASE r.role_name WHEN \'SuperAdmin\' THEN 1 WHEN \'Admin\' THEN 2 WHEN \'ProgrammeManager\' THEN 3 WHEN \'CaseWorker\' THEN 4 WHEN \'Citizen\' THEN 5 ELSE 6 END')
      .orderBy('r.role_name')
      .toParam()
    return await this.runQuery(text, values, true)
  }

  async getRoleByName(roleName) {
    const userCountSub = '(SELECT role_name::text AS role_name, COUNT(*) as user_count FROM user_roles GROUP BY role_name::text) u'
    const permCountSub = '(SELECT role_name, COUNT(*) as permission_count FROM role_permissions GROUP BY role_name) p'

    const { text, values } = new QueryHelper(this.tables.ROLES)
      .select('r')
      .field('r.role_name')
      .field('r.display_name')
      .field('r.description')
      .field("r.role_type = 'system'", 'is_system')
      .field('COALESCE(u.user_count, 0)', 'user_count')
      .field('COALESCE(p.permission_count, 0)', 'permission_count')
      .field('r.created_at')
      .left_join(userCountSub, 'r.role_name = u.role_name')
      .left_join(permCountSub, 'r.role_name = p.role_name')
      .where('r.role_name', '=', roleName)
      .where('r.is_active', '=', true)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0] ?? null
  }

  async getRoleRowByName(roleName) {
    const { text, values } = new QueryHelper(this.tables.ROLES)
      .select('*')
      .where('role_name', '=', roleName)
      .where('is_active', '=', true)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0] ?? null
  }

  async getRoleByNameIncludingInactive(roleId) {
    const { text, values } = new QueryHelper(this.tables.ROLES)
      .select('*')
      .where('role_id', '=', roleId)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0] ?? null
  }

  async roleNameExists(roleName) {
    const { text, values } = new QueryHelper(this.tables.ROLES)
      .count('*')
      .where('role_name', '=', roleName)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return parseInt(rows[0]?.count ?? '0', 10) > 0
  }

  async createRole(fields) {
    const { text, values } = new QueryHelper(this.tables.ROLES).insert(fields).toParam()
    await this.runQuery(text, values, false)
  }

  async updateRole(roleName, fields) {
    const { text, values } = new QueryHelper(this.tables.ROLES)
      .update(fields)
      .where('role_name', '=', roleName)
      .where('is_active', '=', true)
      .toParam()
    await this.runQuery(text, values, false)
  }

  async deleteRole(roleId) {
    // Look up role_name for user_roles cleanup (user_roles uses role_name ENUM column)
    const role = await this.getRoleByNameIncludingInactive(roleId)
    if (role) {
      // Remove user_roles entries — wrapped in try/catch because user_roles.role_name
      // is an ENUM type and custom role names not in the enum will cause a cast error.
      try {
        const { text, values } = new QueryHelper(this.tables.USER_ROLES)
          .delete()
          .where('role_name', '=', role.role_name)
          .toParam()
        await this.runQuery(text, values, false)
      } catch {
        // Custom roles are not in the role_name enum — no user_roles to remove
      }
    }

    const now = new Date().toISOString()
    const { text: upText, values: upValues } = new QueryHelper(this.tables.ROLES)
      .update({ is_active: false, updated_at: now })
      .where('role_id', '=', roleId)
      .where('role_type', '=', 'custom')
      .where('is_active', '=', true)
      .toParam()
    const count = await this.runQuery(upText, upValues, false)
    return count > 0
  }

  async restoreRole(roleName) {
    const now = new Date().toISOString()
    const { text, values } = new QueryHelper(this.tables.ROLES)
      .update({ is_active: true, updated_at: now })
      .where('role_name', '=', roleName)
      .where('is_active', '=', false)
      .toParam()
    const count = await this.runQuery(text, values, false)
    return count > 0
  }

  async permanentlyDeleteRole(roleId) {
    // role_permissions uses role_name — look up the role first to get it
    const role = await this.getRoleByNameIncludingInactive(roleId)
    if (role) {
      const { text: delPermsText, values: delPermsValues } = new QueryHelper(this.tables.ROLE_PERMISSIONS)
        .delete()
        .where('role_name', '=', role.role_name)
        .toParam()
      await this.runQuery(delPermsText, delPermsValues, false)
    }

    const { text: delRoleText, values: delRoleValues } = new QueryHelper(this.tables.ROLES)
      .delete()
      .where('role_id', '=', roleId)
      .toParam()
    const deleted = await this.runQuery(delRoleText, delRoleValues, false)
    return deleted > 0
  }

  // ── Audit logs (admin viewer — legacy audit_logs schema) ─────────────

  async getAuditLogs({
    page = 1, limit = 50, start_date, end_date, actor_sub,
    action, resource_type, status_code, method,
  } = {}) {
    const offset = (page - 1) * limit

    const applyFilters = (qh) => {
      if (start_date)    {
        qh.where('created_at', '>=', start_date)
      }
      if (end_date)      {
        qh.where('created_at', '<=', end_date)
      }
      if (actor_sub)     {
        qh.where('actor_sub', '=', actor_sub)
      }
      if (action)        {
        qh.where('action', 'ILIKE', `%${action}%`)
      }
      if (resource_type) {
        qh.where('resource_type', '=', resource_type)
      }
      if (status_code)   {
        qh.where('status_code', '=', status_code)
      }
      if (method)        {
        qh.where('method', '=', method)
      }
      return qh
    }

    const countQh = applyFilters(new QueryHelper(this.tables.AUDIT_LOG).count('*'))
    const { text: countText, values: countValues } = countQh.toParam()
    const countRows = await this.runQuery(countText, countValues, true)
    const total = parseInt(countRows[0]?.count || '0', 10)

    const mainQh = applyFilters(new QueryHelper(this.tables.AUDIT_LOG).select('*'))
    mainQh.orderBy('created_at', 'DESC').limit(limit).offset(offset)
    const { text, values } = mainQh.toParam()
    const rows = await this.runQuery(text, values, true)
    return { logs: rows, total }
  }

  async getAuditLogById(id) {
    const { text, values } = new QueryHelper(this.tables.AUDIT_LOG)
      .select('*')
      .where('id', '=', id)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0] ?? null
  }
}
