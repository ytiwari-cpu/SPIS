/**
 * FEATURE CATALOGUE
 * 
 * Defines the complete feature tree for the SPIS application.
 * Used for Role Management permission assignments.
 * 
 * Permission Key Format: MODULE.SUBMODULE.ACTION
 * Actions: VIEW, CREATE, EDIT, DELETE, ARCHIVE, RESTORE, EXPORT, MANAGE
 */

export type PermissionAction = 'VIEW' | 'CREATE' | 'EDIT' | 'DELETE' | 'ARCHIVE' | 'RESTORE' | 'EXPORT' | 'MANAGE'

export interface FeaturePermission {
  key: string
  label: string
  description?: string
}

export interface FeatureNode {
  id: string
  label: string
  icon?: string
  description?: string
  permissions: FeaturePermission[]
  children?: FeatureNode[]
}

export interface FeatureCatalogue {
  features: FeatureNode[]
}

/**
 * Generate permission keys for standard CRUD actions
 */
export function crudPermissions(moduleKey: string, moduleName: string): FeaturePermission[] {
  return [
    { key: `${moduleKey}.VIEW`, label: 'View', description: `View ${moduleName}` },
    { key: `${moduleKey}.CREATE`, label: 'Create', description: `Create ${moduleName}` },
    { key: `${moduleKey}.EDIT`, label: 'Edit', description: `Edit ${moduleName}` },
    { key: `${moduleKey}.DELETE`, label: 'Delete', description: `Delete ${moduleName}` },
  ]
}

/**
 * The complete feature catalogue derived from the application structure
 */
export const featureCatalogue: FeatureCatalogue = {
  features: [
    // ════════════════════════════════════════════════════════════════
    // CITIZEN PORTAL FEATURES
    // ════════════════════════════════════════════════════════════════
    {
      id: 'citizen',
      label: 'Citizen Portal',
      icon: 'account_circle',
      description: 'Citizen-facing features',
      permissions: [],
      children: [
        {
          id: 'citizen.dashboard',
          label: 'Dashboard',
          icon: 'dashboard',
          permissions: [
            { key: 'CITIZEN.DASHBOARD.VIEW', label: 'View', description: 'View citizen dashboard' },
          ],
        },
        {
          id: 'citizen.family',
          label: 'Family',
          icon: 'family_restroom',
          permissions: [
            { key: 'CITIZEN.FAMILY.VIEW', label: 'View', description: 'View family information' },
            { key: 'CITIZEN.FAMILY.EDIT', label: 'Edit', description: 'Edit family information' },
          ],
        },
        {
          id: 'citizen.profile',
          label: 'Profile',
          icon: 'person',
          permissions: [
            { key: 'CITIZEN.PROFILE.VIEW', label: 'View', description: 'View personal profile' },
            { key: 'CITIZEN.PROFILE.EDIT', label: 'Edit', description: 'Edit personal profile' },
          ],
        },
        {
          id: 'citizen.documents',
          label: 'Documents',
          icon: 'description',
          permissions: [
            { key: 'CITIZEN.DOCUMENTS.VIEW', label: 'View', description: 'View documents' },
            { key: 'CITIZEN.DOCUMENTS.CREATE', label: 'Upload', description: 'Upload documents' },
            { key: 'CITIZEN.DOCUMENTS.DELETE', label: 'Delete', description: 'Delete documents' },
          ],
        },
        {
          id: 'citizen.programmes',
          label: 'Programmes',
          icon: 'verified_user',
          permissions: [
            { key: 'CITIZEN.PROGRAMMES.VIEW', label: 'View', description: 'View programmes' },
            { key: 'CITIZEN.PROGRAMMES.APPLY', label: 'Apply', description: 'Apply for programmes' },
          ],
        },
        {
          id: 'citizen.benefits',
          label: 'Benefits',
          icon: 'payments',
          permissions: [
            { key: 'CITIZEN.BENEFITS.VIEW', label: 'View', description: 'View benefits history' },
          ],
        },
        {
          id: 'citizen.grievances',
          label: 'Grievances',
          icon: 'error_outline',
          permissions: [
            { key: 'CITIZEN.GRIEVANCES.VIEW', label: 'View', description: 'View grievances' },
            { key: 'CITIZEN.GRIEVANCES.CREATE', label: 'Create', description: 'Submit grievances' },
          ],
        },
      ],
    },
    // ════════════════════════════════════════════════════════════════
    // ADMIN FEATURES
    // ════════════════════════════════════════════════════════════════
    {
      id: 'admin',
      label: 'Administration',
      icon: 'admin_panel_settings',
      description: 'Admin management features',
      permissions: [],
      children: [
        {
          id: 'admin.overview',
          label: 'Overview',
          icon: 'dashboard',
          permissions: [
            { key: 'ADMIN.OVERVIEW.VIEW', label: 'View', description: 'View admin dashboard' },
          ],
        },
        {
          id: 'admin.families',
          label: 'Families',
          icon: 'family_restroom',
          permissions: [
            { key: 'ADMIN.FAMILIES.VIEW', label: 'View', description: 'View all families' },
            { key: 'ADMIN.FAMILIES.CREATE', label: 'Create', description: 'Create families' },
            { key: 'ADMIN.FAMILIES.EDIT', label: 'Edit', description: 'Edit families' },
            { key: 'ADMIN.FAMILIES.ARCHIVE', label: 'Archive', description: 'Archive families' },
            { key: 'ADMIN.FAMILIES.EXPORT', label: 'Export', description: 'Export family data' },
          ],
        },
        {
          id: 'admin.programmes',
          label: 'Programmes',
          icon: 'verified_user',
          permissions: [
            { key: 'ADMIN.PROGRAMMES.VIEW', label: 'View', description: 'View programmes' },
            { key: 'ADMIN.PROGRAMMES.CREATE', label: 'Create', description: 'Create programmes' },
            { key: 'ADMIN.PROGRAMMES.EDIT', label: 'Edit', description: 'Edit programmes' },
            { key: 'ADMIN.PROGRAMMES.ARCHIVE', label: 'Archive', description: 'Archive programmes' },
            { key: 'ADMIN.PROGRAMMES.EXPORT', label: 'Export', description: 'Export programme data' },
          ],
        },
        {
          id: 'admin.grievances',
          label: 'Grievances',
          icon: 'error_outline',
          permissions: [
            { key: 'ADMIN.GRIEVANCES.VIEW', label: 'View', description: 'View grievances' },
            { key: 'ADMIN.GRIEVANCES.CREATE', label: 'Create', description: 'Create grievances' },
            { key: 'ADMIN.GRIEVANCES.EDIT', label: 'Edit', description: 'Edit grievances' },
            { key: 'ADMIN.GRIEVANCES.ARCHIVE', label: 'Archive', description: 'Archive grievances' },
            { key: 'ADMIN.GRIEVANCES.ASSIGN', label: 'Assign', description: 'Assign grievances' },
          ],
        },
        {
          id: 'admin.appeals',
          label: 'Appeals',
          icon: 'gavel',
          permissions: [
            { key: 'ADMIN.APPEALS.VIEW', label: 'View', description: 'View appeals' },
            { key: 'ADMIN.APPEALS.EDIT', label: 'Edit', description: 'Edit appeals' },
            { key: 'ADMIN.APPEALS.REVIEW', label: 'Review', description: 'Review and decide appeals' },
            { key: 'ADMIN.APPEALS.ARCHIVE', label: 'Archive', description: 'Archive appeals' },
          ],
        },
        {
          id: 'admin.caseworkers',
          label: 'Case Workers',
          icon: 'support_agent',
          permissions: [
            { key: 'ADMIN.CASEWORKERS.VIEW', label: 'View', description: 'View case workers' },
            { key: 'ADMIN.CASEWORKERS.CREATE', label: 'Create', description: 'Create case workers' },
            { key: 'ADMIN.CASEWORKERS.EDIT', label: 'Edit', description: 'Edit case workers' },
            { key: 'ADMIN.CASEWORKERS.DELETE', label: 'Delete', description: 'Delete case workers' },
            { key: 'ADMIN.CASEWORKERS.ASSIGN', label: 'Assign Cases', description: 'Assign cases to workers' },
          ],
        },
        {
          id: 'admin.users',
          label: 'Users',
          icon: 'group',
          permissions: [
            { key: 'ADMIN.USERS.VIEW', label: 'View', description: 'View all users' },
            { key: 'ADMIN.USERS.CREATE', label: 'Create', description: 'Create users' },
            { key: 'ADMIN.USERS.EDIT', label: 'Edit', description: 'Edit users' },
            { key: 'ADMIN.USERS.DELETE', label: 'Delete', description: 'Delete users' },
          ],
        },
        {
          id: 'admin.access',
          label: 'Admins & Access',
          icon: 'admin_panel_settings',
          permissions: [
            { key: 'ADMIN.ACCESS.VIEW', label: 'View', description: 'View admin users' },
            { key: 'ADMIN.ACCESS.CREATE', label: 'Create', description: 'Create admin users' },
            { key: 'ADMIN.ACCESS.EDIT', label: 'Edit', description: 'Edit admin users' },
            { key: 'ADMIN.ACCESS.DELETE', label: 'Delete', description: 'Delete admin users' },
            { key: 'ADMIN.ACCESS.MANAGE_PERMISSIONS', label: 'Manage Permissions', description: 'Manage user permissions' },
          ],
        },
        {
          id: 'admin.roles',
          label: 'Role Management',
          icon: 'badge',
          permissions: [
            { key: 'ADMIN.ROLES.VIEW', label: 'View', description: 'View roles' },
            { key: 'ADMIN.ROLES.CREATE', label: 'Create', description: 'Create roles' },
            { key: 'ADMIN.ROLES.EDIT', label: 'Edit', description: 'Edit roles' },
            { key: 'ADMIN.ROLES.DELETE', label: 'Delete', description: 'Delete roles' },
            { key: 'ADMIN.ROLES.MANAGE_PERMISSIONS', label: 'Manage Permissions', description: 'Assign permissions to roles' },
          ],
        },
        {
          id: 'admin.archived',
          label: 'Archived',
          icon: 'archive',
          permissions: [
            { key: 'ADMIN.ARCHIVED.VIEW', label: 'View', description: 'View archived records' },
            { key: 'ADMIN.ARCHIVED.RESTORE', label: 'Restore', description: 'Restore archived records' },
            { key: 'ADMIN.ARCHIVED.DELETE', label: 'Delete Permanently', description: 'Permanently delete records' },
          ],
        },
        {
          id: 'admin.auditlogs',
          label: 'Audit Logs',
          icon: 'history',
          permissions: [
            { key: 'ADMIN.AUDITLOGS.VIEW', label: 'View', description: 'View audit logs' },
            { key: 'ADMIN.AUDITLOGS.EXPORT', label: 'Export', description: 'Export audit logs' },
          ],
        },
      ],
    },
    // ════════════════════════════════════════════════════════════════
    // SYSTEM FEATURES
    // ════════════════════════════════════════════════════════════════
    {
      id: 'system',
      label: 'System',
      icon: 'settings',
      description: 'System-wide settings and configurations',
      permissions: [],
      children: [
        {
          id: 'system.export',
          label: 'Data Export',
          icon: 'download',
          permissions: [
            { key: 'SYSTEM.EXPORT.ALL', label: 'Export All Data', description: 'Export all system data' },
          ],
        },
        {
          id: 'system.reports',
          label: 'Reports',
          icon: 'analytics',
          permissions: [
            { key: 'SYSTEM.REPORTS.VIEW', label: 'View', description: 'View reports' },
            { key: 'SYSTEM.REPORTS.CREATE', label: 'Create', description: 'Create reports' },
          ],
        },
      ],
    },
  ],
}

/**
 * Flatten the feature tree to get all permission keys
 */
export function getAllPermissionKeys(nodes: FeatureNode[] = featureCatalogue.features): string[] {
  const keys: string[] = []
  
  for (const node of nodes) {
    for (const perm of node.permissions) {
      keys.push(perm.key)
    }
    if (node.children) {
      keys.push(...getAllPermissionKeys(node.children))
    }
  }
  
  return keys
}

/**
 * Get all permissions as a flat array with full info
 */
export function getAllPermissions(nodes: FeatureNode[] = featureCatalogue.features): FeaturePermission[] {
  const permissions: FeaturePermission[] = []
  
  for (const node of nodes) {
    permissions.push(...node.permissions)
    if (node.children) {
      permissions.push(...getAllPermissions(node.children))
    }
  }
  
  return permissions
}

/**
 * Find a feature node by ID
 */
export function findFeatureById(id: string, nodes: FeatureNode[] = featureCatalogue.features): FeatureNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    if (node.children) {
      const found = findFeatureById(id, node.children)
      if (found) return found
    }
  }
  return null
}

/**
 * Get all permission keys for a feature and its children
 */
export function getFeaturePermissionKeys(featureId: string): string[] {
  const node = findFeatureById(featureId)
  if (!node) return []
  
  const keys: string[] = node.permissions.map(p => p.key)
  if (node.children) {
    for (const child of node.children) {
      keys.push(...getFeaturePermissionKeys(child.id))
    }
  }
  
  return keys
}

export default featureCatalogue
