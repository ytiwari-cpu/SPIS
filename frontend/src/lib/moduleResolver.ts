/**
 * MODULE RESOLVER — Centralized Module Variant Selection
 *
 * Single source of truth for deciding which variant (admin vs citizen) of
 * each overlapping module is active.  Used by:
 *
 *   • Sidebar builder  — hides the losing variant so there are no duplicates
 *   • Route guard      — allows access via EITHER admin or citizen permission
 *   • Common* wrappers — render the correct component based on permissions
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * RULES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   1. ALL decisions are PERMISSION-BASED (never role-name based).
 *   2. Admin permission wins over citizen permission for the same module.
 *   3. Citizen-only modules (Profile, Documents, Benefits) are never hidden.
 *   4. Programme Admin section is independent and not deduplicated here.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ── Module definitions ─────────────────────────────────────────────────────
// Each entry maps a logical module to its admin / citizen sidebar path and
// the permission that controls each variant.

export interface OverlappingModule {
  /** Admin variant nav path */
  adminPath: string
  /** Citizen variant nav path */
  citizenPath: string
  /** Permission required for the admin variant */
  adminPerm: string
  /** Permission required for the citizen variant */
  citizenPerm: string
}

/**
 * Modules that exist in BOTH citizen and admin sections.
 * When a user has both permissions, only the admin variant appears in the
 * sidebar. The citizen route still works (via Common* wrappers) but is not
 * duplicated in navigation.
 */
export const OVERLAPPING_MODULES: Record<string, OverlappingModule> = {
  families: {
    adminPath: '/admin/families',
    citizenPath: '/family',
    adminPerm: 'ADMIN.FAMILIES.VIEW',
    citizenPerm: 'CITIZEN.FAMILY.VIEW',
  },
  programmes: {
    // Admin variant lives under Administration, not Programme Admin
    adminPath: '/admin/programmes',
    citizenPath: '/programmes',
    adminPerm: 'ADMIN.PROGRAMMES.VIEW',
    citizenPerm: 'CITIZEN.PROGRAMMES.VIEW',
  },
  grievances: {
    adminPath: '/admin/grievances',
    citizenPath: '/grievances',
    adminPerm: 'ADMIN.GRIEVANCES.VIEW',
    citizenPerm: 'CITIZEN.GRIEVANCES.VIEW',
  },
} as const

/**
 * Paths to hide from the sidebar when the user has a "higher" permission
 * that already covers the same module via a different nav section.
 *
 * NOTE: We intentionally do NOT hide /programme-admin/programmes for full
 * admins, because /admin/programmes (Administration section) is a read-only
 * overview while /programme-admin/programmes is the management view
 * (create, edit, publish).  Users with both admin + programme management
 * access need both.
 */
interface PrivilegedOverride {
  /** Nav path to suppress in the sidebar. */
  hidePath: string
  /** Hide this path only when the user has this permission. */
  whenHasPerm: string
}

export const PRIVILEGED_OVERRIDES: PrivilegedOverride[] = [
  // No overrides — programme admin items are never hidden for full admins.
]

export type ModuleVariant = 'admin' | 'citizen' | 'none'

// ── Resolver functions ─────────────────────────────────────────────────────

type PermChecker = (permission: string) => boolean

/**
 * For a given overlapping module, decide which variant should be active.
 *
 *   admin wins  → user has the admin permission (regardless of citizen)
 *   citizen     → user has only the citizen permission
 *   none        → user has neither
 */
export function resolveModuleVariant(
  moduleKey: string,
  hasPermission: PermChecker,
): ModuleVariant {
  const mod = OVERLAPPING_MODULES[moduleKey]
  if (!mod) return 'none'
  if (hasPermission(mod.adminPerm)) return 'admin'
  if (hasPermission(mod.citizenPerm)) return 'citizen'
  return 'none'
}

/**
 * Citizen-only paths that have no admin equivalent.
 * Hidden for users who have any admin-level access.
 */
const CITIZEN_ONLY_PATHS = ['/profile', '/documents', '/benefits']

/**
 * Returns a Set of sidebar nav paths that should be HIDDEN because the
 * admin variant of the same module takes priority.
 *
 * Usage in AppLayout:
 *   const hidden = getHiddenNavPaths(hasPermission)
 *   navConfig.filter(item => !hidden.has(item.path))
 */
export function getHiddenNavPaths(hasPermission: PermChecker): Set<string> {
  const hidden = new Set<string>()

  // Detect if user has any broad admin access
  const isAdminUser =
    hasPermission('ADMIN.FAMILIES.VIEW') ||
    hasPermission('ADMIN.ACCESS.VIEW')   ||
    hasPermission('ADMIN.USERS.VIEW')    ||
    hasPermission('ADMIN.AUDITLOGS.VIEW')

  // Detect if user is ONLY a programme manager (no broad admin)
  // These users navigate exclusively via the Programme Admin section —
  // the /admin/programmes entry under Administration is redundant for them.
  const isProgrammeManagerOnly =
    (hasPermission('ADMIN.PROGRAMMES.VIEW') || hasPermission('PROGRAMME.PROGRAMMES.VIEW')) &&
    !isAdminUser

  // 1. Citizen vs admin dedup — admin permission wins, hide citizen variant
  for (const mod of Object.values(OVERLAPPING_MODULES)) {
    if (hasPermission(mod.adminPerm)) {
      hidden.add(mod.citizenPath)
    }
  }

  // 2. Citizen-only paths (no admin equivalent) — hide for admin users
  if (isAdminUser) {
    for (const path of CITIZEN_ONLY_PATHS) {
      hidden.add(path)
    }
  }

  // 3. Full-admin overrides — higher permission hides lower-tier variant
  for (const override of PRIVILEGED_OVERRIDES) {
    if (hasPermission(override.whenHasPerm)) {
      hidden.add(override.hidePath)
    }
  }

  // 4. Programme-manager-only: hide /admin/programmes from the Administration
  //    section since they manage programmes exclusively via Programme Admin.
  if (isProgrammeManagerOnly) {
    hidden.add('/admin/programmes')
  }

  return hidden
}

/**
 * Primary user mode — used for portal label and default redirect.
 *
 *   ADMIN      → any broad ADMIN.* permission (families, users, access, overview)
 *   PROGRAMME  → ADMIN.PROGRAMMES.VIEW or PROGRAMME.PROGRAMMES.VIEW without broader admin
 *   CITIZEN    → only citizen permissions
 */
export type UserMode = 'ADMIN' | 'PROGRAMME' | 'CITIZEN'

export function getUserMode(
  _hasPrefix: (prefix: string) => boolean,
  hasPermission: PermChecker,
): UserMode {
  // Check for broad admin access (not just programme-scoped admin)
  const hasAdminOverview = hasPermission('ADMIN.OVERVIEW.VIEW')
  const hasAdminFamilies = hasPermission('ADMIN.FAMILIES.VIEW')
  const hasAdminAccess = hasPermission('ADMIN.ACCESS.VIEW')
  const hasAdminUsers = hasPermission('ADMIN.USERS.VIEW')

  if (hasAdminOverview || hasAdminFamilies || hasAdminAccess || hasAdminUsers) {
    return 'ADMIN'
  }

  // Programme mode: has programme management gateway (ADMIN.PROGRAMMES.VIEW)
  // OR any granular PROGRAMME.* permission (ProgrammeManager without admin)
  if (
    hasPermission('ADMIN.PROGRAMMES.VIEW') ||
    hasPermission('PROGRAMME.PROGRAMMES.VIEW')
  ) {
    return 'PROGRAMME'
  }

  return 'CITIZEN'
}

/**
 * Check if a user should be granted access to a route that requires
 * ANY of the given permissions.  Used by PermissionGuard when the route
 * declares permission as `string[]` (OR semantics).
 */
export function hasAnyRoutePermission(
  permissions: string | string[],
  hasPermission: PermChecker,
): boolean {
  const perms = Array.isArray(permissions) ? permissions : [permissions]
  return perms.some(p => hasPermission(p))
}
