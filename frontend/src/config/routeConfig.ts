/**
 * ROUTE CONFIG
 *
 * Single source of truth for all authenticated routes.
 * Each entry declares the path, the page component, and (optionally)
 * the required permission.  App.tsx reads this table and wraps every
 * entry that has `permission` in a <PermissionGuard> automatically.
 *
 * To add a new page:
 *   1. Create the page file (thin wrapper in /pages/)
 *   2. Export `requiredPermission` from that page file
 *   3. Add one line here — no changes needed in App.tsx
 */

import type { ComponentType } from 'react'

export interface RouteEntry {
  path: string
  component: ComponentType
  /**
   * Permission key(s) required to access this route.
   * Omit = always accessible.
   * string[] = OR semantics (any one grants access) — used for shared
   * citizen/admin routes so EITHER permission unlocks the route.
   */
  permission?: string | string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Lazy imports are intentionally NOT used here to keep type-safety simple.
// All pages are already code-split by Vite's chunk strategy.
// ─────────────────────────────────────────────────────────────────────────────

import SmartDashboard from '@/pages/SmartDashboard'
import Settings from '@/pages/citizen/Settings'
import NotFoundPage from '@/pages/NotFoundPage'

// Citizen
import MemberProfile, { requiredPermission as profilePerm } from '@/pages/citizen/MemberProfile'
import MyFamily, { requiredPermission as familyPerm } from '@/pages/citizen/MyFamily'
import FamilyEdit, { requiredPermission as familyEditPerm } from '@/pages/citizen/FamilyEdit'
import Documents, { requiredPermission as documentsPerm } from '@/pages/citizen/Documents'
import Benefits, { requiredPermission as benefitsPerm } from '@/pages/citizen/Benefits'
import Programmes, { requiredPermission as programmesPerm } from '@/pages/citizen/Programmes'
import Grievances, { requiredPermission as grievancesPerm } from '@/pages/citizen/Grievances'

// Admin
import { AdminUsers, adminUsersPerm } from '@/pages/admin'
import {
  AdminFamilies, adminFamiliesPerm,
  AdminProgrammes, adminProgrammesPerm,
  AdminGrievances, adminGrievancesPerm,
  AdminAppeals, adminAppealsPerm,
  AdminAdmins, adminAdminsPerm,
  AdminAuditLogs, auditLogsPerm,
  AdminRoles, rolesPerm,
  AdminRoleForm, roleFormPerm,
  AdminRoleManagement, roleManagePerm,
  AdminCaseWorkers, caseWorkersPerm,
  AdminCaseWorkerDetail, caseWorkerDetailPerm,
} from '@/pages/superadmin'

// Programme Admin
import ProgrammeDashboardPage, { requiredPermission as progPerm } from '@/pages/programme-admin/DashboardPage'
import ProgrammesPage from '@/pages/programme-admin/ProgrammesPage'
import BeneficiariesPage from '@/pages/programme-admin/BeneficiariesPage'
import PaymentsPage from '@/pages/programme-admin/PaymentsPage'
import ReportsPage from '@/pages/programme-admin/ReportsPage'
import AuditLogsPage from '@/pages/programme-admin/AuditLogsPage'
import ManagersPage from '@/pages/programme-admin/ManagersPage'
import RuleGroupsPage from '@/pages/programme-admin/RuleGroupsPage'
import VariablesPage from '@/pages/programme-admin/VariablesPage'

export const authenticatedRoutes: RouteEntry[] = [
  // ── Always accessible ──────────────────────────────────────────────────
  { path: '/dashboard', component: SmartDashboard },
  { path: '/settings', component: Settings },

  // ── Citizen ────────────────────────────────────────────────────────────
  { path: '/profile',      component: MemberProfile, permission: profilePerm },
  { path: '/family',       component: MyFamily,      permission: [familyPerm, 'ADMIN.FAMILIES.VIEW'] },
  { path: '/family/edit',  component: FamilyEdit,    permission: [familyEditPerm, 'ADMIN.FAMILIES.EDIT'] },
  { path: '/documents',    component: Documents,     permission: documentsPerm },
  { path: '/benefits',     component: Benefits,      permission: benefitsPerm },
  { path: '/programmes',   component: Programmes,    permission: [programmesPerm, 'ADMIN.PROGRAMMES.VIEW'] },
  { path: '/grievances',   component: Grievances,    permission: [grievancesPerm, 'ADMIN.GRIEVANCES.VIEW'] },

  // ── Admin ──────────────────────────────────────────────────────────────
  { path: '/admin/users',                       component: AdminUsers,          permission: adminUsersPerm },
  { path: '/admin/families',                    component: AdminFamilies,        permission: adminFamiliesPerm },
  { path: '/admin/programmes',                  component: AdminProgrammes,      permission: adminProgrammesPerm },
  { path: '/admin/programmes/:programmeId',     component: AdminProgrammes,      permission: adminProgrammesPerm },
  { path: '/admin/grievances',                  component: AdminGrievances,      permission: adminGrievancesPerm },
  { path: '/admin/appeals',                     component: AdminAppeals,         permission: adminAppealsPerm },
  { path: '/admin/admin-access',                component: AdminAdmins,          permission: adminAdminsPerm },
  { path: '/admin/audit-logs',                  component: AdminAuditLogs,       permission: auditLogsPerm },
  { path: '/admin/roles',                       component: AdminRoles,            permission: rolesPerm },
  { path: '/admin/roles/new',                   component: AdminRoleForm,         permission: 'ADMIN.ROLES.CREATE' },
  { path: '/admin/roles/:roleName/view',        component: AdminRoleForm,         permission: roleFormPerm },
  { path: '/admin/roles/:roleName/edit',        component: AdminRoleForm,         permission: 'ADMIN.ROLES.EDIT' },
  { path: '/admin/roles-management',            component: AdminRoleManagement,   permission: roleManagePerm },
  { path: '/admin/case-workers',                component: AdminCaseWorkers,      permission: caseWorkersPerm },
  { path: '/admin/case-workers/:workerId',      component: AdminCaseWorkerDetail, permission: caseWorkerDetailPerm },

  // ── Programme Admin ────────────────────────────────────────────────────
  { path: '/programme-admin/dashboard',         component: ProgrammeDashboardPage, permission: [progPerm, 'PROGRAMME.PROGRAMMES.VIEW'] },
  { path: '/programme-admin/programmes',        component: ProgrammesPage,         permission: [progPerm, 'PROGRAMME.PROGRAMMES.VIEW'] },
  { path: '/programme-admin/beneficiaries',     component: BeneficiariesPage,      permission: [progPerm, 'PROGRAMME.BENEFICIARIES.VIEW'] },
  { path: '/programme-admin/payments',          component: PaymentsPage,           permission: [progPerm, 'PROGRAMME.REPORTS.VIEW'] },
  { path: '/programme-admin/reports',           component: ReportsPage,            permission: [progPerm, 'PROGRAMME.REPORTS.VIEW'] },
  { path: '/programme-admin/audit-logs',        component: AuditLogsPage,          permission: [progPerm, 'PROGRAMME.AUDITLOGS.VIEW'] },
  { path: '/programme-admin/managers',          component: ManagersPage,           permission: [progPerm, 'PROGRAMME.MANAGERS.VIEW'] },
  { path: '/programme-admin/rule-groups',       component: RuleGroupsPage,         permission: [progPerm, 'PROGRAMME.RULES.VIEW'] },
  { path: '/programme-admin/variables',         component: VariablesPage,          permission: [progPerm, 'PROGRAMME.RULES.VIEW'] },

  // ── Catch-all (must be last) ────────────────────────────────────────────
  { path: '*', component: NotFoundPage },
]
