/**
 * PERMISSION TREE COMPONENT
 * 
 * Displays all available permissions grouped by module and submodule with checkboxes.
 * Permissions are organized hierarchically: Module -> Submodule -> Permission
 * e.g., ADMIN.FAMILY.VIEW -> Admin -> Family -> View
 */

import { useState, useMemo } from 'react'
import type { PermissionsResponse, Permission } from '@/services/rbacApi'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface PermissionTreeProps {
  /** All available permissions grouped by module */
  permissionsData: PermissionsResponse
  /** Currently selected permission keys */
  selectedPermissions: string[]
  /** Callback when selections change */
  onSelectionChange: (selected: string[]) => void
  /** Whether the tree is read-only */
  disabled?: boolean
}

interface SubmoduleGroup {
  name: string
  permissions: Permission[]
}

interface ModuleGroup {
  name: string
  submodules: Record<string, SubmoduleGroup>
  directPermissions: Permission[] // permissions without submodule
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/** Format name for display (e.g., "FAMILY" -> "Family") */
function formatModuleName(name: string): string {
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

/** Get icon for module */
function getModuleIcon(module: string): string {
  const icons: Record<string, string> = {
    ADMIN: 'admin_panel_settings',
    FAMILY: 'family_restroom',
    MEMBER: 'person',
    DOCUMENT: 'description',
    BENEFIT: 'payments',
    REGISTRATION: 'app_registration',
    CASE: 'work',
    REPORT: 'assessment',
    SYSTEM: 'settings',
    EMAIL: 'mail',
  }
  return icons[module.toUpperCase()] || 'folder'
}

/** Parse permission key to extract module, submodule, and action */
function parsePermissionKey(key: string): { module: string; submodule: string | null; action: string } {
  const parts = key.split('.')
  if (parts.length >= 3) {
    // e.g., ADMIN.FAMILY.VIEW -> module=ADMIN, submodule=FAMILY, action=VIEW
    return { module: parts[0], submodule: parts[1], action: parts.slice(2).join('.') }
  } else if (parts.length === 2) {
    // e.g., ADMIN.VIEW -> module=ADMIN, submodule=null, action=VIEW
    return { module: parts[0], submodule: null, action: parts[1] }
  }
  return { module: key, submodule: null, action: '' }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function PermissionTree({
  permissionsData,
  selectedPermissions,
  onSelectionChange,
  disabled = false,
}: PermissionTreeProps) {
  // Track which modules and submodules are expanded
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({})
  const [expandedSubmodules, setExpandedSubmodules] = useState<Record<string, boolean>>({})

  // Build hierarchical structure: Module -> Submodule -> Permissions
  const moduleGroups = useMemo(() => {
    const groups: Record<string, ModuleGroup> = {}
    
    for (const perm of permissionsData.permissions) {
      const { module, submodule } = parsePermissionKey(perm.permission_key)
      
      if (!groups[module]) {
        groups[module] = { name: module, submodules: {}, directPermissions: [] }
      }
      
      if (submodule) {
        if (!groups[module].submodules[submodule]) {
          groups[module].submodules[submodule] = { name: submodule, permissions: [] }
        }
        groups[module].submodules[submodule].permissions.push(perm)
      } else {
        groups[module].directPermissions.push(perm)
      }
    }
    
    return groups
  }, [permissionsData.permissions])

  // Get sorted module names
  const moduleNames = useMemo(() => {
    return Object.keys(moduleGroups).sort((a, b) => a.localeCompare(b))
  }, [moduleGroups])

  // Get all permission keys for a module (including all submodules)
  const getModulePermissionKeys = (module: string): string[] => {
    const group = moduleGroups[module]
    if (!group) return []
    const keys: string[] = group.directPermissions.map(p => p.permission_key)
    for (const submod of Object.values(group.submodules)) {
      keys.push(...submod.permissions.map(p => p.permission_key))
    }
    return keys
  }

  // Get all permission keys for a submodule
  const getSubmodulePermissionKeys = (module: string, submodule: string): string[] => {
    const submod = moduleGroups[module]?.submodules[submodule]
    return submod ? submod.permissions.map(p => p.permission_key) : []
  }

  // Calculate stats for a module
  const getModuleStats = (module: string) => {
    const keys = getModulePermissionKeys(module)
    const selected = keys.filter(k => selectedPermissions.includes(k)).length
    return { selected, total: keys.length }
  }

  // Calculate stats for a submodule
  const getSubmoduleStats = (module: string, submodule: string) => {
    const keys = getSubmodulePermissionKeys(module, submodule)
    const selected = keys.filter(k => selectedPermissions.includes(k)).length
    return { selected, total: keys.length }
  }

  // Toggle module expansion
  const toggleModule = (module: string) => {
    setExpandedModules(prev => ({ ...prev, [module]: !prev[module] }))
  }

  // Toggle submodule expansion
  const toggleSubmodule = (moduleSubmodule: string) => {
    setExpandedSubmodules(prev => ({ ...prev, [moduleSubmodule]: !prev[moduleSubmodule] }))
  }

  // Expand all
  const expandAll = () => {
    const modules: Record<string, boolean> = {}
    const submodules: Record<string, boolean> = {}
    for (const module of moduleNames) {
      modules[module] = true
      for (const submod of Object.keys(moduleGroups[module].submodules)) {
        submodules[`${module}.${submod}`] = true
      }
    }
    setExpandedModules(modules)
    setExpandedSubmodules(submodules)
  }

  // Collapse all
  const collapseAll = () => {
    setExpandedModules({})
    setExpandedSubmodules({})
  }

  // Toggle all permissions in a module
  const toggleModulePermissions = (module: string, checked: boolean) => {
    if (disabled) return
    const moduleKeys = getModulePermissionKeys(module)
    if (checked) {
      const newSelected = new Set([...selectedPermissions, ...moduleKeys])
      onSelectionChange(Array.from(newSelected))
    } else {
      onSelectionChange(selectedPermissions.filter(key => !moduleKeys.includes(key)))
    }
  }

  // Toggle all permissions in a submodule
  const toggleSubmodulePermissions = (module: string, submodule: string, checked: boolean) => {
    if (disabled) return
    const submodKeys = getSubmodulePermissionKeys(module, submodule)
    if (checked) {
      const newSelected = new Set([...selectedPermissions, ...submodKeys])
      onSelectionChange(Array.from(newSelected))
    } else {
      onSelectionChange(selectedPermissions.filter(key => !submodKeys.includes(key)))
    }
  }

  // Toggle a single permission
  const togglePermission = (permissionKey: string, checked: boolean) => {
    if (disabled) return
    if (checked) {
      onSelectionChange([...selectedPermissions, permissionKey])
    } else {
      onSelectionChange(selectedPermissions.filter(key => key !== permissionKey))
    }
  }

  // Selection state helpers
  const isFullySelected = (keys: string[]) => keys.length > 0 && keys.every(k => selectedPermissions.includes(k))
  const isPartiallySelected = (keys: string[]) => {
    const selected = keys.filter(k => selectedPermissions.includes(k))
    return selected.length > 0 && selected.length < keys.length
  }

  // Render a single permission item
  const renderPermission = (permission: Permission) => {
    const isSelected = selectedPermissions.includes(permission.permission_key)
    const { action } = parsePermissionKey(permission.permission_key)
    
    // When under a submodule, show just the action name (e.g., "create", "view", "edit")
    const displayName = formatModuleName(action)
    console.log(permission)
    
    return (
      <label
        key={permission.permission_key}
        className={`flex items-start gap-3 p-2 rounded-md cursor-pointer transition-colors ${
          isSelected 
            ? 'bg-blue-50 dark:bg-blue-900/20' 
            : 'hover:bg-gray-100 dark:hover:bg-gray-800'
        } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={e => togglePermission(permission.permission_key, e.target.checked)}
          disabled={disabled}
          className="mt-0.5 w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
        />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-white'}`}>
            {displayName}
            
          </p>
        </div>
      </label>
    )
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Permissions
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {selectedPermissions.length} of {permissionsData.permissions.length} selected
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={expandAll}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Expand All
          </button>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <button
            type="button"
            onClick={collapseAll}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Module List */}
      <div className="max-h-[400px] overflow-y-auto">
        {moduleNames.map(moduleName => {
          const group = moduleGroups[moduleName]
          const isModuleExpanded = expandedModules[moduleName] ?? false
          const moduleKeys = getModulePermissionKeys(moduleName)
          const moduleStats = getModuleStats(moduleName)
          const moduleFullySelected = isFullySelected(moduleKeys)
          const modulePartiallySelected = isPartiallySelected(moduleKeys)
          const submoduleNames = Object.keys(group.submodules).sort((a, b) => a.localeCompare(b))

          return (
            <div key={moduleName} className="border-b border-gray-100 dark:border-gray-800 last:border-b-0">
              {/* Module Header */}
              <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                {/* Expand/Collapse */}
                <button
                  type="button"
                  onClick={() => toggleModule(moduleName)}
                  className="flex items-center justify-center w-5 h-5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  <span 
                    className={`material-symbols-outlined text-sm text-gray-500 transition-transform ${isModuleExpanded ? 'rotate-90' : ''}`}
                  >
                    chevron_right
                  </span>
                </button>

                {/* Module Checkbox */}
                <label className="flex items-center gap-3 flex-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={moduleFullySelected}
                    ref={el => { if (el) el.indeterminate = modulePartiallySelected }}
                    onChange={e => toggleModulePermissions(moduleName, e.target.checked)}
                    disabled={disabled}
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                  />
                  <span className={`material-symbols-outlined text-lg ${moduleFullySelected ? 'text-blue-600' : 'text-gray-400'}`}>
                    {getModuleIcon(moduleName)}
                  </span>
                  <span className="font-medium text-sm text-gray-900 dark:text-white">
                    {formatModuleName(moduleName)}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                    {moduleStats.selected}/{moduleStats.total}
                  </span>
                </label>
              </div>

              {/* Expanded Module Content */}
              {isModuleExpanded && (
                <div className="bg-gray-50/50 dark:bg-gray-900/30">
                  {/* Direct Permissions (without submodule) */}
                  {group.directPermissions.length > 0 && (
                    <div className="pl-12 pr-4 py-2 space-y-1.5">
                      {group.directPermissions.map(perm => renderPermission(perm))}
                    </div>
                  )}

                  {/* Submodules */}
                  {submoduleNames.map(submoduleName => {
                    const submod = group.submodules[submoduleName]
                    const submodKey = `${moduleName}.${submoduleName}`
                    const isSubmodExpanded = expandedSubmodules[submodKey] ?? false
                    const submodKeys = getSubmodulePermissionKeys(moduleName, submoduleName)
                    const submodStats = getSubmoduleStats(moduleName, submoduleName)
                    const submodFullySelected = isFullySelected(submodKeys)
                    const submodPartiallySelected = isPartiallySelected(submodKeys)

                    return (
                      <div key={submodKey} className="border-t border-gray-100 dark:border-gray-800">
                        {/* Submodule Header */}
                        <div className="flex items-center gap-3 pl-8 pr-4 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-800/50">
                          <button
                            type="button"
                            onClick={() => toggleSubmodule(submodKey)}
                            className="flex items-center justify-center w-4 h-4 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                          >
                            <span 
                              className={`material-symbols-outlined text-xs text-gray-400 transition-transform ${isSubmodExpanded ? 'rotate-90' : ''}`}
                            >
                              chevron_right
                            </span>
                          </button>

                          <label className="flex items-center gap-2 flex-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={submodFullySelected}
                              ref={el => { if (el) el.indeterminate = submodPartiallySelected }}
                              onChange={e => toggleSubmodulePermissions(moduleName, submoduleName, e.target.checked)}
                              disabled={disabled}
                              className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                            />
                            <span className={`material-symbols-outlined text-base ${submodFullySelected ? 'text-blue-500' : 'text-gray-400'}`}>
                              folder
                            </span>
                            <span className="font-medium text-sm text-gray-700 dark:text-gray-300">
                              {formatModuleName(submoduleName)}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                              {submodStats.selected}/{submodStats.total}
                            </span>
                          </label>
                        </div>

                        {/* Submodule Permissions */}
                        {isSubmodExpanded && (
                          <div className="pl-16 pr-4 py-2 space-y-1.5">
                            {submod.permissions.map(perm => renderPermission(perm))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
