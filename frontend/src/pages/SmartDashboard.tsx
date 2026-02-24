/**
 * SMART DASHBOARD
 *
 * Entry point for /dashboard. Picks the correct dashboard experience:
 *   - Users with ADMIN.PROGRAMMES.VIEW but no full admin → Programme Admin Dashboard
 *   - Users with full ADMIN permissions → AdminDashboard 
 *   - Users with CITIZEN permissions → CitizenDashboard
 *
 * ⚠️ IMPORTANT: This uses PERMISSIONS not roles.
 * Roles are just containers - we check permissions only.
 */

import AdminDashboard from '@/pages/admin/AdminDashboard'
import CitizenDashboard from '@/pages/citizen/Dashboard'
import ProgrammeDashboardPage from '@/pages/programme-admin/DashboardPage'
import { usePermissions, SECTION_PREFIXES } from '@/lib/auth'

export default function SmartDashboard() {
  const { hasPrefix, hasPermission } = usePermissions()

  // Check permission prefixes - NOT role names
  const hasAdminAccess = hasPrefix(SECTION_PREFIXES.Administration)
  const hasProgrammeAccess = hasPermission('ADMIN.PROGRAMMES.VIEW')

  // Full admin (has admin overview/families/etc) → show admin dashboard
  const hasFullAdmin = hasPermission('ADMIN.OVERVIEW.VIEW')

  if (hasFullAdmin && hasAdminAccess) {
    return <AdminDashboard />
  }

  // Programme Managers → show Programme Admin dashboard
  if (hasProgrammeAccess) {
    return <ProgrammeDashboardPage />
  }

  // Default to citizen dashboard
  return <CitizenDashboard />
}
