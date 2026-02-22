/**
 * PERMISSION UTILITIES
 * 
 * Utility functions for managing permissions in the permission tree.
 * 
 * VIEW DEPENDENCY ENFORCEMENT:
 * If user checks CREATE, EDIT, DELETE, or ARCHIVE, auto-check VIEW.
 * If user unchecks VIEW, auto-uncheck CREATE, EDIT, DELETE, ARCHIVE.
 * 
 * This enforces that VIEW is required for any write operation.
 */

// Actions that require VIEW permission to be enabled
export const WRITE_ACTIONS = [
  'CREATE',
  'EDIT',
  'DELETE',
  'ARCHIVE',
  'RESTORE',
  'EXPORT',
  'MANAGE',
  'ASSIGN',
  'REVIEW',
  'APPLY',
  'MANAGE_PERMISSIONS',
] as const

export type WriteAction = typeof WRITE_ACTIONS[number]

/**
 * Parse a permission key into its components.
 * Format: MODULE.SUBMODULE.ACTION (e.g., "ADMIN.FAMILIES.CREATE")
 */
export function parsePermissionKey(permKey: string): {
  baseModule: string
  action: string
  viewKey: string
} | null {
  const parts = permKey.split('.')
  if (parts.length < 3) return null
  
  const action = parts[parts.length - 1]
  const baseModule = parts.slice(0, -1).join('.')
  const viewKey = `${baseModule}.VIEW`
  
  return { baseModule, action, viewKey }
}

/**
 * Enforce VIEW dependency when toggling a permission.
 * 
 * Rules:
 * 1. When checking a write action (CREATE, EDIT, DELETE, etc.), auto-check VIEW
 * 2. When unchecking VIEW, auto-uncheck all write actions for that module
 * 
 * @param permissions - Current set of permissions
 * @param changedKey - The permission key that was changed
 * @param wasChecked - True if the permission was checked (is now enabled)
 * @returns New set of permissions with VIEW dependency enforced
 */
export function enforceViewDependency(
  permissions: Set<string>,
  changedKey: string,
  wasChecked: boolean
): Set<string> {
  const result = new Set(permissions)
  
  const parsed = parsePermissionKey(changedKey)
  if (!parsed) return result
  
  const { baseModule, action, viewKey } = parsed
  
  if (action === 'VIEW' && !wasChecked) {
    // User unchecked VIEW - remove all write actions for this module
    for (const writeAction of WRITE_ACTIONS) {
      result.delete(`${baseModule}.${writeAction}`)
    }
  } else if (WRITE_ACTIONS.includes(action as WriteAction) && wasChecked) {
    // User checked a write action - ensure VIEW is checked
    result.add(viewKey)
  }
  
  return result
}

/**
 * Get all dependent permissions that will be affected when toggling a permission.
 * This is useful for showing a confirmation dialog or tooltip.
 * 
 * @param permKey - The permission key being toggled
 * @param willBeChecked - Whether the permission will be checked after toggle
 * @returns Array of permission keys that will be auto-toggled
 */
export function getAffectedPermissions(
  permKey: string,
  willBeChecked: boolean
): string[] {
  const parsed = parsePermissionKey(permKey)
  if (!parsed) return []
  
  const { baseModule, action, viewKey } = parsed
  
  if (action === 'VIEW' && !willBeChecked) {
    // Unchecking VIEW will remove all write actions
    return WRITE_ACTIONS.map(wa => `${baseModule}.${wa}`)
  } else if (WRITE_ACTIONS.includes(action as WriteAction) && willBeChecked) {
    // Checking a write action will add VIEW
    return [viewKey]
  }
  
  return []
}

/**
 * Validate that permissions set is consistent (all write actions have their VIEW).
 * Returns array of invalid permission keys (write actions without VIEW).
 */
export function validatePermissionSet(permissions: Set<string>): string[] {
  const invalid: string[] = []
  
  for (const perm of permissions) {
    const parsed = parsePermissionKey(perm)
    if (!parsed) continue
    
    const { action, viewKey } = parsed
    
    if (WRITE_ACTIONS.includes(action as WriteAction) && !permissions.has(viewKey)) {
      invalid.push(perm)
    }
  }
  
  return invalid
}
