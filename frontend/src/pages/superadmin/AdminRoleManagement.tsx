/**
 * ADMIN ROLE MANAGEMENT PAGE
 * 
 * SuperAdmin page for managing roles and their permissions.
 * Features:
 * - Left panel: Role list with create/edit/delete
 * - Right panel: Permission tree editor with checkboxes
 * - Parent/child checkbox logic with indeterminate state
 * - VIEW dependency enforcement: checking CREATE/EDIT/DELETE auto-checks VIEW
 * - Search/filter within tree
 * - Keyboard accessible expand/collapse
 * - Unsaved changes warning
 */

import { useState, useEffect, useMemo, useCallback, type KeyboardEvent } from 'react'
import { useAuthStore } from '@/store/authStore'
import { featureCatalogue, type FeatureNode, getAllPermissionKeys, getFeaturePermissionKeys } from '@/config/featureCatalogue'
import { PageHeader, SearchInput, Modal, ConfirmDialog, ActionButton } from '@/components/admin/shared'
import * as rbacApi from '@/services/rbacApi'

/**
 * Maps backend role data to frontend role interface
 */
interface Role {
  id: string
  name: string
  description: string
  permissions: string[]
  isSystem: boolean
  createdAt: string
  updatedAt: string
  userCount?: number
  permissionCount?: number
}

function mapBackendRole(backendRole: rbacApi.Role): Role {
  return {
    id: backendRole.role_name,
    name: backendRole.role_name,
    description: backendRole.description,
    permissions: [], // Will be loaded separately
    isSystem: backendRole.is_system,
    createdAt: backendRole.created_at,
    updatedAt: backendRole.created_at,
    userCount: backendRole.user_count,
    permissionCount: backendRole.permission_count,
  }
}

type CheckboxState = 'checked' | 'unchecked' | 'indeterminate'

/**
 * VIEW DEPENDENCY ENFORCEMENT:
 * If user checks CREATE, EDIT, DELETE, or ARCHIVE, auto-check VIEW.
 * If user unchecks VIEW, auto-uncheck CREATE, EDIT, DELETE, ARCHIVE.
 * 
 * This enforces that VIEW is required for any write operation.
 */
function enforceViewDependency(
  permissions: Set<string>,
  changedKey: string,
  wasChecked: boolean
): Set<string> {
  const result = new Set(permissions)
  
  // Extract base module from key (e.g., "ADMIN.FAMILIES" from "ADMIN.FAMILIES.CREATE")
  const parts = changedKey.split('.')
  if (parts.length < 3) return result
  
  const baseModule = parts.slice(0, -1).join('.')
  const action = parts[parts.length - 1]
  const viewKey = `${baseModule}.VIEW`
  
  // Actions that require VIEW
  const writeActions = ['CREATE', 'EDIT', 'DELETE', 'ARCHIVE', 'RESTORE', 'EXPORT', 'MANAGE', 'ASSIGN', 'REVIEW', 'APPLY', 'MANAGE_PERMISSIONS']
  
  if (action === 'VIEW' && !wasChecked) {
    // User unchecked VIEW - remove all write actions for this module
    for (const writeAction of writeActions) {
      result.delete(`${baseModule}.${writeAction}`)
    }
  } else if (writeActions.includes(action) && wasChecked) {
    // User checked a write action - ensure VIEW is checked
    result.add(viewKey)
  }
  
  return result
}

export default function AdminRoleManagement() {
  const { hasPermission } = useAuthStore()
  // Pure permission-based check - no role names!
  const canManageRoles = hasPermission('ADMIN.ROLES.MANAGE_PERMISSIONS')

  // State
  const [roles, setRoles] = useState<Role[]>([])
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)
  const [editedPermissions, setEditedPermissions] = useState<Set<string>>(new Set())
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['citizen', 'admin', 'system']))
  
  // Loading states
  const [loading, setLoading] = useState(true)
  const [_loadingPermissions, setLoadingPermissions] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Error states
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false)
  const [pendingRoleSwitch, setPendingRoleSwitch] = useState<string | null>(null)
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleDescription, setNewRoleDescription] = useState('')

  const selectedRole = useMemo(() => 
    roles.find(r => r.id === selectedRoleId) || null,
    [roles, selectedRoleId]
  )

  // Load roles on mount
  useEffect(() => {
    const loadRoles = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const backendRoles = await rbacApi.getRoles()
        const mappedRoles = backendRoles.map(mapBackendRole)
        
        setRoles(mappedRoles)
        
        // Auto-select first role
        if (mappedRoles.length > 0 && !selectedRoleId) {
          setSelectedRoleId(mappedRoles[0].id)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load roles')
        console.error('Error loading roles:', err)
      } finally {
        setLoading(false)
      }
    }

    loadRoles()
  }, [selectedRoleId])

  // Load permissions when role changes
  useEffect(() => {
    const loadRolePermissions = async () => {
      if (!selectedRoleId) {
        setEditedPermissions(new Set())
        setHasUnsavedChanges(false)
        return
      }

      try {
        setLoadingPermissions(true)
        
        const permissions = await rbacApi.getRolePermissions(selectedRoleId)
        setEditedPermissions(new Set(permissions))
        setHasUnsavedChanges(false)
      } catch (err) {
        console.error('Error loading role permissions:', err)
        setEditedPermissions(new Set())
      } finally {
        setLoadingPermissions(false)
      }
    }

    loadRolePermissions()
  }, [selectedRoleId])

  // Filter features based on search
  const filterFeatures = useCallback((nodes: FeatureNode[], query: string): FeatureNode[] => {
    if (!query) return nodes
    
    return nodes.reduce<FeatureNode[]>((acc, node) => {
      const matchesQuery = node.label.toLowerCase().includes(query.toLowerCase()) ||
        node.permissions.some(p => p.label.toLowerCase().includes(query.toLowerCase()))
      
      const filteredChildren = node.children ? filterFeatures(node.children, query) : []
      
      if (matchesQuery || filteredChildren.length > 0) {
        acc.push({
          ...node,
          children: filteredChildren.length > 0 ? filteredChildren : node.children,
        })
      }
      
      return acc
    }, [])
  }, [])

  const filteredFeatures = useMemo(() => 
    filterFeatures(featureCatalogue.features, searchQuery),
    [filterFeatures, searchQuery]
  )

  // Get checkbox state for a feature node
  const getNodeCheckboxState = useCallback((node: FeatureNode): CheckboxState => {
    const nodePermKeys = getFeaturePermissionKeys(node.id)
    if (nodePermKeys.length === 0) return 'unchecked'
    
    const checkedCount = nodePermKeys.filter(k => editedPermissions.has(k)).length
    
    if (checkedCount === 0) return 'unchecked'
    if (checkedCount === nodePermKeys.length) return 'checked'
    return 'indeterminate'
  }, [editedPermissions])

  /**
   * Toggle a single permission with VIEW dependency enforcement.
   */
  const togglePermission = useCallback((permKey: string) => {
    setEditedPermissions(prev => {
      let next = new Set(prev)
      const wasChecked = !next.has(permKey)
      
      if (next.has(permKey)) {
        next.delete(permKey)
      } else {
        next.add(permKey)
      }
      
      // Enforce VIEW dependency
      next = enforceViewDependency(next, permKey, wasChecked)
      
      return next
    })
    setHasUnsavedChanges(true)
  }, [])

  /**
   * Toggle all permissions for a feature node.
   * When enabling, also ensures VIEW dependency is satisfied.
   */
  const toggleFeaturePermissions = useCallback((nodeId: string) => {
    const permKeys = getFeaturePermissionKeys(nodeId)
    const allChecked = permKeys.every(k => editedPermissions.has(k))
    
    setEditedPermissions(prev => {
      const next = new Set(prev)
      if (allChecked) {
        // Unchecking all - just remove them
        permKeys.forEach(k => next.delete(k))
      } else {
        // Checking all - add them (VIEW is already included in permKeys)
        permKeys.forEach(k => next.add(k))
      }
      return next
    })
    setHasUnsavedChanges(true)
  }, [editedPermissions])

  /**
   * Toggle expand/collapse for a tree node.
   * Supports keyboard accessibility (Enter/Space).
   */
  const toggleExpand = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
  }, [])

  /**
   * Handle keyboard events for expand button.
   */
  const handleExpandKeyDown = useCallback((e: KeyboardEvent, nodeId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggleExpand(nodeId)
    }
  }, [toggleExpand])

  // Select All actions
  const selectAllOfAction = useCallback((action: string) => {
    const allPermKeys = getAllPermissionKeys()
    const actionKeys = allPermKeys.filter(k => k.endsWith(`.${action}`))
    
    setEditedPermissions(prev => {
      const next = new Set(prev)
      actionKeys.forEach(k => next.add(k))
      return next
    })
    setHasUnsavedChanges(true)
  }, [])

  const clearAllOfAction = useCallback((action: string) => {
    const allPermKeys = getAllPermissionKeys()
    const actionKeys = allPermKeys.filter(k => k.endsWith(`.${action}`))
    
    setEditedPermissions(prev => {
      const next = new Set(prev)
      actionKeys.forEach(k => next.delete(k))
      return next
    })
    setHasUnsavedChanges(true)
  }, [])

  // Handle role switch with unsaved changes check
  const handleRoleSelect = useCallback((roleId: string) => {
    if (hasUnsavedChanges && roleId !== selectedRoleId) {
      setPendingRoleSwitch(roleId)
      setShowUnsavedWarning(true)
    } else {
      setSelectedRoleId(roleId)
    }
  }, [hasUnsavedChanges, selectedRoleId])

  const confirmRoleSwitch = useCallback(() => {
    if (pendingRoleSwitch) {
      setSelectedRoleId(pendingRoleSwitch)
      setPendingRoleSwitch(null)
    }
    setShowUnsavedWarning(false)
  }, [pendingRoleSwitch])

  // Save role permissions
  const handleSave = useCallback(async () => {
    if (!selectedRole) return
    
    setSaving(true)
    setSaveError(null)
    
    try {
      const permissionKeys = Array.from(editedPermissions)
      
      // Call real API to update role permissions
      await rbacApi.updateRolePermissions(selectedRole.name, permissionKeys)
      
      // Update local state to reflect the changes
      setRoles(prev => prev.map(r => 
        r.id === selectedRole.id 
          ? { ...r, permissions: permissionKeys, updatedAt: new Date().toISOString() }
          : r
      ))
      
      setHasUnsavedChanges(false)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save permissions'
      setSaveError(errorMessage)
      console.error('Error saving role permissions:', err)
    } finally {
      setSaving(false)
    }
  }, [selectedRole, editedPermissions])

  // Create new role - uses real API
  const handleCreateRole = useCallback(async () => {
    if (!newRoleName.trim()) return
    
    setSaving(true)
    setSaveError(null)
    
    try {
      const newRole = await rbacApi.createRole({
        role_name: newRoleName.trim(),
        display_name: newRoleName.trim(),
        description: newRoleDescription.trim() || undefined,
      })
      
      // Add to local state
      setRoles(prev => [...prev, {
        id: newRole.role_name,
        name: newRole.role_name,
        description: newRole.description || '',
        permissions: [],
        isSystem: newRole.role_type === 'system',
        createdAt: newRole.created_at,
        updatedAt: newRole.created_at,
        userCount: 0,
        permissionCount: 0,
      }])
      
      // Select the new role
      setSelectedRoleId(newRole.role_name)
      
      setShowCreateModal(false)
      setNewRoleName('')
      setNewRoleDescription('')
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create role'
      setSaveError(errorMessage)
      console.error('Error creating role:', err)
    } finally {
      setSaving(false)
    }
  }, [newRoleName, newRoleDescription])

  // Delete role - uses real API
  const handleDeleteRole = useCallback(async () => {
    if (!selectedRole || selectedRole.isSystem) return
    
    setSaving(true)
    setSaveError(null)
    
    try {
      await rbacApi.deleteRole(selectedRole.name)
      
      // Remove from local state
      setRoles(prev => prev.filter(r => r.id !== selectedRole.id))
      
      // Select next available role
      const remainingRoles = roles.filter(r => r.id !== selectedRole.id)
      setSelectedRoleId(remainingRoles[0]?.id || null)
      
      setShowDeleteConfirm(false)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete role'
      setSaveError(errorMessage)
      console.error('Error deleting role:', err)
    } finally {
      setSaving(false)
    }
  }, [selectedRole, roles])

  /**
   * Render individual permission checkbox with VIEW dependency indication.
   * Clicking the checkbox properly toggles only that permission.
   */
  const renderPermissionCheckbox = (permKey: string, label: string) => {
    const isChecked = editedPermissions.has(permKey)
    const isViewPermission = permKey.endsWith('.VIEW')
    
    return (
      <label 
        key={permKey}
        className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
        onClick={(e) => e.stopPropagation()} // Prevent event from bubbling to parent row
      >
        <input
          type="checkbox"
          checked={isChecked}
          onChange={(e) => {
            e.stopPropagation()
            togglePermission(permKey)
          }}
          className="size-4 rounded border-gray-300 text-primary focus:ring-primary"
        />
        <span className="text-sm">
          {label}
          {isViewPermission && (
            <span className="text-xs text-gray-400 ml-1" title="Required for other permissions">*</span>
          )}
        </span>
      </label>
    )
  }

  /**
   * Render feature tree node with proper expand/collapse and checkbox handling.
   * - Expand button only toggles expand state
   * - Checkbox only toggles permissions
   * - No event propagation issues
   * - Keyboard accessible
   */
  const renderFeatureNode = (node: FeatureNode, depth: number = 0) => {
    const isExpanded = expandedNodes.has(node.id)
    const hasChildren = node.children && node.children.length > 0
    const hasPermissions = node.permissions.length > 0
    const hasExpandableContent = hasChildren || hasPermissions
    const checkboxState = getNodeCheckboxState(node)
    
    return (
      <div key={node.id} className="select-none">
        <div 
          className={`flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 ${depth > 0 ? 'ml-6' : ''}`}
        >
          {/* Expand/Collapse Button */}
          {hasExpandableContent ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                toggleExpand(node.id)
              }}
              onKeyDown={(e) => handleExpandKeyDown(e, node.id)}
              className="size-6 flex items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/50"
              aria-expanded={isExpanded}
              aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${node.label}`}
            >
              <span className="material-symbols-outlined text-sm">
                {isExpanded ? 'expand_more' : 'chevron_right'}
              </span>
            </button>
          ) : (
            <div className="size-6" />
          )}
          
          {/* Node Checkbox - only show if node has permissions (directly or via children) */}
          {getFeaturePermissionKeys(node.id).length > 0 ? (
            <input
              type="checkbox"
              checked={checkboxState === 'checked'}
              ref={(el) => {
                if (el) el.indeterminate = checkboxState === 'indeterminate'
              }}
              onChange={(e) => {
                e.stopPropagation()
                toggleFeaturePermissions(node.id)
              }}
              onClick={(e) => e.stopPropagation()}
              className="size-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
              aria-label={`Select all permissions for ${node.label}`}
            />
          ) : (
            <div className="size-4" />
          )}
          
          {/* Icon */}
          {node.icon && (
            <span className="material-symbols-outlined text-gray-500 text-lg">{node.icon}</span>
          )}
          
          {/* Label - clicking label expands/collapses if has expandable content */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              if (hasExpandableContent) {
                toggleExpand(node.id)
              }
            }}
            className="font-medium text-gray-900 dark:text-white text-left flex-1 hover:text-primary focus:outline-none"
          >
            {node.label}
          </button>
          
          {/* Permission count - shows selected/total */}
          {hasPermissions && (
            <span className="text-xs text-gray-500">
              {node.permissions.filter(p => editedPermissions.has(p.key)).length}/{node.permissions.length}
            </span>
          )}
        </div>
        
        {/* Inline permissions for this node */}
        {isExpanded && hasPermissions && (
          <div className={`flex flex-wrap gap-2 py-2 ${depth > 0 ? 'ml-14' : 'ml-8'}`}>
            {node.permissions.map(perm => renderPermissionCheckbox(perm.key, perm.label))}
          </div>
        )}
        
        {/* Children nodes (recursive) */}
        {isExpanded && hasChildren && (
          <div>
            {node.children!.map(child => renderFeatureNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  if (!canManageRoles) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined text-6xl text-red-500">block</span>
          <h1 className="text-2xl font-bold mt-4">Access Denied</h1>
          <p className="text-gray-500 mt-2">You do not have permission to manage roles.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading roles...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <span className="material-symbols-outlined text-6xl text-red-500">error</span>
          <h1 className="text-2xl font-bold mt-4">Error Loading Roles</h1>
          <p className="text-gray-500 mt-2">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <PageHeader
          title="Role Management"
          subtitle="Manage roles and their permissions"
        />

        <div className="grid lg:grid-cols-[320px_1fr] gap-6">
          {/* Left Panel - Role List */}
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900 dark:text-white">Roles</h2>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                New Role
              </button>
            </div>
            
            <div className="space-y-1">
              {roles.map(role => (
                <button
                  key={role.id}
                  onClick={() => handleRoleSelect(role.id)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedRoleId === role.id
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg">
                      {role.isSystem ? 'lock' : 'badge'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{role.name}</p>
                      <p className="text-xs text-gray-500 truncate">{role.description}</p>
                    </div>
                    {role.isSystem && (
                      <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
                        System
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right Panel - Permission Tree */}
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
            {selectedRole ? (
              <>
                {/* Header */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                        {selectedRole.name}
                      </h2>
                      <p className="text-sm text-gray-500">{selectedRole.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!selectedRole.isSystem && (
                        <button
                          onClick={() => setShowDeleteConfirm(true)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                          title="Delete Role"
                        >
                          <span className="material-symbols-outlined">delete</span>
                        </button>
                      )}
                      <ActionButton
                        onClick={handleSave}
                        icon="save"
                        label={saving ? 'Saving...' : 'Save Changes'}
                        variant="primary"
                        disabled={!hasUnsavedChanges || saving}
                      />
                    </div>
                  </div>
                  
                  {/* Success/Error Messages */}
                  {saveSuccess && (
                    <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      Permissions saved successfully
                    </div>
                  )}
                  {saveError && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">error</span>
                      {saveError}
                    </div>
                  )}
                  
                  {/* Search & Quick Actions */}
                  <div className="flex flex-wrap gap-4 items-center">
                    <div className="flex-1 min-w-[200px]">
                      <SearchInput
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder="Search features..."
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => selectAllOfAction('VIEW')}
                        className="px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        Select All View
                      </button>
                      <button
                        onClick={() => clearAllOfAction('VIEW')}
                        className="px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        Clear All View
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Permission Tree */}
                <div className="p-4 max-h-[600px] overflow-y-auto">
                  {filteredFeatures.map(feature => renderFeatureNode(feature))}
                </div>
                
                {/* Footer with stats */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">
                      {editedPermissions.size} permissions selected
                    </span>
                    {hasUnsavedChanges && (
                      <span className="text-amber-600 flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">warning</span>
                        Unsaved changes
                      </span>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="p-8 text-center text-gray-500">
                Select a role to edit permissions
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Role Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Role"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Role Name
            </label>
            <input
              type="text"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="e.g., ProgrammeManager"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={newRoleDescription}
              onChange={(e) => setNewRoleDescription(e.target.value)}
              placeholder="Describe the role's purpose..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateRole}
              disabled={!newRoleName.trim()}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              Create Role
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteRole}
        title="Delete Role"
        message={`Are you sure you want to delete the role "${selectedRole?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Unsaved Changes Warning */}
      <ConfirmDialog
        isOpen={showUnsavedWarning}
        onClose={() => {
          setShowUnsavedWarning(false)
          setPendingRoleSwitch(null)
        }}
        onConfirm={confirmRoleSwitch}
        title="Unsaved Changes"
        message="You have unsaved changes. Are you sure you want to switch roles? Your changes will be lost."
        confirmLabel="Discard Changes"
        variant="warning"
      />
    </div>
  )
}
