import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useMemo } from 'react'
import { useAuthStore } from '@/store/authStore'

interface NavItem {
  path: string
  label: string
  icon: string
  requiredPermission?: string
}

const allNavigationItems: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: 'dashboard', requiredPermission: 'view_dashboard' },
  { path: '/family', label: 'My Family', icon: 'family_restroom', requiredPermission: 'view_family' },
  { path: '/profile', label: 'My Profile', icon: 'person', requiredPermission: 'view_profile' },
  { path: '/documents', label: 'Documents', icon: 'description', requiredPermission: 'view_documents' },
  { path: '/programmes', label: 'Programmes', icon: 'verified_user', requiredPermission: 'view_programmes' },
  { path: '/benefits', label: 'Benefits', icon: 'payments', requiredPermission: 'view_benefits' },
  { path: '/grievances', label: 'Grievances', icon: 'error_outline', requiredPermission: 'view_grievances' },
]

const allBottomNavItems: NavItem[] = [
  { path: '/dashboard', label: 'Home', icon: 'home', requiredPermission: 'view_dashboard' },
  { path: '/family', label: 'Family', icon: 'family_restroom', requiredPermission: 'view_family' },
  { path: '/benefits', label: 'Benefits', icon: 'payments', requiredPermission: 'view_benefits' },
  { path: '/settings', label: 'More', icon: 'more_horiz' },
]

export default function CitizenLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout, hasPermission } = useAuthStore()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  // Filter navigation items based on user permissions
  const navigationItems = useMemo(() => {
    return allNavigationItems.filter(item => {
      if (!item.requiredPermission) return true
      return hasPermission(item.requiredPermission)
    })
  }, [hasPermission])

  const bottomNavItems = useMemo(() => {
    return allBottomNavItems.filter(item => {
      if (!item.requiredPermission) return true
      return hasPermission(item.requiredPermission)
    })
  }, [hasPermission])

  const handleLogout = () => {
    logout()
    navigate('/login')
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
          <Link to="/" className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
            <span className="material-symbols-outlined">account_balance</span>
          </Link>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Citizen Portal</h1>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
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
              <p className="font-semibold text-gray-900 dark:text-white">{user?.name}</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
          </div>

          {/* Navigation Items */}
          <div className="flex flex-col gap-1">
            {navigationItems.map((item) => {
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsSidebarOpen(false)}
                  className={`flex h-12 items-center gap-3 rounded-lg px-4 transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <span className="material-symbols-outlined">{item.icon}</span>
                  <p className={`text-sm ${isActive ? 'font-bold' : 'font-medium'}`}>
                    {item.label}
                  </p>
                </Link>
              )
            })}
          </div>

          {/* Bottom Section */}
          <div className="mt-auto pt-4 border-t border-gray-200 dark:border-gray-800">
            <Link
              to="/settings"
              onClick={() => setIsSidebarOpen(false)}
              className={`flex h-12 items-center gap-3 rounded-lg px-4 transition-colors ${
                location.pathname === '/settings'
                  ? 'bg-primary/10 text-primary'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <span className="material-symbols-outlined">settings</span>
              <p className="text-sm font-medium">Settings</p>
            </Link>
            <button
              onClick={handleLogout}
              className="w-full flex h-12 items-center gap-3 rounded-lg px-4 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <span className="material-symbols-outlined">logout</span>
              <p className="text-sm font-medium">Logout</p>
            </button>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 min-h-[calc(100vh-4rem)] pb-20 md:pb-0">
          <Outlet />
        </main>
      </div>

      {/* Bottom Navigation (Mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-background-dark border-t border-gray-200 dark:border-gray-800 flex justify-around items-center h-16 pb-2 z-50">
        {bottomNavItems.map((item) => {
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
