import AdminAuditLogsContent from '@/components/superadmin/AdminAuditLogs'

export default function AdminAuditLogs() {
  return <AdminAuditLogsContent />
}

export const requiredPermission = 'ADMIN.AUDITLOGS.VIEW'
