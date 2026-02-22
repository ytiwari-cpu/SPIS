/**
 * ADMIN ROLES PAGE — Tabular Role Management
 *
 * Lists roles with Active/Inactive tabs, matching the Users page UX exactly.
 * Features:
 * - Two tabs: Active Roles, Inactive Roles
 * - Create Role button
 * - View/Edit/Delete action buttons per row
 * - Soft delete for Active roles (moves to Inactive)
 * - Permanent delete for Inactive roles (removes from DB)
 * - Toaster notifications for all actions
 * - Permission-based access control (never role names)
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useToast } from '@/components/ui/Toast'
import {
  PageHeader,
  DataTable,
  Tabs,
  Badge,
  ConfirmDialog,
  ActionButton,
  type Column,
} from '@/components/admin/shared'
import * as rbacApi from '@/services/rbacApi'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary'

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function getRoleTypeVariant(roleType: 'system' | 'custom'): BadgeVariant {
  return roleType === 'system' ? 'info' : 'primary'
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function AdminRoles() {
  const navigate = useNavigate()
  const { hasPermission } = useAuthStore()
  const { toast } = useToast()

  // Permission-based checks (NEVER role names)
  const canViewRoles = hasPermission('ADMIN.ROLES.VIEW')
  const canCreateRoles = hasPermission('ADMIN.ROLES.CREATE')
  const canEditRoles = hasPermission('ADMIN.ROLES.EDIT')
  const canDeleteRoles = hasPermission('ADMIN.ROLES.DELETE')

  // ── State ─────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active')
  const [activeRoles, setActiveRoles] = useState<rbacApi.RoleRow[]>([])
  const [inactiveRoles, setInactiveRoles] = useState<rbacApi.RoleRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Delete Confirmations
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showPermanentDeleteConfirm, setShowPermanentDeleteConfirm] = useState(false)
  const [deletingRole, setDeletingRole] = useState<rbacApi.RoleRow | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Restore Confirmation
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false)
  const [restoringRole, setRestoringRole] = useState<rbacApi.RoleRow | null>(null)
  const [isRestoring, setIsRestoring] = useState(false)

  // ── Fetch Data ────────────────────────────────────────────────────────────
  const fetchActiveRoles = useCallback(async () => {
    try {
      const roles = await rbacApi.getRoleRows(true)
      setActiveRoles(roles)
    } catch (err) {
      console.error('Error fetching active roles:', err)
      setError(err instanceof Error ? err.message : 'Failed to load active roles')
    }
  }, [])

  const fetchInactiveRoles = useCallback(async () => {
    try {
      const roles = await rbacApi.getRoleRows(false)
      setInactiveRoles(roles)
    } catch (err) {
      console.error('Error fetching inactive roles:', err)
      // Don't set error for inactive tab - just show empty
    }
  }, [])

  const fetchRoles = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      await Promise.all([fetchActiveRoles(), fetchInactiveRoles()])
    } catch (err) {
      console.error('Error fetching roles:', err)
      setError(err instanceof Error ? err.message : 'Failed to load roles')
    } finally {
      setIsLoading(false)
    }
  }, [fetchActiveRoles, fetchInactiveRoles])

  useEffect(() => {
    if (canViewRoles) {
      fetchRoles()
    }
  }, [fetchRoles, canViewRoles])

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleView = (role: rbacApi.RoleRow) => {
    navigate(`/admin/roles/${encodeURIComponent(role.role_name)}/view`)
  }

  const handleEdit = (role: rbacApi.RoleRow) => {
    navigate(`/admin/roles/${encodeURIComponent(role.role_name)}/edit`)
  }

  const handleCreate = () => {
    navigate('/admin/roles/new')
  }

  const handleDelete = (role: rbacApi.RoleRow) => {
    setDeletingRole(role)
    setShowDeleteConfirm(true)
  }

  const handlePermanentDelete = (role: rbacApi.RoleRow) => {
    setDeletingRole(role)
    setShowPermanentDeleteConfirm(true)
  }

  const handleRestore = (role: rbacApi.RoleRow) => {
    setRestoringRole(role)
    setShowRestoreConfirm(true)
  }

  // ── Soft Delete (Active -> Inactive) ──────────────────────────────────────
  const confirmSoftDelete = async () => {
    if (!deletingRole) return
    
    const roleName = deletingRole.role_name
    
    setIsDeleting(true)
    
    try {
      await rbacApi.deleteRole(roleName)
      setShowDeleteConfirm(false)
      setDeletingRole(null)
      toast.success(`Role "${roleName}" deactivated`)
      // Refetch both lists to update UI
      await Promise.all([fetchActiveRoles(), fetchInactiveRoles()])
    } catch (err) {
      console.error('Soft delete error:', err)
      const message = err instanceof Error ? err.message : 'Failed to deactivate role'
      toast.error(message)
      // Refetch to restore correct state on error
      await fetchActiveRoles()
    } finally {
      setIsDeleting(false)
    }
  }

  // ── Permanent Delete (Remove from DB) ─────────────────────────────────────
  const confirmPermanentDelete = async () => {
    if (!deletingRole) return
    
    const roleName = deletingRole.role_name
    setIsDeleting(true)
    
    try {
      await rbacApi.permanentlyDeleteRole(roleName)
      // Close modal only on success
      setShowPermanentDeleteConfirm(false)
      setDeletingRole(null)
      toast.success(`Role "${roleName}" permanently deleted`)
      // Refetch inactive list
      await fetchInactiveRoles()
    } catch (err) {
      console.error('Permanent delete error:', err)
      const message = err instanceof Error ? err.message : 'Failed to permanently delete role'
      toast.error(message)
    } finally {
      setIsDeleting(false)
    }
  }

  // ── Restore Role ──────────────────────────────────────────────────────────
  const confirmRestore = async () => {
    if (!restoringRole) return
    
    const roleName = restoringRole.role_name
    setIsRestoring(true)
    
    try {
      await rbacApi.restoreRole(roleName)
      // Close modal only on success
      setShowRestoreConfirm(false)
      setRestoringRole(null)
      toast.success(`Role "${roleName}" restored`)
      // Refetch both lists to update UI
      await Promise.all([fetchActiveRoles(), fetchInactiveRoles()])
    } catch (err) {
      console.error('Restore error:', err)
      const message = err instanceof Error ? err.message : 'Failed to restore role'
      toast.error(message)
    } finally {
      setIsRestoring(false)
    }
  }

  // ── Table Columns for Active Tab ──────────────────────────────────────────
  const activeColumns: Column<rbacApi.RoleRow>[] = [
    {
      key: 'role_name',
      label: 'Role Name',
      render: (role) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{role.display_name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{role.role_name}</p>
        </div>
      ),
    },
    {
      key: 'description',
      label: 'Description',
      render: (role) => (
        <span className="text-sm text-gray-600 dark:text-gray-300">
          {role.description || '—'}
        </span>
      ),
    },
    {
      key: 'role_type',
      label: 'Type',
      render: (role) => (
        <Badge variant={getRoleTypeVariant(role.role_type)}>
          {role.role_type}
        </Badge>
      ),
    },
    {
      key: 'user_count',
      label: 'Users',
      render: (role) => (
        <span className="text-sm font-medium">{role.user_count ?? 0}</span>
      ),
    },
    {
      key: 'permission_count',
      label: 'Permissions',
      render: (role) => (
        <span className="text-sm font-medium">{role.permission_count ?? 0}</span>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (role) => (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {formatDate(role.created_at)}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '140px',
      render: (role) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); handleView(role); }}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
            title="View"
          >
            <span className="material-symbols-outlined text-lg">visibility</span>
          </button>
          {canEditRoles && (
            <button
              onClick={(e) => { e.stopPropagation(); handleEdit(role); }}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
              title="Edit"
            >
              <span className="material-symbols-outlined text-lg">edit</span>
            </button>
          )}
          {canDeleteRoles && role.role_type !== 'system' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                if ((role.user_count ?? 0) > 0) {
                  toast.error(`Cannot delete role "${role.display_name}": It is assigned to ${role.user_count} user(s). Remove all user assignments first.`)
                } else {
                  handleDelete(role)
                }
              }}
              className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
              title="Delete (Deactivate)"
            >
              <span className="material-symbols-outlined text-lg">delete</span>
            </button>
          )}
        </div>
      ),
    },
  ]

  // ── Table Columns for Inactive Tab ────────────────────────────────────────
  const inactiveColumns: Column<rbacApi.RoleRow>[] = [
    {
      key: 'role_name',
      label: 'Role Name',
      render: (role) => (
        <div>
          <p className="font-medium text-gray-500 dark:text-gray-400">{role.display_name}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">{role.role_name}</p>
        </div>
      ),
    },
    {
      key: 'description',
      label: 'Description',
      render: (role) => (
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {role.description || '—'}
        </span>
      ),
    },
    {
      key: 'role_type',
      label: 'Type',
      render: (role) => (
        <Badge variant="default">
          {role.role_type}
        </Badge>
      ),
    },
    {
      key: 'updated_at',
      label: 'Deactivated',
      render: (role) => (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {formatDate(role.updated_at)}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '120px',
      render: (role) => (
        <div className="flex items-center gap-1">
          {canDeleteRoles && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); handleRestore(role); }}
                className="p-1.5 rounded hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 dark:text-green-400"
                title="Restore"
              >
                <span className="material-symbols-outlined text-lg">restore</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handlePermanentDelete(role); }}
                className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
                title="Permanently Delete"
              >
                <span className="material-symbols-outlined text-lg">delete_forever</span>
              </button>
            </>
          )}
        </div>
      ),
    },
  ]

  // ── Access Denied ─────────────────────────────────────────────────────────
  if (!canViewRoles) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined text-6xl text-red-500">block</span>
          <h1 className="text-2xl font-bold mt-4">Access Denied</h1>
          <p className="text-gray-500 mt-2">You do not have permission to view roles.</p>
        </div>
      </div>
    )
  }

  // ── Tabs Config ───────────────────────────────────────────────────────────
  const tabs = [
    { id: 'active', label: 'Active Roles', count: activeRoles.length },
    { id: 'inactive', label: 'Archived Roles', count: inactiveRoles.length },
  ]

  const currentRoles = activeTab === 'active' ? activeRoles : inactiveRoles
  const currentColumns = activeTab === 'active' ? activeColumns : inactiveColumns

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="h-full flex flex-col p-6 min-w-0 overflow-hidden">
      <PageHeader
        title="Roles"
        subtitle={`${activeRoles.length} active role${activeRoles.length !== 1 ? 's' : ''}`}
        actions={
          canCreateRoles && (
            <ActionButton
              onClick={handleCreate}
              icon="add"
              label="Create Role"
              variant="primary"
            />
          )
        }
      />

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3 mt-6 flex-shrink-0">
          <span className="material-symbols-outlined text-red-500 mt-0.5">error</span>
          <div className="flex-1">
            <p className="text-red-700 dark:text-red-400 font-medium">{error}</p>
            <button
              onClick={fetchRoles}
              className="mt-2 text-sm text-red-600 dark:text-red-400 underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mt-6 flex-shrink-0">
        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={(tabId) => setActiveTab(tabId as 'active' | 'inactive')}
        />
      </div>

      {/* Data Table - scrollable container */}
      <div className="mt-6 flex-1 min-h-0 overflow-auto">
        <DataTable<rbacApi.RoleRow>
          data={currentRoles}
          columns={currentColumns}
          keyExtractor={(role) => role.role_id}
          loading={isLoading}
          emptyMessage={
            activeTab === 'active'
              ? 'No active roles found.'
              : 'No archived roles found.'
          }
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          CONFIRM DIALOGS
          ═══════════════════════════════════════════════════════════════════════ */}

      {/* Soft Delete Confirmation (Active Tab) */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false)
          setDeletingRole(null)
        }}
        onConfirm={confirmSoftDelete}
        title="Deactivate Role"
        message={`Are you sure you want to deactivate the role "${deletingRole?.display_name}"? Users with this role will lose access. The role can be restored later from the Inactive tab.`}
        confirmLabel={isDeleting ? 'Deactivating...' : 'Deactivate'}
        variant="warning"
      />

      {/* Permanent Delete Confirmation (Inactive Tab) */}
      <ConfirmDialog
        isOpen={showPermanentDeleteConfirm}
        onClose={() => {
          setShowPermanentDeleteConfirm(false)
          setDeletingRole(null)
        }}
        onConfirm={confirmPermanentDelete}
        title="Permanently Delete Role"
        message={`Are you sure you want to PERMANENTLY delete the role "${deletingRole?.display_name}"? This action cannot be undone. The role and all its permission mappings will be removed from the database.`}
        confirmLabel={isDeleting ? 'Deleting...' : 'Delete Permanently'}
        variant="danger"
      />

      {/* Restore Confirmation */}
      <ConfirmDialog
        isOpen={showRestoreConfirm}
        onClose={() => {
          setShowRestoreConfirm(false)
          setRestoringRole(null)
        }}
        onConfirm={confirmRestore}
        title="Restore Role"
        message={`Are you sure you want to restore the role "${restoringRole?.display_name}"? It will become active and usable again.`}
        confirmLabel={isRestoring ? 'Restoring...' : 'Restore'}
        variant="info"
      />
    </div>
  )
}
