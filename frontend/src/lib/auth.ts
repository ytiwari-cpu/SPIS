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

/**
 * Check if user has a specific permission
 */
export function hasPermission(permission: string): boolean {
  return getPermissions().includes(permission)
}

/**
 * Check if user has ANY of the specified permissions
 */
export function hasAnyPermission(permissions: string[]): boolean {
  if (!permissions || permissions.length === 0) return true
  const userPerms = getPermissions()
  return permissions.some(p => userPerms.includes(p))
}

/**
 * Check if user has ALL of the specified permissions
 */
export function hasAllPermissions(permissions: string[]): boolean {
  if (!permissions || permissions.length === 0) return true
  const userPerms = getPermissions()
  return permissions.every(p => userPerms.includes(p))
}

/**
 * Check if user has any permissions starting with a prefix
 * Useful for section-level checks like "any ADMIN.*"
 */
export function hasPermissionPrefix(prefix: string): boolean {
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
  
  return {
    permissions,
    hasPermission: (p: string) => permissions.includes(p),
    hasAny: (ps: string[]) => ps.length === 0 || ps.some(p => permissions.includes(p)),
    hasAll: (ps: string[]) => ps.length === 0 || ps.every(p => permissions.includes(p)),
    hasPrefix: (prefix: string) => permissions.some(p => p.startsWith(prefix)),
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
    FAMILIES: { VIEW: 'ADMIN.FAMILIES.VIEW', CREATE: 'ADMIN.FAMILIES.CREATE', EDIT: 'ADMIN.FAMILIES.EDIT', ARCHIVE: 'ADMIN.FAMILIES.ARCHIVE', EXPORT: 'ADMIN.FAMILIES.EXPORT' },
    PROGRAMMES: { VIEW: 'ADMIN.PROGRAMMES.VIEW', CREATE: 'ADMIN.PROGRAMMES.CREATE', EDIT: 'ADMIN.PROGRAMMES.EDIT', ARCHIVE: 'ADMIN.PROGRAMMES.ARCHIVE', EXPORT: 'ADMIN.PROGRAMMES.EXPORT' },
    GRIEVANCES: { VIEW: 'ADMIN.GRIEVANCES.VIEW', CREATE: 'ADMIN.GRIEVANCES.CREATE', EDIT: 'ADMIN.GRIEVANCES.EDIT', ARCHIVE: 'ADMIN.GRIEVANCES.ARCHIVE', ASSIGN: 'ADMIN.GRIEVANCES.ASSIGN' },
    APPEALS: { VIEW: 'ADMIN.APPEALS.VIEW', EDIT: 'ADMIN.APPEALS.EDIT', REVIEW: 'ADMIN.APPEALS.REVIEW', ARCHIVE: 'ADMIN.APPEALS.ARCHIVE' },
    USERS: { VIEW: 'ADMIN.USERS.VIEW', CREATE: 'ADMIN.USERS.CREATE', EDIT: 'ADMIN.USERS.EDIT', DELETE: 'ADMIN.USERS.DELETE' },
    CASEWORKERS: { VIEW: 'ADMIN.CASEWORKERS.VIEW', CREATE: 'ADMIN.CASEWORKERS.CREATE', EDIT: 'ADMIN.CASEWORKERS.EDIT', DELETE: 'ADMIN.CASEWORKERS.DELETE', ASSIGN: 'ADMIN.CASEWORKERS.ASSIGN' },
    ACCESS: { VIEW: 'ADMIN.ACCESS.VIEW', CREATE: 'ADMIN.ACCESS.CREATE', EDIT: 'ADMIN.ACCESS.EDIT', DELETE: 'ADMIN.ACCESS.DELETE', MANAGE_PERMISSIONS: 'ADMIN.ACCESS.MANAGE_PERMISSIONS' },
    ROLES: { VIEW: 'ADMIN.ROLES.VIEW', CREATE: 'ADMIN.ROLES.CREATE', EDIT: 'ADMIN.ROLES.EDIT', DELETE: 'ADMIN.ROLES.DELETE', MANAGE_PERMISSIONS: 'ADMIN.ROLES.MANAGE_PERMISSIONS' },
    ARCHIVED: { VIEW: 'ADMIN.ARCHIVED.VIEW', RESTORE: 'ADMIN.ARCHIVED.RESTORE', DELETE: 'ADMIN.ARCHIVED.DELETE' },
    AUDITLOGS: { VIEW: 'ADMIN.AUDITLOGS.VIEW', EXPORT: 'ADMIN.AUDITLOGS.EXPORT' },
  },
  // System permissions
  SYSTEM: {
    EXPORT: { ALL: 'SYSTEM.EXPORT.ALL' },
    REPORTS: { VIEW: 'SYSTEM.REPORTS.VIEW', CREATE: 'SYSTEM.REPORTS.CREATE' },
  },
} as const

// Section-level prefixes for sidebar filtering
export const SECTION_PREFIXES = {
  Citizen: 'CITIZEN.',
  Administration: 'ADMIN.',
  System: 'SYSTEM.',
} as const
