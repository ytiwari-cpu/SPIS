/**
 * Audit Logs Page — permission-driven wrapper.
 *
 * Renders:
 *   • AdminAuditLogsContent  for full admins  (ADMIN.AUDITLOGS.VIEW)
 *   • AuditLogsPageContent   for programme managers
 *
 * See CommonAuditLogs (CommonAuditLog.tsx) for variant logic.
 */
import CommonAuditLogs from '@/components/common/CommonAuditLog'

export const requiredPermission = [
  'ADMIN.AUDITLOGS.VIEW',
  'ADMIN.PROGRAMMES.VIEW',
  'PROGRAMME.AUDITLOGS.VIEW',
] as const

export default function CommonAuditLogsPage() {
  return <CommonAuditLogs />
}
