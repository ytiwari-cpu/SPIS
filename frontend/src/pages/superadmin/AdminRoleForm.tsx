/**
 * ADMIN ROLE FORM PAGE
 * 
 * Unified page for Create, View, and Edit role operations.
 * Features:
 * - Create mode: All fields editable, Permission Tree enabled
 * - View mode: All fields read-only
 * - Edit mode: Only permissions editable (role_name/display_name fixed after creation)
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/admin/shared'
import PermissionTree from '@/components/rbac/PermissionTree'
import * as rbacApi from '@/services/rbacApi'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type FormMode = 'create' | 'view' | 'edit'

interface FormData {
  role_name: string
  display_name: string
  description: string
  permissions: string[]
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function AdminRoleForm() {
  const { roleName } = useParams<{ roleName?: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { hasPermission } = useAuthStore()
  const { toast } = useToast()

  // Determine mode from path
  const mode: FormMode = location.pathname.includes('/new') 
    ? 'create' 
    : location.pathname.includes('/edit') 
      ? 'edit' 
      : 'view'

  // Permissions checks
  const canCreate = hasPermission('ADMIN.ROLES.CREATE')
  const canEdit = hasPermission('ADMIN.ROLES.EDIT')
  const canView = hasPermission('ADMIN.ROLES.VIEW')

  // ── State ─────────────────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState<FormData>({
    role_name: '',
    display_name: '',
    description: '',
    permissions: [],
  })

  const [originalRole, setOriginalRole] = useState<rbacApi.RoleRow | null>(null)
  const [permissionsData, setPermissionsData] = useState<rbacApi.PermissionsResponse | null>(null)

  // ── Load Data ─────────────────────────────────────────────────────────────
  const loadPermissions = useCallback(async () => {
    try {
      const data = await rbacApi.getAllPermissions()
      setPermissionsData(data)
    } catch (err) {
      console.error('Error loading permissions:', err)
      setError('Failed to load permissions')
    }
  }, [])

  const loadRole = useCallback(async (name: string) => {
    try {
      const roleData = await rbacApi.getRoleByName(name)
      setOriginalRole(roleData as unknown as rbacApi.RoleRow)
      
      // Extract permission keys from the role data
      const permissionKeys = roleData.permissions?.map(p => 
        typeof p === 'string' ? p : p.permission_key
      ) || []

      setFormData({
        role_name: roleData.role_name,
        display_name: roleData.display_name,
        description: roleData.description || '',
        permissions: permissionKeys,
      })
    } catch (err) {
      console.error('Error loading role:', err)
      setError('Role not found')
    }
  }, [])

  useEffect(() => {
    const initPage = async () => {
      setIsLoading(true)
      setError(null)

      // Load permissions for all modes
      await loadPermissions()

      // Load role data for view/edit modes
      if (mode !== 'create' && roleName) {
        await loadRole(decodeURIComponent(roleName))
      }

      setIsLoading(false)
    }

    initPage()
  }, [mode, roleName, loadPermissions, loadRole])

  // ── Form Handlers ─────────────────────────────────────────────────────────
  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handlePermissionChange = (selected: string[]) => {
    setFormData(prev => ({ ...prev, permissions: selected }))
  }

  // Generate role_name from display_name
  const generateRoleName = (displayName: string): string => {
    return displayName
      .trim()
      .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special chars
      .replace(/\s+/g, '') // Remove spaces (PascalCase)
      .replace(/^./, c => c.toUpperCase()) // Capitalize first letter
  }

  const handleDisplayNameChange = (value: string) => {
    handleInputChange('display_name', value)
    // Auto-generate role_name in create mode
    if (mode === 'create') {
      handleInputChange('role_name', generateRoleName(value))
    }
  }

  // ── Validation ────────────────────────────────────────────────────────────
  const validateViewPermissions = (): { valid: boolean; errors: string[] } => {
    const errors: string[] = []
    const selectedPerms = formData.permissions

    // Group selected permissions by module.submodule
    const groupedPerms: Record<string, string[]> = {}
    
    for (const permKey of selectedPerms) {
      const parts = permKey.split('.')
      let groupKey = ''
      
      if (parts.length >= 3) {
        // e.g., ADMIN.FAMILY.VIEW -> group: ADMIN.FAMILY
        groupKey = `${parts[0]}.${parts[1]}`
      } else if (parts.length === 2) {
        // e.g., ADMIN.VIEW -> group: ADMIN
        groupKey = parts[0]
      } else {
        continue
      }
      
      if (!groupedPerms[groupKey]) {
        groupedPerms[groupKey] = []
      }
      groupedPerms[groupKey].push(permKey)
    }

    // Check each group: if it has non-VIEW permissions, it must have VIEW
    for (const [groupKey, perms] of Object.entries(groupedPerms)) {
      const hasNonView = perms.some(p => !p.endsWith('.VIEW'))
      const hasView = perms.some(p => p.endsWith('.VIEW'))
      
      if (hasNonView && !hasView) {
        // Find a readable name for the group
        const parts = groupKey.split('.')
        const groupName = parts.length === 2 
          ? `${parts[0]} → ${parts[1]}` 
          : parts[0]
        
        errors.push(groupName)
      }
    }

    return { valid: errors.length === 0, errors }
  }

  // ── Save/Submit ───────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (mode === 'create') {
      if (!formData.role_name.trim()) {
        toast.error('Role name is required')
        return
      }
      if (!formData.display_name.trim()) {
        toast.error('Display name is required')
        return
      }
    }

    // Validate VIEW permissions
    const validation = validateViewPermissions()
    if (!validation.valid) {
      const errorMessage = validation.errors.length === 1
        ? `"${validation.errors[0]}" requires VIEW permission when other permissions are selected`
        : `The following groups require VIEW permission when other permissions are selected: ${validation.errors.join(', ')}`
      
      toast.error(errorMessage)
      return
    }

    setIsSaving(true)
    try {
      if (mode === 'create') {
        // Create role first
        const newRole = await rbacApi.createRole({
          role_name: formData.role_name.trim(),
          display_name: formData.display_name.trim(),
          description: formData.description.trim() || undefined,
        })

        // Then assign permissions if any
        if (formData.permissions.length > 0) {
          await rbacApi.updateRolePermissions(newRole.role_name, formData.permissions)
        }

        toast.success(`Role "${formData.display_name}" created successfully`)
        navigate('/admin/roles')
      } else if (mode === 'edit' && roleName) {
        // Only update permissions in edit mode
        await rbacApi.updateRolePermissions(
          decodeURIComponent(roleName),
          formData.permissions
        )

        toast.success(`Permissions for "${formData.display_name}" updated successfully`)
        navigate('/admin/roles')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save role'
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    navigate('/admin/roles')
  }

  const handleSwitchToEdit = () => {
    if (roleName && canEdit) {
      navigate(`/admin/roles/${encodeURIComponent(roleName)}/edit`)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  // Permission checks
  if (mode === 'create' && !canCreate) {
    return (
      <div className="p-8 text-center">
        <span className="material-symbols-outlined text-4xl text-red-500 mb-4">lock</span>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Access Denied</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          You don't have permission to create roles.
        </p>
      </div>
    )
  }

  if ((mode === 'view' || mode === 'edit') && !canView) {
    return (
      <div className="p-8 text-center">
        <span className="material-symbols-outlined text-4xl text-red-500 mb-4">lock</span>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Access Denied</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          You don't have permission to view roles.
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
          <span className="material-symbols-outlined animate-spin">progress_activity</span>
          <span>Loading...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <span className="material-symbols-outlined text-4xl text-red-500 mb-4">error</span>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Error</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">{error}</p>
        <button
          onClick={() => navigate('/admin/roles')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Back to Roles
        </button>
      </div>
    )
  }

  const pageTitle = mode === 'create' 
    ? 'Create New Role' 
    : mode === 'edit' 
      ? `Edit Role: ${formData.display_name}` 
      : `View Role: ${formData.display_name}`

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={pageTitle}
        actions={
          <div className="flex items-center gap-3">
            {mode === 'view' && canEdit && originalRole?.role_type !== 'system' && (
              <button
                onClick={handleSwitchToEdit}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">edit</span>
                Edit Permissions
              </button>
            )}
          </div>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Role Details Card */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Role Details
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {mode === 'create' 
                ? 'Enter the basic information for this role.'
                : mode === 'edit'
                  ? 'Role details cannot be changed after creation. You can only modify permissions.'
                  : 'Basic information about this role.'
              }
            </p>
          </div>

          <div className="p-6 space-y-4">
            {/* Display Name */}
            <div>
              <label htmlFor="display_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Display Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="display_name"
                value={formData.display_name}
                onChange={e => handleDisplayNameChange(e.target.value)}
                disabled={mode !== 'create'}
                placeholder="e.g., Field Officer"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60 disabled:bg-gray-100 dark:disabled:bg-gray-700"
              />
            </div>

            {/* Role Name (System ID) */}
            <div>
              <label htmlFor="role_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                System Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="role_name"
                value={formData.role_name}
                onChange={e => handleInputChange('role_name', e.target.value)}
                disabled={mode !== 'create'}
                placeholder="e.g., FieldOfficer"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60 disabled:bg-gray-100 dark:disabled:bg-gray-700 font-mono text-sm"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {mode === 'create' 
                  ? 'Auto-generated from display name. Used internally as a unique identifier.' 
                  : 'This cannot be changed after creation.'
                }
              </p>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={e => handleInputChange('description', e.target.value)}
                disabled={mode !== 'create'}
                rows={3}
                placeholder="Describe the purpose and responsibilities of this role..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60 disabled:bg-gray-100 dark:disabled:bg-gray-700 resize-none"
              />
            </div>

            {/* Role Type Badge (for existing roles) */}
            {mode !== 'create' && originalRole && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Role Type
                </label>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                  originalRole.role_type === 'system'
                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                    : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                }`}>
                  {originalRole.role_type === 'system' ? '🔒 System Role' : '✏️ Custom Role'}
                </span>
                {originalRole.role_type === 'system' && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    System roles cannot be modified or deleted.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Permissions Card */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Permissions
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {mode === 'view' 
                ? 'Permissions assigned to this role.' 
                : 'Select the permissions this role should have.'
              }
            </p>
          </div>

          <div className="p-6">
            {permissionsData ? (
              <PermissionTree
                permissionsData={permissionsData}
                selectedPermissions={formData.permissions}
                onSelectionChange={handlePermissionChange}
                disabled={mode === 'view' || originalRole?.role_type === 'system'}
              />
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                Loading permissions...
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            {mode === 'view' ? 'Back' : 'Cancel'}
          </button>
          
          {mode !== 'view' && originalRole?.role_type !== 'system' && (
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                  Saving...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">save</span>
                  {mode === 'create' ? 'Create Role' : 'Save Changes'}
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
