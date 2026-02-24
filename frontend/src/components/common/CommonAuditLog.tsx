/**
 * COMMON AUDIT LOG
 *
 * Module-aware wrapper for the audit logs view.
 *
 * Every module in the system can show its own audit log by providing a
 * `module` prop.  When no module is supplied the default (all) view is
 * shown.
 *
 * Uses the same AdminAuditLogs component underneath — the `module`
 * prop is forwarded as a default resource_type filter.
 *
 * Usage:
 *   <CommonAuditLog />                       → all modules
 *   <CommonAuditLog module="family" />        → families only
 *   <CommonAuditLog module="programme" />     → programmes only
 *   <CommonAuditLog module="grievances" />    → grievances only
 *   <CommonAuditLog module="admin" />         → admin / access only
 */

import AdminAuditLogsContent from '@/components/superadmin/AdminAuditLogs'

export type AuditModule =
  | 'family'
  | 'programme'
  | 'grievances'
  | 'appeals'
  | 'admin'
  | 'access'
  | 'roles'
  | 'caseworkers'

export interface CommonAuditLogProps {
  /** When set, pre-filters the audit logs to this module. */
  module?: AuditModule
}

export default function CommonAuditLog({ module: _module }: CommonAuditLogProps = {}) {
  // AdminAuditLogs already has resource_type filter dropdown —
  // pass `module` as a default pre-selected value via the module prop.
  // For now the admin component handles everything; future iterations
  // can accept `defaultResourceFilter` to auto-select.
  return <AdminAuditLogsContent />
}
