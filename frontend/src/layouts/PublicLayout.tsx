import { Outlet, Link, useLocation } from 'react-router-dom'

export default function PublicLayout() {
  const location = useLocation()
  const isHomePage = location.pathname === '/'

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-background-dark border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
                <span className="material-symbols-outlined">account_balance</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                  SPIS
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
                  Social Protection Information System
                </p>
              </div>
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-6">
              <Link
                to="/"
                className={`text-sm font-medium ${
                  isHomePage
                    ? 'text-primary'
                    : 'text-gray-600 dark:text-gray-300 hover:text-primary'
                }`}
              >
                Home
              </Link>
              <Link
                to="/notices"
                className={`text-sm font-medium ${
                  location.pathname.startsWith('/notices')
                    ? 'text-primary'
                    : 'text-gray-600 dark:text-gray-300 hover:text-primary'
                }`}
              >
                Notices
              </Link>
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-3">
              {/* Language Selector Placeholder */}
              <button className="hidden sm:flex items-center gap-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                <span className="material-symbols-outlined text-lg">language</span>
                <span>EN</span>
              </button>

              <Link
                to="/login"
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-primary border border-primary rounded-lg hover:bg-primary/5 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">login</span>
                <span className="hidden sm:inline">Login</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* About */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-white">
                  <span className="material-symbols-outlined text-lg">account_balance</span>
                </div>
                <span className="font-bold text-gray-900 dark:text-white">SPIS</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 max-w-md">
                The Social Protection Information System is a national-scale platform
                designed to streamline social welfare programmes and ensure benefits
                reach those who need them most.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Quick Links</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link to="/notices" className="text-gray-600 dark:text-gray-400 hover:text-primary">
                    Public Notices
                  </Link>
                </li>
                <li>
                  <Link to="/register" className="text-gray-600 dark:text-gray-400 hover:text-primary">
                    Register Family
                  </Link>
                </li>
                <li>
                  <Link to="/login" className="text-gray-600 dark:text-gray-400 hover:text-primary">
                    Citizen Login
                  </Link>
                </li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Contact</h3>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg">phone</span>
                  <span>1800-XXX-XXXX</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg">mail</span>
                  <span>support@spis.gov</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-800 mt-8 pt-8 text-center text-sm text-gray-500 dark:text-gray-400">
            © 2026 Social Protection Information System. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
