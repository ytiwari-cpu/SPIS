/**
 * ADMIN DASHBOARD
 *
 * Landing page for staff users (SuperAdmin, Admin, CaseWorker, ProgrammeManager).
 * Shows a welcome banner, quick-stat cards, and shortcut links to common sections.
 *
 * Detailed analytics/cases live at /admin/overview (AdminOverview).
 * Permission management lives at /admin/roles (AdminRoleManagement).
 */

import { Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

interface QuickLink {
  label: string
  description: string
  icon: string
  path: string
  color: string
}

const quickLinks: QuickLink[] = [
  { label: 'Overview', description: 'Stats, cases & analytics', icon: 'analytics', path: '/admin/overview', color: 'bg-blue-500' },
  { label: 'Families', description: 'View & manage families', icon: 'family_restroom', path: '/admin/families', color: 'bg-emerald-500' },
  { label: 'Programme Admin', description: 'Manage social programmes', icon: 'verified_user', path: '/programme-admin', color: 'bg-purple-500' },
  { label: 'Grievances', description: 'Review submitted grievances', icon: 'error_outline', path: '/admin/grievances', color: 'bg-orange-500' },
  { label: 'Case Workers', description: 'Assign & manage workers', icon: 'support_agent', path: '/admin/case-workers', color: 'bg-cyan-500' },
  { label: 'Role Management', description: 'Configure roles & permissions', icon: 'lock_person', path: '/admin/roles', color: 'bg-rose-500' },
]

export default function AdminDashboard() {
  const { user, session } = useAuthStore()

  const displayName = user?.name || session?.email?.split('@')[0] || 'Admin'
  const primaryRole = session?.roles?.[0] || 'Staff'

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
      {/* ── Welcome Banner ──────────────────────────────────────── */}
      <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-white p-6 lg:p-8">
        <h1 className="text-2xl lg:text-3xl font-bold mb-1">
          Welcome back, {displayName}
        </h1>
        <p className="text-white/80 text-sm lg:text-base">
          Signed in as <span className="font-semibold">{primaryRole}</span> — use the links below or the sidebar to navigate.
        </p>
      </div>

      {/* ── Quick Links Grid ────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Quick Actions
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className="group flex items-start gap-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 hover:shadow-md hover:border-primary/40 transition-all"
            >
              <div className={`shrink-0 size-11 rounded-lg ${link.color} flex items-center justify-center`}>
                <span className="material-symbols-outlined text-white text-xl">{link.icon}</span>
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white group-hover:text-primary transition-colors">
                  {link.label}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {link.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Help Box ────────────────────────────────────────────── */}
      <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-5 flex items-start gap-3">
        <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 mt-0.5">info</span>
        <div className="text-sm text-blue-800 dark:text-blue-200">
          <p className="font-medium mb-1">Need detailed analytics?</p>
          <p>
            Head to{' '}
            <Link to="/admin/overview" className="underline font-medium hover:text-blue-900 dark:hover:text-blue-100">
              Administration → Overview
            </Link>{' '}
            for real-time statistics, case progress tracking, and programme performance.
          </p>
        </div>
      </div>
    </div>
  )
}
