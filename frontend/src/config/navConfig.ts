/**
 * UNIFIED NAVIGATION CONFIG
 *
 * Single source of truth for ALL sidebar navigation items.
 * Used by AppLayout to render the full menu tree for every user.
 *
 * Visibility/clickability is controlled ONLY by `requiredPermission`.
 * If the user has the permission → enabled link.
 * If the user lacks it → shown disabled with a lock icon + tooltip.
 *
 * Adding a new page? Just add an entry here. No layout changes needed.
 */

export interface NavItem {
  path: string
  label: string
  icon: string
  /**
   * Permission key(s) required to access this page.
   *   string   → single permission check
   *   string[] → OR semantics (any one grants access)
   */
  requiredPermission?: string | string[]
  /** Section divider label rendered above this item. */
  section?: string
}

/**
 * Complete navigation tree.
 *
 * Items without `requiredPermission` are always accessible to any
 * authenticated user (e.g. Dashboard, Settings).
 */
export const navConfig: NavItem[] = [
  // ── Dashboard ────────────────────────────────────────────────────────
  { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },

  // ── Citizen Features ─────────────────────────────────────────────────
  { path: '/family', label: 'My Family', icon: 'family_restroom', requiredPermission: 'CITIZEN.FAMILY.VIEW', section: 'Citizen' },
  { path: '/profile', label: 'My Profile', icon: 'person', requiredPermission: 'CITIZEN.PROFILE.VIEW' },
  { path: '/documents', label: 'Documents', icon: 'description', requiredPermission: 'CITIZEN.DOCUMENTS.VIEW' },
  { path: '/programmes', label: 'Programmes', icon: 'verified_user', requiredPermission: 'CITIZEN.PROGRAMMES.VIEW' },
  { path: '/benefits', label: 'Benefits', icon: 'payments', requiredPermission: 'CITIZEN.BENEFITS.VIEW' },
  { path: '/grievances', label: 'Grievances', icon: 'error_outline', requiredPermission: 'CITIZEN.GRIEVANCES.VIEW' },

  // ── Administration ───────────────────────────────────────────────────
  { path: '/admin/families', label: 'Families', icon: 'family_restroom', requiredPermission: 'ADMIN.FAMILIES.VIEW', section: 'Administration' },
  { path: '/admin/programmes', label: 'Programmes', icon: 'verified_user', requiredPermission: 'ADMIN.PROGRAMMES.VIEW' },
  { path: '/admin/grievances', label: 'Grievances', icon: 'error_outline', requiredPermission: 'ADMIN.GRIEVANCES.VIEW' },
  { path: '/admin/appeals', label: 'Appeals', icon: 'gavel', requiredPermission: 'ADMIN.APPEALS.VIEW' },
  { path: '/admin/users', label: 'Users', icon: 'group', requiredPermission: 'ADMIN.USERS.VIEW' },
  { path: '/admin/case-workers', label: 'Case Workers', icon: 'support_agent', requiredPermission: 'ADMIN.CASEWORKERS.VIEW' },
  { path: '/admin/admin-access', label: 'Admins & Access', icon: 'admin_panel_settings', requiredPermission: 'ADMIN.ACCESS.VIEW' },

  // ── Programme ──────────────────────────────────────────────────────────
  // Each item accepts EITHER ADMIN.PROGRAMMES.VIEW (full admin)
  // OR the specific PROGRAMME.* key (ProgrammeManager role).
  { path: '/programme-admin/programmes',    label: 'Programmes',         icon: 'verified_user',    requiredPermission: ['ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.PROGRAMMES.VIEW'],   section: 'Programme' },
  { path: '/programme-admin/beneficiaries', label: 'Enrollment',         icon: 'group_add',        requiredPermission: ['ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.BENEFICIARIES.VIEW'] },
  { path: '/programme-admin/payments',      label: 'Payments',           icon: 'credit_card',      requiredPermission: ['ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.REPORTS.VIEW'] },
  { path: '/programme-admin/reports',       label: 'Reports',            icon: 'bar_chart',        requiredPermission: ['ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.REPORTS.VIEW'] },
  { path: '/programme-admin/managers',      label: 'Programme Settings', icon: 'settings',         requiredPermission: ['ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.MANAGERS.VIEW'] },
  { path: '/programme-admin/rule-groups',   label: 'Rule Groups',        icon: 'rule',             requiredPermission: ['ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.RULES.VIEW'] },
  { path: '/programme-admin/variables',     label: 'Variables',          icon: 'data_object',      requiredPermission: ['ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.RULES.VIEW'] },

  // ── Audits and Reports ───────────────────────────────────────────────
  { path: '/admin/audit-logs',           label: 'Audit Logs', icon: 'history', requiredPermission: 'ADMIN.AUDITLOGS.VIEW',                                        section: 'Audits and Reports' },
  { path: '/programme-admin/audit-logs', label: 'Audit Logs', icon: 'history', requiredPermission: ['ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.AUDITLOGS.VIEW'] },

  // ── Settings ─────────────────────────────────────────────────────────
  { path: '/settings', label: 'Settings', icon: 'settings', section: 'Account' },
]

/** Bottom-bar items for mobile (subset of navConfig). */
export const mobileBottomNav: NavItem[] = [
  { path: '/dashboard', label: 'Home', icon: 'home' },
  { path: '/family', label: 'Family', icon: 'family_restroom', requiredPermission: 'CITIZEN.FAMILY.VIEW' },
  { path: '/benefits', label: 'Benefits', icon: 'payments', requiredPermission: 'CITIZEN.BENEFITS.VIEW' },
  { path: '/settings', label: 'More', icon: 'more_horiz' },
]
