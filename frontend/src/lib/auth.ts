/**
 * AUTHORIZATION UTILITIES
 * 
 * Single source of truth for all permission checks.
 * 
 * CRITICAL: ALL access control MUST use these functions.
 * NEVER check role names directly - roles are just permission containers.
 * 
 * Permissions come from the JWT token (signed, tamper-proof).
 * Client-side checks are for UX only - backend enforces real authorization.
 */

import { useAuthStore } from '@/store/authStore'

// ═══════════════════════════════════════════════════════════════════════════
// CORE PERMISSION CHECK FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get current user's permissions from JWT token (via store)
 * Returns empty array if not authenticated or no permissions
 */
export function getPermissions(): string[] {
  const session = useAuthStore.getState().session
  if (!session?.permissions || !Array.isArray(session.permissions)) {
    return []
  }
  return session.permissions
}

/** Returns true if the current user is a SuperAdmin (bypasses all permission checks) */
function isSuperAdmin(): boolean {
  const roles = useAuthStore.getState().session?.roles
  return Array.isArray(roles) && roles.includes('SuperAdmin')
}

/**
 * Check if user has a specific permission
 */
export function hasPermission(permission: string): boolean {
  if (isSuperAdmin()) return true
  return getPermissions().includes(permission)
}

/**
 * Check if user has ANY of the specified permissions
 */
export function hasAnyPermission(permissions: string[]): boolean {
  if (!permissions || permissions.length === 0) return true
  if (isSuperAdmin()) return true
  const userPerms = getPermissions()
  return permissions.some(p => userPerms.includes(p))
}

/**
 * Check if user has ALL of the specified permissions
 */
export function hasAllPermissions(permissions: string[]): boolean {
  if (!permissions || permissions.length === 0) return true
  if (isSuperAdmin()) return true
  const userPerms = getPermissions()
  return permissions.every(p => userPerms.includes(p))
}

/**
 * Check if user has any permissions starting with a prefix
 * Useful for section-level checks like "any ADMIN.*"
 */
export function hasPermissionPrefix(prefix: string): boolean {
  if (isSuperAdmin()) return true
  return getPermissions().some(p => p.startsWith(prefix))
}

// ═══════════════════════════════════════════════════════════════════════════
// REACT HOOKS FOR COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * React hook for permission checks (reactive)
 */
export function usePermissions() {
  const session = useAuthStore(state => state.session)
  const permissions = session?.permissions || []
  const superAdmin = Array.isArray(session?.roles) && session.roles.includes('SuperAdmin')

  return {
    permissions,
    hasPermission: (p: string) => superAdmin || permissions.includes(p),
    hasAny: (ps: string[]) => ps.length === 0 || superAdmin || ps.some(p => permissions.includes(p)),
    hasAll: (ps: string[]) => ps.length === 0 || superAdmin || ps.every(p => permissions.includes(p)),
    hasPrefix: (prefix: string) => superAdmin || permissions.some(p => p.startsWith(prefix)),
    // No SuperAdmin bypass — checks the actual JWT array.
    // Use for permissions that must be explicitly granted (e.g. SYSTEM.EXPORT).
    hasStrict: (p: string) => permissions.includes(p),
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PERMISSION CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

export const PERMISSIONS = {
  // Citizen permissions
  CITIZEN: {
    DASHBOARD: { VIEW: 'CITIZEN.DASHBOARD.VIEW' },
    FAMILY: { VIEW: 'CITIZEN.FAMILY.VIEW', EDIT: 'CITIZEN.FAMILY.EDIT' },
    PROFILE: { VIEW: 'CITIZEN.PROFILE.VIEW', EDIT: 'CITIZEN.PROFILE.EDIT' },
    DOCUMENTS: { VIEW: 'CITIZEN.DOCUMENTS.VIEW', CREATE: 'CITIZEN.DOCUMENTS.CREATE', DELETE: 'CITIZEN.DOCUMENTS.DELETE' },
    PROGRAMMES: { VIEW: 'CITIZEN.PROGRAMMES.VIEW', APPLY: 'CITIZEN.PROGRAMMES.APPLY' },
    BENEFITS: { VIEW: 'CITIZEN.BENEFITS.VIEW' },
    GRIEVANCES: { VIEW: 'CITIZEN.GRIEVANCES.VIEW', CREATE: 'CITIZEN.GRIEVANCES.CREATE' },
  },
  // Admin permissions
  ADMIN: {
    OVERVIEW: { VIEW: 'ADMIN.OVERVIEW.VIEW' },
    FAMILIES: { VIEW: 'ADMIN.FAMILIES.VIEW', CREATE: 'ADMIN.FAMILIES.CREATE', EDIT: 'ADMIN.FAMILIES.EDIT', ARCHIVE: 'ADMIN.FAMILIES.ARCHIVE' },
    PROGRAMMES: { VIEW: 'ADMIN.PROGRAMMES.VIEW', CREATE: 'ADMIN.PROGRAMMES.CREATE', EDIT: 'ADMIN.PROGRAMMES.EDIT', ARCHIVE: 'ADMIN.PROGRAMMES.ARCHIVE' },
    GRIEVANCES: { VIEW: 'ADMIN.GRIEVANCES.VIEW', CREATE: 'ADMIN.GRIEVANCES.CREATE', EDIT: 'ADMIN.GRIEVANCES.EDIT', ARCHIVE: 'ADMIN.GRIEVANCES.ARCHIVE', ASSIGN: 'ADMIN.GRIEVANCES.ASSIGN' },
    APPEALS: { VIEW: 'ADMIN.APPEALS.VIEW', EDIT: 'ADMIN.APPEALS.EDIT', REVIEW: 'ADMIN.APPEALS.REVIEW', ARCHIVE: 'ADMIN.APPEALS.ARCHIVE' },
    USERS: { VIEW: 'ADMIN.USERS.VIEW', CREATE: 'ADMIN.USERS.CREATE', EDIT: 'ADMIN.USERS.EDIT', DELETE: 'ADMIN.USERS.DELETE' },
    CASEWORKERS: { VIEW: 'ADMIN.CASEWORKERS.VIEW', CREATE: 'ADMIN.CASEWORKERS.CREATE', EDIT: 'ADMIN.CASEWORKERS.EDIT', DELETE: 'ADMIN.CASEWORKERS.DELETE', ASSIGN: 'ADMIN.CASEWORKERS.ASSIGN' },
    ACCESS: { VIEW: 'ADMIN.ACCESS.VIEW', CREATE: 'ADMIN.ACCESS.CREATE', EDIT: 'ADMIN.ACCESS.EDIT', DELETE: 'ADMIN.ACCESS.DELETE', MANAGE_PERMISSIONS: 'ADMIN.ACCESS.MANAGE_PERMISSIONS' },
    ROLES: { VIEW: 'ADMIN.ROLES.VIEW', CREATE: 'ADMIN.ROLES.CREATE', EDIT: 'ADMIN.ROLES.EDIT', DELETE: 'ADMIN.ROLES.DELETE', MANAGE_PERMISSIONS: 'ADMIN.ROLES.MANAGE_PERMISSIONS' },
    AUDITLOGS: { VIEW: 'ADMIN.AUDITLOGS.VIEW' },
  },
  // Programme Management permissions (Programme Admin section)
  PROGRAMME: {
    PROGRAMMES:    { VIEW: 'PROGRAMME.PROGRAMMES.VIEW', CREATE: 'PROGRAMME.PROGRAMMES.CREATE', EDIT: 'PROGRAMME.PROGRAMMES.EDIT', DELETE: 'PROGRAMME.PROGRAMMES.DELETE', PUBLISH: 'PROGRAMME.PROGRAMMES.PUBLISH' },
    BENEFICIARIES: { VIEW: 'PROGRAMME.BENEFICIARIES.VIEW', ENROLL: 'PROGRAMME.BENEFICIARIES.ENROLL', MANAGE: 'PROGRAMME.BENEFICIARIES.MANAGE' },
    RULES:         { VIEW: 'PROGRAMME.RULES.VIEW', MANAGE: 'PROGRAMME.RULES.MANAGE' },
    REPORTS:       { VIEW: 'PROGRAMME.REPORTS.VIEW' },
    MANAGERS:      { VIEW: 'PROGRAMME.MANAGERS.VIEW', MANAGE: 'PROGRAMME.MANAGERS.MANAGE' },
    ENGINE:        { RUN: 'PROGRAMME.ENGINE.RUN' },
    AUDITLOGS:     { VIEW: 'PROGRAMME.AUDITLOGS.VIEW' },
  },
  // System-level cross-cutting permissions
  SYSTEM: {
    EXPORT: 'SYSTEM.EXPORT',
  },
} as const

// Section-level prefixes for sidebar filtering
export const SECTION_PREFIXES = {
  Citizen: 'CITIZEN.',
  Administration: 'ADMIN.',
  Programme: 'PROGRAMME.',
} as const
