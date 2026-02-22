/**
 * SMART DASHBOARD
 *
 * Entry point for /dashboard. Picks the correct dashboard experience:
 *   - Users with ADMIN permissions → AdminDashboard 
 *   - Users with CITIZEN permissions → CitizenDashboard
 *
 * ⚠️ IMPORTANT: This uses PERMISSIONS not roles.
 * Roles are just containers - we check permissions only.
 */

import AdminDashboard from '@/pages/admin/AdminDashboard'
import CitizenDashboard from '@/pages/citizen/Dashboard'
import { usePermissions, SECTION_PREFIXES } from '@/lib/auth'

export default function SmartDashboard() {
  const { hasPrefix } = usePermissions()

  // Check permission prefixes - NOT role names
  const hasAdminAccess = hasPrefix(SECTION_PREFIXES.Administration)

  // If user has admin permissions, show admin dashboard
  // (They may ALSO have citizen perms, but admin takes precedence)
  if (hasAdminAccess) {
    return <AdminDashboard />
  }

  // Default to citizen dashboard
  return <CitizenDashboard />
}
