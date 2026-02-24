/**
 * SPIS IAM Service — Data Access Layer (auth_db)
 *
 * Parameterized queries for all auth_db tables.
 */

import { pool } from './pool.js'
import { v4 as uuidv4 } from 'uuid'
import type {
  UserRow, UserRoleRow, MfaFactorRow, LoginEventRow,
  PasswordResetTokenRow, UserStatus, RoleName, MfaFactorType,
  MfaFactorStatus, LoginOutcome, OtpPurpose,
} from '../types.js'

// ═══════════════════════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════════════════════

export async function createUser(params: {
  email: string
  registryId?: string
  nationalIdHash?: string
  status?: UserStatus
}): Promise<UserRow> {
  const { rows } = await pool.query<UserRow>(
    `INSERT INTO users (email, registry_id, national_id_hash, status)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [
      params.email,
      params.registryId || null,
      params.nationalIdHash || null,
      params.status || 'pending',
    ]
  )
  return rows[0]
}

export async function getUserById(userId: string): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>(
    'SELECT * FROM users WHERE user_id = $1',
    [userId]
  )
  return rows[0] || null
}

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>(
    'SELECT * FROM users WHERE email = $1',
    [email]
  )
  return rows[0] || null
}

export async function getUserByRegistryId(registryId: string): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>(
    'SELECT * FROM users WHERE registry_id = $1',
    [registryId]
  )
  return rows[0] || null
}

export async function getUserByNationalIdHash(nationalIdHash: string): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>(
    'SELECT * FROM users WHERE national_id_hash = $1',
    [nationalIdHash]
  )
  return rows[0] || null
}

export async function updateUserStatus(userId: string, status: UserStatus): Promise<void> {
  await pool.query(
    'UPDATE users SET status = $1 WHERE user_id = $2',
    [status, userId]
  )
}

export async function updateUserEmail(userId: string, email: string): Promise<void> {
  await pool.query(
    'UPDATE users SET email = $1 WHERE user_id = $2',
    [email, userId]
  )
}

export async function updateUserPassword(userId: string, passwordHash: string): Promise<void> {
  await pool.query(
    'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE user_id = $2',
    [passwordHash, userId]
  )
}

export async function updateUserMfa(userId: string, enabled: boolean, secret?: string | null): Promise<void> {
  await pool.query(
    'UPDATE users SET mfa_enabled = $1, mfa_secret = $2 WHERE user_id = $3',
    [enabled, secret ?? null, userId]
  )
}

export async function incrementFailedLogins(userId: string): Promise<number> {
  const { rows } = await pool.query<{ failed_login_attempts: number }>(
    `UPDATE users
     SET failed_login_attempts = failed_login_attempts + 1
     WHERE user_id = $1
     RETURNING failed_login_attempts`,
    [userId]
  )
  return rows[0]?.failed_login_attempts ?? 0
}

export async function resetFailedLogins(userId: string): Promise<void> {
  await pool.query(
    'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE user_id = $1',
    [userId]
  )
}

export async function lockUser(userId: string, lockedUntil: Date): Promise<void> {
  await pool.query(
    'UPDATE users SET status = $1, locked_until = $2 WHERE user_id = $3',
    ['locked', lockedUntil.toISOString(), userId]
  )
}

export async function disableUser(userId: string): Promise<void> {
  await pool.query(
    'UPDATE users SET status = $1 WHERE user_id = $2',
    ['disabled', userId]
  )
}

/**
 * List all users with optional filters and pagination.
 *
 * Notes on Supabase RPC compatibility:
 *   - inlineParams() handles $N substitution by string replacement.
 *   - Arrays aren't natively supported by inlineParams, so for the role
 *     filter we build an explicit IN (...) list instead of using ANY($N).
 *   - Sensitive columns (mfa_secret) are excluded.
 */
export async function listUsers(params: {
  page?: number
  limit?: number
  status?: string
  role?: string
  search?: string
}): Promise<{ users: UserRow[]; total: number }> {
  const { page = 1, limit = 20, status, role, search } = params
  const offset = (page - 1) * limit

  // ── Build WHERE dynamically ──────────────────────────────────────────
  let whereClause = 'WHERE 1=1'
  const queryParams: (string | number)[] = []
  let paramIndex = 1
  let needsRoleJoin = false

  if (status) {
    whereClause += ` AND u.status = $${paramIndex++}`
    queryParams.push(status)
  }

  if (role) {
    // Build an explicit IN list so inlineParams can handle each value
    const roles = role.split(',').map(r => r.trim()).filter(Boolean)
    if (roles.length > 0) {
      needsRoleJoin = true
      const placeholders = roles.map(() => `$${paramIndex++}`).join(', ')
      whereClause += ` AND ur.role_name IN (${placeholders})`
      queryParams.push(...roles)
    }
  }

  if (search) {
    whereClause += ` AND (u.email ILIKE $${paramIndex++})`
    queryParams.push(`%${search}%`)
  }

  // ── Count ────────────────────────────────────────────────────────────
  const countFrom = needsRoleJoin
    ? 'SELECT COUNT(DISTINCT u.user_id) as total FROM users u INNER JOIN user_roles ur ON u.user_id = ur.user_id'
    : 'SELECT COUNT(*) as total FROM users u'

  const { rows: countRows } = await pool.query<{ total: string }>(
    `${countFrom} ${whereClause}`,
    queryParams,
  )
  const total = parseInt(countRows[0]?.total || '0', 10)

  // ── Main query ───────────────────────────────────────────────────────
  // Exclude sensitive columns (mfa_secret).
  // IMPORTANT: Cannot use SELECT DISTINCT with json columns — PostgreSQL
  // has no equality operator for json.  When a role join is needed we use
  // GROUP BY instead to deduplicate rows.
  const safeColumns = [
    'u.user_id', 'u.email', 'u.status', 'u.registry_id',
    'u.national_id_hash', 'u.mfa_enabled', 'u.failed_login_attempts',
    'u.locked_until', 'u.created_at', 'u.updated_at',
  ].join(', ')

  const rolesSubquery = `COALESCE(
        (SELECT json_agg(json_build_object('role_name', ur2.role_name, 'created_at', ur2.created_at))
         FROM user_roles ur2 WHERE ur2.user_id = u.user_id),
        '[]'::json
      ) as roles`

  let mainQuery: string

  if (needsRoleJoin) {
    // When filtering by role we join user_roles and GROUP BY to deduplicate
    mainQuery = `
      SELECT ${safeColumns}, ${rolesSubquery}
      FROM users u
      INNER JOIN user_roles ur ON u.user_id = ur.user_id
      ${whereClause}
      GROUP BY ${safeColumns}
      ORDER BY u.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `
  } else {
    // No join needed — one row per user already
    mainQuery = `
      SELECT ${safeColumns}, ${rolesSubquery}
      FROM users u
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `
  }

  const { rows } = await pool.query(
    mainQuery,
    [...queryParams, limit, offset],
  )

  return { users: rows as unknown as UserRow[], total }
}

/**
 * Update user roles - replaces all existing roles
 * Note: Using sequential queries since we're on Supabase RPC (no true transactions)
 */
export async function setUserRoles(userId: string, roles: RoleName[]): Promise<void> {
  // Remove all existing roles
  await pool.query('DELETE FROM user_roles WHERE user_id = $1', [userId])
  
  // Add new roles
  for (const role of roles) {
    await pool.query(
      'INSERT INTO user_roles (user_id, role_name) VALUES ($1, $2)',
      [userId, role]
    )
  }
}

// ═══════════════════════════════════════════════════════════════
// USER_ROLES
// ═══════════════════════════════════════════════════════════════

export async function addRole(userId: string, roleName: RoleName): Promise<void> {
  await pool.query(
    `INSERT INTO user_roles (user_id, role_name)
     VALUES ($1, $2)
     ON CONFLICT (user_id, role_name) DO NOTHING`,
    [userId, roleName]
  )
}

export async function getUserRoles(userId: string): Promise<UserRoleRow[]> {
  const { rows } = await pool.query<UserRoleRow>(
    'SELECT * FROM user_roles WHERE user_id = $1',
    [userId]
  )
  return rows
}

export async function removeRole(userId: string, roleName: RoleName): Promise<void> {
  await pool.query(
    'DELETE FROM user_roles WHERE user_id = $1 AND role_name = $2',
    [userId, roleName]
  )
}

// ═══════════════════════════════════════════════════════════════
// MFA_FACTORS
// ═══════════════════════════════════════════════════════════════

export async function createMfaFactor(params: {
  userId: string
  factorType: MfaFactorType
  secret?: string
  phone?: string
  email?: string
  status?: MfaFactorStatus
}): Promise<MfaFactorRow> {
  const { rows } = await pool.query<MfaFactorRow>(
    `INSERT INTO mfa_factors (user_id, factor_type, secret, phone, email, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      params.userId,
      params.factorType,
      params.secret || null,
      params.phone || null,
      params.email || null,
      params.status || 'pending',
    ]
  )
  return rows[0]
}

export async function getMfaFactors(userId: string): Promise<MfaFactorRow[]> {
  const { rows } = await pool.query<MfaFactorRow>(
    'SELECT * FROM mfa_factors WHERE user_id = $1',
    [userId]
  )
  return rows
}

export async function getActiveMfaFactor(userId: string, factorType: MfaFactorType): Promise<MfaFactorRow | null> {
  const { rows } = await pool.query<MfaFactorRow>(
    `SELECT * FROM mfa_factors
     WHERE user_id = $1 AND factor_type = $2 AND status = 'active'
     LIMIT 1`,
    [userId, factorType]
  )
  return rows[0] || null
}

export async function updateMfaFactorStatus(factorId: string, status: MfaFactorStatus): Promise<void> {
  await pool.query(
    'UPDATE mfa_factors SET status = $1 WHERE id = $2',
    [status, factorId]
  )
}

// ═══════════════════════════════════════════════════════════════
// LOGIN_EVENTS  (audit log)
// ═══════════════════════════════════════════════════════════════

export async function recordLoginEvent(params: {
  userId: string
  ip: string
  userAgent: string
  outcome: LoginOutcome
}): Promise<LoginEventRow> {
  const { rows } = await pool.query<LoginEventRow>(
    `INSERT INTO login_events (user_id, ip, user_agent, outcome)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [params.userId, params.ip, params.userAgent, params.outcome]
  )
  return rows[0]
}

export async function getRecentLoginEvents(userId: string, limit = 10): Promise<LoginEventRow[]> {
  const { rows } = await pool.query<LoginEventRow>(
    'SELECT * FROM login_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
    [userId, limit]
  )
  return rows
}

// ═══════════════════════════════════════════════════════════════
// PASSWORD_RESET_TOKENS  (OTP codes)
// ═══════════════════════════════════════════════════════════════

export async function createOtpToken(params: {
  userId: string
  otpHash: string
  purpose: OtpPurpose
  expiresAt: Date
  maxAttempts?: number
}): Promise<PasswordResetTokenRow> {
  // Invalidate previous unused tokens for same user + purpose
  await pool.query(
    `UPDATE password_reset_tokens
     SET used = TRUE
     WHERE user_id = $1 AND purpose = $2 AND used = FALSE`,
    [params.userId, params.purpose]
  )

  const { rows } = await pool.query<PasswordResetTokenRow>(
    `INSERT INTO password_reset_tokens (user_id, otp_hash, purpose, expires_at, max_attempts)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      params.userId,
      params.otpHash,
      params.purpose,
      params.expiresAt.toISOString(),
      params.maxAttempts || 5,
    ]
  )
  return rows[0]
}

export async function getActiveOtpToken(userId: string, purpose: OtpPurpose): Promise<PasswordResetTokenRow | null> {
  const { rows } = await pool.query<PasswordResetTokenRow>(
    `SELECT * FROM password_reset_tokens
     WHERE user_id = $1
       AND purpose = $2
       AND used = FALSE
       AND expires_at > NOW()
       AND attempt_count < max_attempts
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, purpose]
  )
  return rows[0] || null
}

export async function incrementOtpAttempt(tokenId: string): Promise<number> {
  const { rows } = await pool.query<{ attempt_count: number }>(
    `UPDATE password_reset_tokens
     SET attempt_count = attempt_count + 1
     WHERE id = $1
     RETURNING attempt_count`,
    [tokenId]
  )
  return rows[0]?.attempt_count ?? 0
}

export async function markOtpUsed(tokenId: string): Promise<void> {
  await pool.query(
    'UPDATE password_reset_tokens SET used = TRUE WHERE id = $1',
    [tokenId]
  )
}

// ═══════════════════════════════════════════════════════════════
// PERMISSIONS
// ═══════════════════════════════════════════════════════════════

export interface PermissionRow {
  permission_id: string
  permission_key: string
  permission_name: string
  description: string | null
  module: string
  created_at: string
  updated_at: string
}

export interface RolePermissionRow {
  role_permission_id: string
  role_name: string
  permission_key: string
  granted_by: string | null
  created_at: string
}

/**
 * Get all available permissions
 */
export async function getAllPermissions(): Promise<PermissionRow[]> {
  const { rows } = await pool.query<PermissionRow>(
    'SELECT * FROM permissions ORDER BY module, permission_key'
  )
  return rows
}

/**
 * Get permissions by module
 */
export async function getPermissionsByModule(module: string): Promise<PermissionRow[]> {
  const { rows } = await pool.query<PermissionRow>(
    'SELECT * FROM permissions WHERE module = $1 ORDER BY permission_key',
    [module]
  )
  return rows
}

/**
 * Get all permissions for a specific role
 */
export async function getRolePermissions(roleName: string): Promise<PermissionRow[]> {
  const { rows } = await pool.query<PermissionRow>(
    `SELECT p.*
     FROM permissions p
     INNER JOIN role_permissions rp ON p.permission_key = rp.permission_key
     WHERE rp.role_name = $1
     ORDER BY p.module, p.permission_key`,
    [roleName]
  )
  return rows
}

/**
 * Get all permissions for a user (by their roles)
 */
export async function getUserPermissions(userId: string): Promise<string[]> {
  const { rows } = await pool.query<{ permission_key: string }>(
    `SELECT DISTINCT p.permission_key
     FROM permissions p
     INNER JOIN role_permissions rp ON p.permission_key = rp.permission_key
     INNER JOIN user_roles ur ON rp.role_name = ur.role_name::text
     WHERE ur.user_id = $1`,
    [userId]
  )
  return rows.map(r => r.permission_key)
}

/**
 * Grant a permission to a role
 */
export async function grantPermissionToRole(
  roleName: string,
  permissionKey: string,
  grantedBy: string
): Promise<void> {
  await pool.query(
    `INSERT INTO role_permissions (role_name, permission_key, granted_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (role_name, permission_key) DO NOTHING`,
    [roleName, permissionKey, grantedBy]
  )
}

/**
 * Revoke a permission from a role
 */
export async function revokePermissionFromRole(
  roleName: string,
  permissionKey: string
): Promise<void> {
  await pool.query(
    'DELETE FROM role_permissions WHERE role_name = $1 AND permission_key = $2',
    [roleName, permissionKey]
  )
}

/**
 * Check if a user has a specific permission
 */
export async function userHasPermission(userId: string, permissionKey: string): Promise<boolean> {
  const { rows } = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM role_permissions rp
       INNER JOIN user_roles ur ON rp.role_name = ur.role_name::text
       WHERE ur.user_id = $1 AND rp.permission_key = $2
     ) as exists`,
    [userId, permissionKey]
  )
  return rows[0]?.exists ?? false
}

// ═════════════════════════════════════════════════════════════
// ROLES MANAGEMENT
// ═════════════════════════════════════════════════════════════

export interface RoleDetails {
  role_name: string
  display_name: string
  description: string
  is_system: boolean
  user_count: number
  permission_count: number
  created_at: string
}

/**
 * Get all roles with metadata
 */
export async function getAllRoles(): Promise<RoleDetails[]> {
  const { rows } = await pool.query<RoleDetails>(
    `SELECT 
       r.role_name,
       r.role_name as display_name,
       CASE 
         WHEN r.role_name = 'Citizen' THEN 'Regular citizens accessing the portal'
         WHEN r.role_name = 'CaseWorker' THEN 'Staff managing citizen cases'
         WHEN r.role_name = 'ProgrammeManager' THEN 'Staff managing programmes'
         WHEN r.role_name = 'Admin' THEN 'System administrators'
         WHEN r.role_name = 'SuperAdmin' THEN 'Full system access'
         ELSE 'Custom role'
       END as description,
       r.role_name IN ('Citizen', 'CaseWorker', 'ProgrammeManager', 'Admin', 'SuperAdmin') as is_system,
       COALESCE(u.user_count, 0) as user_count,
       COALESCE(p.permission_count, 0) as permission_count,
       NOW() as created_at
     FROM (
       SELECT DISTINCT role_name::text AS role_name FROM user_roles 
       UNION 
       SELECT DISTINCT role_name FROM role_permissions
     ) r
     LEFT JOIN (
       SELECT role_name::text AS role_name, COUNT(*) as user_count 
       FROM user_roles 
       GROUP BY role_name::text
     ) u ON r.role_name = u.role_name
     LEFT JOIN (
       SELECT role_name, COUNT(*) as permission_count 
       FROM role_permissions 
       GROUP BY role_name
     ) p ON r.role_name = p.role_name
     ORDER BY 
       CASE r.role_name 
         WHEN 'SuperAdmin' THEN 1
         WHEN 'Admin' THEN 2
         WHEN 'ProgrammeManager' THEN 3
         WHEN 'CaseWorker' THEN 4
         WHEN 'Citizen' THEN 5
         ELSE 6
       END,
       r.role_name`
  )
  return rows
}

/**
 * Get role by name (from roles table, active only)
 */
export async function getRoleByName(roleName: string): Promise<RoleDetails | null> {
  const { rows } = await pool.query<RoleDetails>(
    `SELECT 
       r.role_name,
       r.display_name,
       r.description,
       r.role_type = 'system' as is_system,
       COALESCE(u.user_count, 0) as user_count,
       COALESCE(p.permission_count, 0) as permission_count,
       r.created_at
     FROM roles r
     LEFT JOIN (
       SELECT role_name::text AS role_name, COUNT(*) as user_count 
       FROM user_roles 
       GROUP BY role_name::text
     ) u ON r.role_name = u.role_name
     LEFT JOIN (
       SELECT role_name, COUNT(*) as permission_count 
       FROM role_permissions 
       GROUP BY role_name
     ) p ON r.role_name = p.role_name
     WHERE r.role_name = $1 AND r.is_active = true`,
    [roleName]
  )
  return rows[0] || null
}

// ═════════════════════════════════════════════════════════════
// ROLE CRUD OPERATIONS
// ═════════════════════════════════════════════════════════════

export interface CreateRoleParams {
  role_name: string
  display_name: string
  description?: string
  created_by?: string
}

export interface UpdateRoleParams {
  display_name?: string
  description?: string
}

export interface RoleRow {
  role_id: string
  role_name: string
  display_name: string
  description: string | null
  role_type: 'system' | 'custom'
  is_active: boolean
  created_at: string
  updated_at: string
  created_by: string | null
}

/**
 * Create a new role
 */
export async function createRole(params: CreateRoleParams): Promise<RoleRow> {
  const { rows } = await pool.query<RoleRow>(
    `INSERT INTO roles (role_name, display_name, description, role_type, created_by)
     VALUES ($1, $2, $3, 'custom', $4)
     RETURNING *`,
    [params.role_name, params.display_name, params.description || null, params.created_by || null]
  )
  return rows[0]
}

/**
 * Update a role (name/description only - cannot change role_type)
 */
export async function updateRole(roleName: string, params: UpdateRoleParams): Promise<RoleRow | null> {
  const updates: string[] = []
  const values: unknown[] = []
  let paramIndex = 1

  if (params.display_name !== undefined) {
    updates.push(`display_name = $${paramIndex++}`)
    values.push(params.display_name)
  }
  if (params.description !== undefined) {
    updates.push(`description = $${paramIndex++}`)
    values.push(params.description)
  }

  if (updates.length === 0) {
    return getRoleRowByName(roleName)
  }

  values.push(roleName)
  const { rows } = await pool.query<RoleRow>(
    `UPDATE roles SET ${updates.join(', ')}, updated_at = NOW()
     WHERE role_name = $${paramIndex} AND is_active = true
     RETURNING *`,
    values
  )
  return rows[0] || null
}

/**
 * Soft delete a role (set is_active = false)
 * Only custom roles can be deleted
 * Also removes all user_roles assignments for this role
 */
export async function deleteRole(roleName: string): Promise<boolean> {
  // First, remove all user_roles for this role
  await pool.query(
    'DELETE FROM user_roles WHERE role_name = $1 RETURNING *',
    [roleName]
  )
  
  // Then soft-delete the role (use RETURNING to get proper rowCount via exec_dml)
  const { rowCount } = await pool.query(
    `UPDATE roles SET is_active = false, updated_at = NOW()
     WHERE role_name = $1 AND role_type = 'custom' AND is_active = true
     RETURNING *`,
    [roleName]
  )
  return (rowCount ?? 0) > 0
}

/**
 * Get role by name (raw row)
 */
export async function getRoleRowByName(roleName: string): Promise<RoleRow | null> {
  const { rows } = await pool.query<RoleRow>(
    'SELECT * FROM roles WHERE role_name = $1 AND is_active = true',
    [roleName]
  )
  return rows[0] || null
}

/**
 * Check if role name exists
 */
export async function roleNameExists(roleName: string): Promise<boolean> {
  const { rows } = await pool.query<{ exists: boolean }>(
    'SELECT EXISTS(SELECT 1 FROM roles WHERE role_name = $1) as exists',
    [roleName]
  )
  return rows[0]?.exists ?? false
}

/**
 * Get all roles from roles table (enhanced) - supports filtering by is_active
 */
export async function getAllRolesEnhanced(isActive: boolean = true): Promise<RoleRow[]> {
  const { rows } = await pool.query<RoleRow>(
    `SELECT r.*,
       COALESCE(u.user_count, 0)::int as user_count,
       COALESCE(p.permission_count, 0)::int as permission_count
     FROM roles r
     LEFT JOIN (
       SELECT role_name::text AS role_name, COUNT(*) as user_count 
       FROM user_roles 
       GROUP BY role_name::text
     ) u ON r.role_name = u.role_name
     LEFT JOIN (
       SELECT role_name, COUNT(*) as permission_count 
       FROM role_permissions 
       GROUP BY role_name
     ) p ON r.role_name = p.role_name
     WHERE r.is_active = $1
     ORDER BY 
       CASE r.role_type WHEN 'system' THEN 0 ELSE 1 END,
       CASE r.role_name 
         WHEN 'SuperAdmin' THEN 1
         WHEN 'Admin' THEN 2
         WHEN 'ProgrammeManager' THEN 3
         WHEN 'CaseWorker' THEN 4
         WHEN 'Citizen' THEN 5
         ELSE 6
       END,
       r.role_name`,
    [isActive]
  )
  return rows
}

/**
 * Restore a soft-deleted role (set is_active = true)
 */
export async function restoreRole(roleName: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE roles SET is_active = true, updated_at = NOW()
     WHERE role_name = $1 AND is_active = false
     RETURNING *`,
    [roleName]
  )
  return (rowCount ?? 0) > 0
}

/**
 * Permanently delete a role from the database
 * Only works for inactive custom roles
 */
export async function permanentlyDeleteRole(roleName: string): Promise<boolean> {
  // Check if role exists and is inactive custom role
  const { rows } = await pool.query<RoleRow>(
    'SELECT * FROM roles WHERE role_name = $1',
    [roleName]
  )
  
  if (rows.length === 0) {
    return false
  }
  
  const role = rows[0]
  
  // Cannot delete system roles
  if (role.role_type === 'system') {
    throw new Error('System roles cannot be permanently deleted')
  }
  
  // Cannot delete active roles
  if (role.is_active) {
    throw new Error('Active roles cannot be permanently deleted. Deactivate the role first.')
  }
  
  // Delete role_permissions first (use RETURNING for proper exec_dml)
  await pool.query(
    'DELETE FROM role_permissions WHERE role_name = $1 RETURNING *',
    [roleName]
  )
  
  // Delete the role permanently (use RETURNING for proper exec_dml)
  const { rowCount } = await pool.query(
    'DELETE FROM roles WHERE role_name = $1 RETURNING *',
    [roleName]
  )
  
  return (rowCount ?? 0) > 0
}

/**
 * Get role by name including inactive roles (for permanent delete)
 */
export async function getRoleByNameIncludingInactive(roleName: string): Promise<RoleRow | null> {
  const { rows } = await pool.query<RoleRow>(
    'SELECT * FROM roles WHERE role_name = $1',
    [roleName]
  )
  return rows[0] || null
}

/**
 * Replace all permissions for a role (atomic operations)
 * Note: Uses individual queries since Supabase REST doesn't support transactions
 */
export async function replaceRolePermissions(
  roleName: string,
  permissionKeys: string[],
  grantedBy: string
): Promise<{ added: string[]; removed: string[] }> {
  // Get current permissions
  const { rows: currentPerms } = await pool.query<{ permission_key: string }>(
    'SELECT permission_key FROM role_permissions WHERE role_name = $1',
    [roleName]
  )
  const currentKeys = currentPerms.map((p: { permission_key: string }) => p.permission_key)
  
  // Calculate diff
  const toAdd = permissionKeys.filter((k: string) => !currentKeys.includes(k))
  const toRemove = currentKeys.filter((k: string) => !permissionKeys.includes(k))
  
  // Remove old permissions
  for (const permKey of toRemove) {
    await pool.query(
      'DELETE FROM role_permissions WHERE role_name = $1 AND permission_key = $2',
      [roleName, permKey]
    )
  }
  
  // Add new permissions
  for (const permKey of toAdd) {
    await pool.query(
      `INSERT INTO role_permissions (role_name, permission_key, granted_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (role_name, permission_key) DO NOTHING`,
      [roleName, permKey, grantedBy]
    )
  }
  
  return { added: toAdd, removed: toRemove }
}

// ═════════════════════════════════════════════════════════════
// AUDIT LOG OPERATIONS
// ═════════════════════════════════════════════════════════════

export interface AuditLogEntry {
  id: string
  actor_sub: string | null
  actor_email: string | null
  actor_roles: string[] | null
  action: string
  method: string
  path: string
  resource_type: string | null
  resource_id: string | null
  status_code: number
  request_id: string | null
  ip_address: string | null
  user_agent: string | null
  request_summary: Record<string, unknown> | null
  response_summary: Record<string, unknown> | null
  duration_ms: number | null
  created_at: string
}

export interface CreateAuditLogParams {
  actor_sub?: string
  actor_email?: string
  actor_roles?: string[]
  action: string
  method: string
  path: string
  resource_type?: string
  resource_id?: string
  status_code: number
  request_id?: string
  ip_address?: string
  user_agent?: string
  request_summary?: Record<string, unknown>
  response_summary?: Record<string, unknown>
  duration_ms?: number
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(params: CreateAuditLogParams): Promise<void> {
  // Format actor_roles as PostgreSQL array literal: '{role1,role2}'
  const rolesLiteral = params.actor_roles && params.actor_roles.length > 0
    ? `{${params.actor_roles.join(',')}}`
    : null
    
  await pool.query(
    `INSERT INTO audit_logs (
      actor_sub, actor_email, actor_roles, action, method, path,
      resource_type, resource_id, status_code, request_id,
      ip_address, user_agent, request_summary, response_summary, duration_ms
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
    [
      params.actor_sub || null,
      params.actor_email || null,
      rolesLiteral,
      params.action,
      params.method,
      params.path,
      params.resource_type || null,
      params.resource_id || null,
      params.status_code,
      params.request_id || null,
      params.ip_address || null,
      params.user_agent || null,
      params.request_summary ? JSON.stringify(params.request_summary) : null,
      params.response_summary ? JSON.stringify(params.response_summary) : null,
      params.duration_ms || null,
    ]
  )
}

export interface AuditLogFilters {
  start_date?: string
  end_date?: string
  actor_sub?: string
  action?: string
  resource_type?: string
  status_code?: number
  method?: string
  page?: number
  limit?: number
}

/**
 * Query audit logs with filters
 */
export async function getAuditLogs(filters: AuditLogFilters): Promise<{ logs: AuditLogEntry[]; total: number }> {
  const { page = 1, limit = 50 } = filters
  const offset = (page - 1) * limit
  
  let whereClause = 'WHERE 1=1'
  const params: unknown[] = []
  let paramIndex = 1
  
  if (filters.start_date) {
    whereClause += ` AND created_at >= $${paramIndex++}`
    params.push(filters.start_date)
  }
  if (filters.end_date) {
    whereClause += ` AND created_at <= $${paramIndex++}`
    params.push(filters.end_date)
  }
  if (filters.actor_sub) {
    whereClause += ` AND actor_sub = $${paramIndex++}`
    params.push(filters.actor_sub)
  }
  if (filters.action) {
    whereClause += ` AND action ILIKE $${paramIndex++}`
    params.push(`%${filters.action}%`)
  }
  if (filters.resource_type) {
    whereClause += ` AND resource_type = $${paramIndex++}`
    params.push(filters.resource_type)
  }
  if (filters.status_code) {
    whereClause += ` AND status_code = $${paramIndex++}`
    params.push(filters.status_code)
  }
  if (filters.method) {
    whereClause += ` AND method = $${paramIndex++}`
    params.push(filters.method)
  }
  
  // Count query
  const { rows: countRows } = await pool.query<{ total: string }>(
    `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`,
    params
  )
  const total = parseInt(countRows[0]?.total || '0', 10)
  
  // Data query
  const dataParams = [...params, limit, offset]
  const { rows } = await pool.query<AuditLogEntry>(
    `SELECT * FROM audit_logs ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    dataParams
  )
  
  return { logs: rows, total }
}

/**
 * Get single audit log by ID
 */
export async function getAuditLogById(id: string): Promise<AuditLogEntry | null> {
  const { rows } = await pool.query<AuditLogEntry>(
    'SELECT * FROM audit_logs WHERE id = $1',
    [id]
  )
  return rows[0] || null
}
