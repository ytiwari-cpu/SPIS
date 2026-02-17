/**
 * SUPER ADMIN DASHBOARD
 * 
 * Allows SuperAdmin to configure role-based permissions
 * - View all roles and their permissions
 * - Grant/revoke permissions for each role
 * - Focus: Control citizen access to features like Grievances
 */

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useNavigate } from 'react-router-dom'
import { authFetch } from '@/services/authFetch'

const IAM_SERVICE_URL = import.meta.env.VITE_IAM_SERVICE_URL || 'http://localhost:3003'

interface Permission {
  permission_key: string
  permission_name: string
  description: string | null
  module: string
}

interface RoleConfig {
  role: string
  label: string
  description: string
}

const AVAILABLE_ROLES: RoleConfig[] = [
  { role: 'Citizen', label: 'Citizen', description: 'Regular citizens accessing the portal' },
  { role: 'CaseWorker', label: 'Case Worker', description: 'Staff managing citizen cases' },
  { role: 'Admin', label: 'Administrator', description: 'System administrators' },
  { role: 'SuperAdmin', label: 'Super Administrator', description: 'Full system access' },
]

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { session, hasRole } = useAuthStore()

  const [selectedRole, setSelectedRole] = useState<string>('Citizen')
  const [allPermissions, setAllPermissions] = useState<Permission[]>([])
  const [rolePermissions, setRolePermissions] = useState<string[]>([])
  const [permissionsByModule, setPermissionsByModule] = useState<Record<string, Permission[]>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Check if user has admin access
  useEffect(() => {
    if (!session || (!hasRole('SuperAdmin') && !hasRole('Admin'))) {
      alert('Access denied. This page is for administrators only.')
      navigate('/dashboard')
    }
  }, [session, hasRole, navigate])

  // Fetch all permissions on mount
  useEffect(() => {
    fetchAllPermissions()
  }, [])

  // Fetch role permissions when role changes
  useEffect(() => {
    if (selectedRole) {
      fetchRolePermissions(selectedRole)
    }
  }, [selectedRole])

  const fetchAllPermissions = async () => {
    try {
      const response = await authFetch(`${IAM_SERVICE_URL}/iam/admin/permissions`)
      const data = await response.json()
      if (data.success) {
        setAllPermissions(data.data.permissions)
        setPermissionsByModule(data.data.byModule)
      } else {
        setError('Failed to load permissions')
      }
    } catch (err) {
      setError('Error fetching permissions: ' + (err as Error).message)
    }
  }

  const fetchRolePermissions = async (role: string) => {
    setLoading(true)
    setError(null)
    try {
      const response = await authFetch(`${IAM_SERVICE_URL}/iam/admin/roles/${role}/permissions`)
      const data = await response.json()
      if (data.success) {
        setRolePermissions(data.data.permissions || [])
      } else {
        setError('Failed to load role permissions')
      }
    } catch (err) {
      setError('Error fetching role permissions: ' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleTogglePermission = async (permissionKey: string, currentlyGranted: boolean) => {
    setSaving(true)
    setError(null)
    setSuccessMsg(null)

    try {
      if (currentlyGranted) {
        // Revoke permission
        const response = await fetch(
          `${IAM_SERVICE_URL}/iam/admin/roles/${selectedRole}/permissions/${permissionKey}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${session?.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        )
        const data = await response.json()
        if (!response.ok || !data.success) {
          throw new Error(data.error?.message || 'Failed to revoke permission')
        }
        setSuccessMsg(`Permission '${permissionKey}' revoked from ${selectedRole}`)
      } else {
        // Grant permission
        const response = await fetch(
          `${IAM_SERVICE_URL}/iam/admin/roles/${selectedRole}/permissions`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session?.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ permission_key: permissionKey }),
          }
        )
        const data = await response.json()
        if (!response.ok || !data.success) {
          throw new Error(data.error?.message || 'Failed to grant permission')
        }
        setSuccessMsg(`Permission '${permissionKey}' granted to ${selectedRole}`)
      }

      // Refresh role permissions
      await fetchRolePermissions(selectedRole)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const isPermissionGranted = (permissionKey: string) => {
    return rolePermissions.includes(permissionKey)
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Super Admin Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Configure role-based permissions for the system
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-green-800 dark:text-green-200">{successMsg}</p>
          </div>
        )}

        {/* Role Selector */}
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Select Role to Configure
          </label>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            {AVAILABLE_ROLES.map((roleConfig) => (
              <option key={roleConfig.role} value={roleConfig.role}>
                {roleConfig.label} - {roleConfig.description}
              </option>
            ))}
          </select>
        </div>

        {/* Permissions Configuration */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading permissions...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(permissionsByModule).map(([module, permissions]) => (
              <div
                key={module}
                className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden"
              >
                <div className="bg-gray-50 dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
                    {module} Module
                  </h2>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {permissions.map((permission) => {
                      const granted = isPermissionGranted(permission.permission_key)
                      return (
                        <div
                          key={permission.permission_key}
                          className="flex items-start justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                          <div className="flex-1">
                            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                              {permission.permission_name}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {permission.description || permission.permission_key}
                            </p>
                          </div>
                          <button
                            onClick={() => handleTogglePermission(permission.permission_key, granted)}
                            disabled={saving}
                            className={`ml-4 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                              granted
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {saving ? 'Saving...' : granted ? 'Granted' : 'Revoked'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info Box */}
        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">
              info
            </span>
            <div>
              <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                About Permissions
              </h3>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <li>• <strong>Granted</strong> permissions allow users with this role to access the feature</li>
                <li>• <strong>Revoked</strong> permissions hide the feature from users with this role</li>
                <li>• Changes take effect immediately for new logins</li>
                <li>• Example: Revoke "View Grievances" from Citizens to disable the grievances feature</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
