/**
 * UNIFIED APP LAYOUT
 *
 * Single layout for ALL authenticated users.
 * 
 * ⚠️ IMPORTANT: All access control is PERMISSION-BASED, never role-based.
 * Roles are just containers for permissions - check permissions only.
 * Permissions come from the signed JWT token.
 */

import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useMemo } from 'react'
import { useAuthStore } from '@/store/authStore'
import { navConfig, mobileBottomNav, type NavItem } from '@/config/navConfig'
import { usePermissions, SECTION_PREFIXES } from '@/lib/auth'

export default function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout, session } = useAuthStore()
  const { permissions, hasPermission, hasPrefix } = usePermissions()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  // Debug logging in development
  if (import.meta.env.DEV) {
    console.log('[AppLayout] Debug:', {
      hasSession: !!session,
      sessionKeys: session ? Object.keys(session) : [],
      permissions: permissions,
      permissionsLength: permissions.length,
      roles: session?.roles,
      accessTokenExists: !!session?.access_token,
    })
  }

  if (import.meta.env.DEV && permissions.length === 0 && session) {
    console.warn('[AppLayout] Session exists but permissions array is empty!', {
      sessionKeys: Object.keys(session),
      hasAccessToken: !!session.access_token,
      roles: session.roles,
      permissions: session.permissions,
    })
  }

  // ── Portal label derived from PERMISSIONS (not roles) ─────────────
  // If user has admin permissions → admin portal
  // Otherwise → citizen portal
  const portalLabel = useMemo(() => {
    // Check permission prefixes to determine portal type
    const hasAdminPerms = hasPrefix(SECTION_PREFIXES.Administration)
    const hasCitizenPerms = hasPrefix(SECTION_PREFIXES.Citizen)
    
    if (hasAdminPerms && !hasCitizenPerms) return 'Administration Portal'
    if (hasCitizenPerms && !hasAdminPerms) return 'Citizen Portal'
    if (hasAdminPerms && hasCitizenPerms) return 'SPIS Portal'
    return 'SPIS Portal'
  }, [hasPrefix])

  // ── Permission check for a nav item ────────────────────────────────
  const canAccess = (item: NavItem): boolean => {
    // Always allow items with no permission requirement (Dashboard, Settings)
    if (!item.requiredPermission) return true
    // Check if user has the required permission
    return hasPermission(item.requiredPermission)
  }

  // ── Filter nav items: HIDE items user cannot access ─────────────────────
  const filteredNavConfig = useMemo(() => {
    if (!session) return [] // Not logged in
    
    // Build filtered list: only keep items user can access
    const accessibleItems: NavItem[] = []
    const sectionsAdded = new Set<string>()
    
    navConfig.forEach(item => {
      // Check if user can access this item
      const hasAccess = canAccess(item)
      
      // Only include items the user can access
      if (hasAccess) {
        // If this item has a section and we haven't added the section marker yet
        if (item.section && !sectionsAdded.has(item.section)) {
          sectionsAdded.add(item.section)
        }
        accessibleItems.push(item)
      }
    })
    
    return accessibleItems
  }, [session, hasPermission]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mobile bottom nav: only show items user can access ─────────────
  const visibleBottomNav = useMemo(
    () => mobileBottomNav.filter(canAccess),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session],
  )

  const isActivePath = (path: string) => {
    if (path === '/dashboard') return location.pathname === '/dashboard'
    return location.pathname.startsWith(path)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      {/* ── Top Header ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 flex items-center bg-white dark:bg-background-dark border-b border-gray-200 dark:border-gray-800 p-4">
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="md:hidden flex size-10 items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>

        <div className="flex items-center gap-3 ml-2 md:ml-0">
          <Link
            to="/dashboard"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-white"
          >
            <span className="material-symbols-outlined">account_balance</span>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">
              {portalLabel}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Social Protection Information System
            </p>
          </div>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-3">
          <button className="flex items-center justify-center size-10 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <div
            className="size-8 rounded-full bg-primary/10 flex items-center justify-center cursor-pointer"
            onClick={() => navigate('/profile')}
          >
            <span className="material-symbols-outlined text-primary text-lg">person</span>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* ── Sidebar Overlay (Mobile) ────────────────────────────── */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-40 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* ── Sidebar ─────────────────────────────────────────────── */}
        <nav
          className={`fixed md:sticky top-0 md:top-16 left-0 z-50 md:z-auto h-screen md:h-[calc(100vh-4rem)] w-64 flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-background-dark p-4 transform transition-transform duration-200 overflow-y-auto ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          } md:flex`}
        >
          {/* User info (mobile only) */}
          <div className="md:hidden flex items-center gap-3 mb-6 pb-4 border-b border-gray-200 dark:border-gray-800">
            <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">person</span>
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">
                {user?.name || 'User'}
              </p>
              <p className="text-xs text-gray-500 truncate max-w-[140px]">
                {session?.roles?.[0] || 'Citizen'}
              </p>
            </div>
          </div>

          {/* Navigation Items — only items user can access */}
          <div className="flex flex-col gap-0.5">
            {filteredNavConfig.map((item) => {
              const isActive = isActivePath(item.path)

              return (
                <div key={item.path}>
                  {/* Section divider */}
                  {item.section && (
                    <p className="mt-5 mb-1 px-4 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                      {item.section}
                    </p>
                  )}

                  <Link
                    to={item.path}
                    onClick={() => setIsSidebarOpen(false)}
                    className={`flex h-11 items-center gap-3 rounded-lg px-4 transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl">
                      {item.icon}
                    </span>
                    <p className={`text-sm flex-1 ${isActive ? 'font-bold' : 'font-medium'}`}>
                      {item.label}
                    </p>
                  </Link>
                </div>
              )
            })}
          </div>

          {/* Bottom — Logout */}
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

        {/* ── Main Content ────────────────────────────────────────── */}
        <main className="flex-1 min-h-[calc(100vh-4rem)] pb-20 md:pb-8">
          <Outlet />
        </main>
      </div>

      {/* ── Bottom Navigation (Mobile) ─────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-background-dark border-t border-gray-200 dark:border-gray-800 flex justify-around items-center h-16 pb-2 z-50">
        {visibleBottomNav.map((item) => {
          const isActive = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center gap-1 ${
                isActive ? 'text-primary' : 'text-gray-400'
              }`}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
