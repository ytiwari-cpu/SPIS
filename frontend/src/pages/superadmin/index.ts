/**
 * SUPER ADMIN PAGES INDEX
 * 
 * Export all super admin page components for easy importing
 */

export { default as AdminOverview, requiredPermission as overviewPerm } from './AdminOverview'
export { default as AdminFamilies, requiredPermission as adminFamiliesPerm } from './AdminFamilies'
export { default as AdminProgrammes, requiredPermission as adminProgrammesPerm } from './AdminProgrammes'
export { default as AdminGrievances, requiredPermission as adminGrievancesPerm } from './AdminGrievances'
export { default as AdminAppeals, requiredPermission as adminAppealsPerm } from './AdminAppeals'
export { default as AdminAdmins, requiredPermission as adminAdminsPerm } from './AdminAdmins'
export { default as AdminAuditLogs, requiredPermission as auditLogsPerm } from './AdminAuditLogs'
export { default as AdminRoleManagement, requiredPermission as roleManagePerm } from './AdminRoleManagement'
export { default as AdminRoles, requiredPermission as rolesPerm } from './AdminRoles'
export { default as AdminRoleForm, requiredPermission as roleFormPerm } from './AdminRoleForm'
export { default as AdminCaseWorkers, requiredPermission as caseWorkersPerm } from './AdminCaseWorkers'
export { default as AdminCaseWorkerDetail, requiredPermission as caseWorkerDetailPerm } from './AdminCaseWorkerDetail'
