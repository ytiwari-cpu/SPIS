/**
 * COMMON AUDIT LOGS
 *
 * Permission-driven wrapper that renders the correct Audit Logs variant:
 *
 *   ADMIN.AUDITLOGS.VIEW (full admin / super-admin)
 *     → AdminAuditLogsContent  — system-wide audit trail
 *
 *   PROGRAMME.AUDITLOGS.VIEW | ADMIN.PROGRAMMES.VIEW  (programme manager)
 *     → AuditLogsPageContent   — programme-scoped audit log
 *
 * All decisions are permission-driven — no role-name checks.
 *
 * Used by both /admin/audit-logs and /programme-admin/audit-logs routes
 * so that a single nav entry serves every user role correctly.
 */

import AdminAuditLogsContent from '@/components/superadmin/AdminAuditLogs'
import AuditLogsPageContent  from '@/components/programme-admin/AuditLogsPage'
import { usePermissions } from '@/lib/auth'

export type AuditLogsVariant = 'admin' | 'programme'

/** Derive the variant from the user's permission set (exported for tests). */
export function resolveAuditLogsVariant(
  hasPermission: (p: string) => boolean,
): AuditLogsVariant {
  if (hasPermission('ADMIN.AUDITLOGS.VIEW')) return 'admin'
  return 'programme'
}

export default function CommonAuditLogs() {
  const { hasPermission } = usePermissions()
  const variant = resolveAuditLogsVariant(hasPermission)

  switch (variant) {
    case 'admin':
      return <AdminAuditLogsContent />
    case 'programme':
    default:
      return <AuditLogsPageContent />
  }
}
