/**
 * ADMIN & ACCESS CONTROL PAGE
 *
 * Lists admin/superadmin users from the IAM service with role management
 * and per-role permission editing.
 *
 * NO MOCK DATA – everything comes from the IAM API.
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useToast } from '@/components/ui/Toast'
import {
  usersApi,
  rolesApi,
  type IamUser,
  type ListUsersParams,
  type RoleInfo,
} from '@/services/iamApi'
import {
  PageHeader,
  SearchInput,
  FilterSelect,
  Modal,
  Badge,
} from '@/components/admin/shared'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary'

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function getStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'active':
      return 'success'
    case 'pending':
      return 'warning'
    case 'locked':
    case 'disabled':
      return 'error'
    default:
      return 'default'
  }
}

function getRoleVariant(role: string): BadgeVariant {
  switch (role) {
    case 'SuperAdmin':
      return 'primary'
    case 'Admin':
      return 'info'
    case 'ProgrammeManager':
      return 'success'
    case 'CaseWorker':
      return 'warning'
    default:
      return 'default'
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function AdminAdmins() {
  // Pure permission-based checks from JWT - no role names!
  const { hasPermission } = useAuthStore()
  const { toast } = useToast()
  const canManageUsers = hasPermission('ADMIN.ACCESS.MANAGE_PERMISSIONS')

  // ── Data state ─────────────────────────────────────────────────────────
  const [users, setUsers] = useState<IamUser[]>([])
  const [availableRoles, setAvailableRoles] = useState<RoleInfo[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Filters ────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // ── Role modal ─────────────────────────────────────────────────────────
  const [selectedUser, setSelectedUser] = useState<IamUser | null>(null)
  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)

  // ── Fetch users ────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params: ListUsersParams = {
        page: pagination.page,
        limit: pagination.limit,
      }
      if (roleFilter) params.role = roleFilter
      if (statusFilter) params.status = statusFilter
      if (searchQuery.trim()) params.search = searchQuery.trim()

      const res = await usersApi.list(params)
      if (res.success) {
        setUsers(res.data)
        setPagination((prev) => ({
          ...prev,
          total: res.pagination.total,
          totalPages: res.pagination.totalPages,
        }))
      } else {
        setError('Failed to load administrators')
      }
    } catch (err) {
      console.error('Error fetching admin users:', err)
      setError(err instanceof Error ? err.message : 'Failed to load administrators')
    } finally {
      setIsLoading(false)
    }
  }, [pagination.page, pagination.limit, roleFilter, statusFilter, searchQuery])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // ── Fetch available roles ──────────────────────────────────────────────
  const fetchRoles = useCallback(async () => {
    try {
      const res = await rolesApi.list()
      if (res.success && res.data) {
        setAvailableRoles(res.data)
      }
    } catch (err) {
      console.error('Error fetching roles:', err)
      toast.error('Failed to load roles')
    }
  }, [toast])

  useEffect(() => {
    fetchRoles()
  }, [fetchRoles])

  // ── Actions ────────────────────────────────────────────────────────────

  const handleToggleStatus = async (user: IamUser) => {
    try {
      if (user.status === 'active') {
        await usersApi.disable(user.user_id)
        toast.success(`User ${user.email} disabled successfully`)
      } else {
        await usersApi.enable(user.user_id)
        toast.success(`User ${user.email} enabled successfully`)
      }
      fetchUsers()
    } catch (err) {
      console.error('Error toggling status:', err)
      const message = err instanceof Error ? err.message : 'Failed to update status'
      setError(message)
      toast.error(message)
    }
  }

  const handleEditRoles = (user: IamUser) => {
    setSelectedUser(user)
    setSelectedRole(user.roles[0]?.role_name || '')
    setRoleModalOpen(true)
  }

  const handleSaveRoles = async () => {
    if (!selectedUser || !selectedRole) return
    setIsSaving(true)
    try {
      await usersApi.updateRoles(selectedUser.user_id, [selectedRole])
      toast.success(`Role updated to ${selectedRole} for ${selectedUser.email}`)
      setRoleModalOpen(false)
      setSelectedUser(null)
      fetchUsers()
    } catch (err) {
      console.error('Error saving roles:', err)
      const message = err instanceof Error ? err.message : 'Failed to save roles'
      setError(message)
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  // ── Stats ──────────────────────────────────────────────────────────────
  const activeCount = users.filter((u) => u.status === 'active').length
  const disabledCount = users.filter(
    (u) => u.status === 'disabled' || u.status === 'locked',
  ).length

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }))
  }

  // ── Filter options ─────────────────────────────────────────────────────
  const roleOptions = availableRoles.map((role) => ({
    value: role.role_name,
    label: role.display_name,
  }))

  const statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'pending', label: 'Pending' },
    { value: 'locked', label: 'Locked' },
    { value: 'disabled', label: 'Disabled' },
  ]

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <PageHeader
          title="Admins & Access Control"
          subtitle={`${pagination.total} users in the system`}
        />

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
            <p className="text-sm text-green-600 dark:text-green-400">Active Admins</p>
            <p className="text-2xl font-bold text-green-700 dark:text-green-300">{activeCount}</p>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-600 dark:text-red-400">Disabled / Locked</p>
            <p className="text-2xl font-bold text-red-700 dark:text-red-300">{disabledCount}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-900 rounded-t-lg border border-b-0 border-gray-200 dark:border-gray-800 p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search by email..."
              />
            </div>
            <FilterSelect
              value={roleFilter}
              onChange={setRoleFilter}
              options={roleOptions}
              placeholder="All Admin Roles"
            />
            <FilterSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusOptions}
              placeholder="All Statuses"
            />
            <button
              onClick={() => fetchUsers()}
              disabled={isLoading}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <span
                className={`material-symbols-outlined ${isLoading ? 'animate-spin' : ''}`}
              >
                refresh
              </span>
              Refresh
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white dark:bg-gray-900 rounded-b-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center">
              <span className="material-symbols-outlined text-4xl text-gray-400 animate-spin">
                progress_activity
              </span>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Loading administrators...
              </p>
            </div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center">
              <span className="material-symbols-outlined text-4xl text-gray-400">
                admin_panel_settings
              </span>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                No administrators found
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Admin
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Roles
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {users.map((user) => (
                  <tr
                    key={user.user_id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="material-symbols-outlined text-primary text-sm">
                            person
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {user.email}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            ID: {user.user_id.substring(0, 8)}…
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={getStatusVariant(user.status)}>
                        {user.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map((r, idx) => (
                          <Badge key={idx} variant={getRoleVariant(r.role_name)}>
                            {r.role_name}
                          </Badge>
                        ))}
                        {user.roles.length === 0 && (
                          <span className="text-xs text-gray-400">No roles</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Edit roles */}
                        {canManageUsers && (
                          <button
                            onClick={() => handleEditRoles(user)}
                            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
                            title="Edit roles"
                          >
                            <span className="material-symbols-outlined text-lg">
                              badge
                            </span>
                          </button>
                        )}
                        {/* Toggle status */}
                        {canManageUsers && (
                          <button
                            onClick={() => handleToggleStatus(user)}
                            className={`p-1.5 rounded ${
                              user.status === 'active'
                                ? 'hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400'
                                : 'hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 dark:text-green-400'
                            }`}
                            title={user.status === 'active' ? 'Disable' : 'Enable'}
                          >
                            <span className="material-symbols-outlined text-lg">
                              {user.status === 'active' ? 'block' : 'check_circle'}
                            </span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} admins
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-700 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-700 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Role Edit Modal ─────────────────────────────────────────── */}
        <Modal
          isOpen={roleModalOpen}
          onClose={() => setRoleModalOpen(false)}
          title={`Assign Role — ${selectedUser?.email ?? ''}`}
          size="md"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Select a single role for this user.
            </p>
            {availableRoles.length === 0 ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                <span className="material-symbols-outlined animate-spin">progress_activity</span>
                <p className="mt-2">Loading roles…</p>
              </div>
            ) : (
              availableRoles.map((role) => (
                <label
                  key={role.role_id}
                  className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedRole === role.role_name
                      ? 'border-primary bg-primary/5 dark:bg-primary/10'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <input
                    type="radio"
                    name="user-role"
                    checked={selectedRole === role.role_name}
                    onChange={() => setSelectedRole(role.role_name)}
                    className="w-5 h-5 text-primary border-gray-300 focus:ring-primary"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white">{role.display_name}</p>
                    {role.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">{role.description}</p>
                    )}
                  </div>
                  {role.role_type === 'system' && (
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                      System
                    </span>
                  )}
                </label>
              ))
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
              <button
                onClick={() => setRoleModalOpen(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRoles}
                disabled={isSaving || !selectedRole}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving && (
                  <span className="material-symbols-outlined animate-spin text-sm">
                    progress_activity
                  </span>
                )}
                Save Role
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  )
}
