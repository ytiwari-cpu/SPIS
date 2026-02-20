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
  passwordHash?: string
  registryId?: string
  nationalIdHash?: string
  status?: UserStatus
}): Promise<UserRow> {
  const { rows } = await pool.query<UserRow>(
    `INSERT INTO users (email, password_hash, registry_id, national_id_hash, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      params.email,
      params.passwordHash || '',
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

export async function updateUserPassword(userId: string, passwordHash: string): Promise<void> {
  await pool.query(
    'UPDATE users SET password_hash = $1 WHERE user_id = $2',
    [passwordHash, userId]
  )
}

export async function updateUserEmail(userId: string, email: string): Promise<void> {
  await pool.query(
    'UPDATE users SET email = $1 WHERE user_id = $2',
    [email, userId]
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
       INNER JOIN user_roles ur ON rp.role_name = ur.role_name
       WHERE ur.user_id = $1 AND rp.permission_key = $2
     ) as exists`,
    [userId, permissionKey]
  )
  return rows[0]?.exists ?? false
}
