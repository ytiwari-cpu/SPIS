/**
 * COMMON AUDIT SERVICE
 * 
 * Reusable audit logging service that can be imported into any backend service.
 * Provides a standardized way to log audit events with custom messages.
 * 
 * Usage:
 *   import { auditService } from '@common/services/auditService'
 *   await auditService.log({
 *     action: 'ROLE_ASSIGNED',
 *     resourceType: 'user',
 *     resourceId: userId,
 *     actorId: req.user.sub,
 *     actorEmail: req.user.email,
 *     actorRoles: req.user.roles,
 *     details: { role: 'Admin' },
 *     message: 'Assigned Admin role to user'
 *   })
 */

import axios from 'axios'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface AuditLogEntry {
  action: string
  resourceType: string
  resourceId?: string
  actorId?: string
  actorEmail?: string
  actorRoles?: string[]
  details?: Record<string, unknown>
  message?: string
  ipAddress?: string
  userAgent?: string
}

export interface AuditLogResult {
  success: boolean
  logId?: string
  error?: string
}

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

// ═══════════════════════════════════════════════════════════════════════════
// AUDIT SERVICE
// ═══════════════════════════════════════════════════════════════════════════

class AuditService {
  private supabaseUrl: string
  private supabaseKey: string

  constructor() {
    this.supabaseUrl = SUPABASE_URL || ''
    this.supabaseKey = SUPABASE_SERVICE_KEY || ''
  }

  /**
   * Configure the audit service with Supabase credentials.
   * Call this once at service startup if env vars aren't set.
   */
  configure(supabaseUrl: string, supabaseKey: string): void {
    this.supabaseUrl = supabaseUrl
    this.supabaseKey = supabaseKey
  }

  /**
   * Log an audit event to the database.
   */
  async log(entry: AuditLogEntry): Promise<AuditLogResult> {
    if (!this.supabaseUrl || !this.supabaseKey) {
      console.warn('[AuditService] Supabase not configured, skipping audit log')
      return { success: false, error: 'Audit service not configured' }
    }

    try {
      const sql = `
        INSERT INTO audit_logs (
          action,
          resource_type,
          resource_id,
          actor_id,
          actor_email,
          actor_roles,
          details,
          ip_address,
          user_agent,
          created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6::text[], $7::jsonb, $8, $9, NOW()
        )
        RETURNING log_id
      `

      // Format actor_roles as PostgreSQL array
      const actorRolesArray = entry.actorRoles && entry.actorRoles.length > 0
        ? `{${entry.actorRoles.join(',')}}`
        : null

      // Build details with optional custom message
      const details = {
        ...(entry.details || {}),
        ...(entry.message ? { audit_message: entry.message } : {}),
      }

      const response = await axios.post(
        `${this.supabaseUrl}/rest/v1/rpc/exec_sql`,
        {
          sql,
          params: [
            entry.action,
            entry.resourceType,
            entry.resourceId || null,
            entry.actorId || null,
            entry.actorEmail || null,
            actorRolesArray,
            JSON.stringify(details),
            entry.ipAddress || null,
            entry.userAgent || null,
          ],
        },
        {
          headers: {
            'Content-Type': 'application/json',
            apikey: this.supabaseKey,
            Authorization: `Bearer ${this.supabaseKey}`,
            Prefer: 'return=representation',
          },
        }
      )

      const rows = response.data
      if (rows && rows.length > 0 && rows[0].log_id) {
        return { success: true, logId: rows[0].log_id }
      }

      return { success: true }
    } catch (error) {
      console.error('[AuditService] Error logging audit event:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CONVENIENCE METHODS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Log a user action (login, logout, password change, etc.)
   */
  async logUserAction(
    action: string,
    userId: string,
    actorEmail: string,
    message?: string,
    details?: Record<string, unknown>
  ): Promise<AuditLogResult> {
    return this.log({
      action,
      resourceType: 'user',
      resourceId: userId,
      actorId: userId,
      actorEmail,
      message,
      details,
    })
  }

  /**
   * Log a role assignment/revocation
   */
  async logRoleChange(
    action: 'ROLE_ASSIGNED' | 'ROLE_REVOKED',
    userId: string,
    roleName: string,
    actorId: string,
    actorEmail: string,
    actorRoles: string[]
  ): Promise<AuditLogResult> {
    return this.log({
      action,
      resourceType: 'user_role',
      resourceId: userId,
      actorId,
      actorEmail,
      actorRoles,
      details: { role: roleName },
      message: `${action === 'ROLE_ASSIGNED' ? 'Assigned' : 'Revoked'} role ${roleName}`,
    })
  }

  /**
   * Log a permission grant/revoke
   */
  async logPermissionChange(
    action: 'PERMISSION_GRANTED' | 'PERMISSION_REVOKED',
    roleName: string,
    permissionKey: string,
    actorId: string,
    actorEmail: string,
    actorRoles: string[]
  ): Promise<AuditLogResult> {
    return this.log({
      action,
      resourceType: 'role_permission',
      resourceId: roleName,
      actorId,
      actorEmail,
      actorRoles,
      details: { permission: permissionKey },
      message: `${action === 'PERMISSION_GRANTED' ? 'Granted' : 'Revoked'} permission ${permissionKey} to/from role ${roleName}`,
    })
  }

  /**
   * Log a data export
   */
  async logDataExport(
    exportType: string,
    recordCount: number,
    actorId: string,
    actorEmail: string,
    actorRoles: string[],
    filters?: Record<string, unknown>
  ): Promise<AuditLogResult> {
    return this.log({
      action: 'DATA_EXPORTED',
      resourceType: exportType,
      actorId,
      actorEmail,
      actorRoles,
      details: { recordCount, filters },
      message: `Exported ${recordCount} ${exportType} records`,
    })
  }

  /**
   * Log a data import
   */
  async logDataImport(
    importType: string,
    recordCount: number,
    successCount: number,
    errorCount: number,
    actorId: string,
    actorEmail: string,
    actorRoles: string[],
    jobId?: string
  ): Promise<AuditLogResult> {
    return this.log({
      action: 'DATA_IMPORTED',
      resourceType: importType,
      resourceId: jobId,
      actorId,
      actorEmail,
      actorRoles,
      details: { recordCount, successCount, errorCount },
      message: `Imported ${successCount}/${recordCount} ${importType} records (${errorCount} errors)`,
    })
  }

  /**
   * Log a system action (background job, scheduled task, etc.)
   */
  async logSystemAction(
    action: string,
    resourceType: string,
    resourceId?: string,
    details?: Record<string, unknown>,
    message?: string
  ): Promise<AuditLogResult> {
    return this.log({
      action,
      resourceType,
      resourceId,
      actorId: 'SYSTEM',
      actorEmail: 'system@spis.local',
      actorRoles: ['SYSTEM'],
      details,
      message,
    })
  }

  /**
   * Log a security event (failed login, blocked IP, etc.)
   */
  async logSecurityEvent(
    action: string,
    ipAddress: string,
    userAgent: string,
    details?: Record<string, unknown>,
    message?: string
  ): Promise<AuditLogResult> {
    return this.log({
      action,
      resourceType: 'security',
      ipAddress,
      userAgent,
      details,
      message,
    })
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export const auditService = new AuditService()

// Re-export types for convenience
export type { AuditLogEntry as AuditEntry, AuditLogResult as AuditResult }
