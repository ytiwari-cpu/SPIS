/**
 * ADMIN LAYOUT
 * 
 * Layout wrapper for Admin dashboard pages.
 * Includes sidebar navigation with role-based visibility.
 */

import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { usePermissions } from '@/lib/auth'
import { getUserMode } from '@/lib/moduleResolver'

const navItems = [
  { path: '/admin', label: 'Dashboard', icon: 'dashboard' },
  { path: '/admin/overview', label: 'Overview', icon: 'analytics', admin: true },
  { path: '/admin/families', label: 'Families', icon: 'family_restroom' },
  { path: '/admin/programmes', label: 'Programmes', icon: 'verified_user' },
  { path: '/admin/grievances', label: 'Grievances', icon: 'error_outline' },
  { path: '/admin/appeals', label: 'Appeals', icon: 'gavel' },
  { path: '/admin/users', label: 'Users', icon: 'group', admin: true },
  { path: '/admin/admin-access', label: 'Admins & Access', icon: 'admin_panel_settings', admin: true },
  { path: '/admin/roles', label: 'Role Management', icon: 'lock_person', admin: true },
  { path: '/admin/case-workers', label: 'Case Workers', icon: 'support_agent' },
  { path: '/admin/audit-logs', label: 'Audit Logs', icon: 'history', admin: true },
]

export default function AdminLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { hasPrefix, hasPermission } = usePermissions()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const isAdmin = hasPermission('ADMIN.OVERVIEW.VIEW')

  // Derive portal label from permissions, not role names
  const mode = getUserMode(hasPrefix, hasPermission)
  const portalLabel =
    mode === 'ADMIN' ? 'Administration Portal' :
    mode === 'PROGRAMME' ? 'Programme Portal' :
    'Staff Portal'

  // Filter nav items based on role
  const visibleNavItems = navItems.filter(item => !item.admin || isAdmin)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isActivePath = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin'
    }
    return location.pathname.startsWith(path)
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      {/* Top Header */}
      <header className="sticky top-0 z-40 flex items-center bg-white dark:bg-background-dark border-b border-gray-200 dark:border-gray-800 p-4">
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="md:hidden flex size-10 items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>

        <div className="flex items-center gap-3 ml-2 md:ml-0">
          <Link to="/admin" className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
            <span className="material-symbols-outlined">admin_panel_settings</span>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">
              {portalLabel}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Social Protection Information System</p>
          </div>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-3">
          <button className="flex items-center justify-center size-10 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-lg">person</span>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar Overlay (Mobile) */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-40 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <nav
          className={`fixed md:sticky top-0 md:top-16 left-0 z-50 md:z-auto h-screen md:h-[calc(100vh-4rem)] w-64 flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-background-dark p-4 transform transition-transform duration-200 ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          } md:flex`}
        >
          {/* User Info (Mobile) */}
          <div className="md:hidden flex items-center gap-3 mb-6 pb-4 border-b border-gray-200 dark:border-gray-800">
            <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">person</span>
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">{user?.name || 'User'}</p>
              <p className="text-xs text-gray-500">Administrator</p>
            </div>
          </div>

          {/* Navigation Items */}
          <div className="flex flex-col gap-1">
            {visibleNavItems.map((item) => {
              const isActive = isActivePath(item.path)
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsSidebarOpen(false)}
                  className={`flex h-11 items-center gap-3 rounded-lg px-4 transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <span className="material-symbols-outlined text-xl">{item.icon}</span>
                  <p className={`text-sm ${isActive ? 'font-bold' : 'font-medium'}`}>
                    {item.label}
                  </p>
                </Link>
              )
            })}
          </div>

          {/* Bottom Section */}
          <div className="mt-auto pt-4 border-t border-gray-200 dark:border-gray-800">
            <button
              onClick={handleLogout}
              className="w-full flex h-11 items-center gap-3 rounded-lg px-4 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <span className="material-symbols-outlined">logout</span>
              <p className="text-sm font-medium">Logout</p>
            </button>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 min-h-[calc(100vh-4rem)] pb-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
