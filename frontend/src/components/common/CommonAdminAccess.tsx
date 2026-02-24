/**
 * COMMON ADMIN & ACCESS
 *
 * Merges the "Admins & Access" view with "Role Management" under
 * two top-level tabs:
 *
 *   ┌──────────┬──────────┐
 *   │  Admin   │  Roles   │
 *   └──────────┴──────────┘
 *
 * - **Admin tab**: the existing AdminAdmins component (user list, role
 *   assignment, per-role permission editing).
 * - **Roles tab**: the existing AdminRoles component (role CRUD with
 *   Active/Inactive sub-tabs, create/edit/deactivate/restore/delete).
 *
 * Permissions required:
 * - Admin tab: ADMIN.ACCESS.VIEW
 * - Roles tab:  ADMIN.ROLES.VIEW
 *
 * All checks are permission-driven — no role-name checks.
 */

import { useState } from 'react'
import { usePermissions } from '@/lib/auth'
import AdminAdminsContent from '@/components/superadmin/AdminAdmins'
import AdminRolesContent from '@/components/superadmin/AdminRoles'

type Tab = 'admin' | 'roles'

export default function CommonAdminAccess() {
  const { hasPermission } = usePermissions()

  const canViewAdmin = hasPermission('ADMIN.ACCESS.VIEW')
  const canViewRoles = hasPermission('ADMIN.ROLES.VIEW')

  // Default to whichever tab the user can see
  const defaultTab: Tab = canViewAdmin ? 'admin' : canViewRoles ? 'roles' : 'admin'
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab)

  const tabs: { key: Tab; label: string; icon: string; visible: boolean }[] = [
    { key: 'admin', label: 'Admin & Access', icon: 'admin_panel_settings', visible: canViewAdmin },
    { key: 'roles', label: 'Roles', icon: 'lock_person', visible: canViewRoles },
  ]

  const visibleTabs = tabs.filter(t => t.visible)

  // If user can only see one tab, render the component directly
  if (visibleTabs.length <= 1) {
    if (canViewRoles && !canViewAdmin) return <AdminRolesContent />
    return <AdminAdminsContent />
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Top-level tab bar */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
          {visibleTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <span className="material-symbols-outlined text-lg">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content — AdminAdmins & AdminRoles render their own padding/max-width,
            so we wrap them without the parent padding */}
        {activeTab === 'admin' && <AdminAdminsContent />}
        {activeTab === 'roles' && <AdminRolesContent />}
      </div>
    </div>
  )
}
