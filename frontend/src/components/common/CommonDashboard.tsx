/**
 * COMMON DASHBOARD
 *
 * Renders the appropriate dashboard variant based on the user's permissions.
 *
 *   - ADMIN.OVERVIEW.VIEW  → Admin Overview dashboard
 *   - ADMIN.PROGRAMMES.VIEW (without full admin) → Programme-Admin dashboard
 *   - Anything else (citizen prefix) → Citizen dashboard
 *
 * All decisions are permission-driven — no role-name checks.
 */

import AdminOverviewContent from '@/components/superadmin/AdminOverview'
import DashboardContent from '@/components/citizen/Dashboard'
import ProgrammeDashboardPageContent from '@/components/programme-admin/DashboardPage'
import { usePermissions, SECTION_PREFIXES } from '@/lib/auth'

export type DashboardVariant = 'admin' | 'programme' | 'citizen'

/** Derive the variant from the user's permission set (exported for tests). */
export function resolveDashboardVariant(
  hasPrefix: (prefix: string) => boolean,
  hasPermission: (p: string) => boolean,
): DashboardVariant {
  const hasAdminAccess = hasPrefix(SECTION_PREFIXES.Administration)
  const hasFullAdmin = hasPermission('ADMIN.OVERVIEW.VIEW')
  // Programme mode: has ADMIN.PROGRAMMES.VIEW (full admin also has this, but
  // we check full admin first) OR PROGRAMME.PROGRAMMES.VIEW (ProgrammeManager)
  const hasProgrammeAccess =
    hasPermission('ADMIN.PROGRAMMES.VIEW') ||
    hasPermission('PROGRAMME.PROGRAMMES.VIEW')

  if (hasFullAdmin && hasAdminAccess) return 'admin'
  if (hasProgrammeAccess) return 'programme'
  return 'citizen'
}

export default function CommonDashboard() {
  const { hasPrefix, hasPermission } = usePermissions()
  const variant = resolveDashboardVariant(hasPrefix, hasPermission)

  switch (variant) {
    case 'admin':
      return <AdminOverviewContent />
    case 'programme':
      return <ProgrammeDashboardPageContent />
    case 'citizen':
    default:
      return <DashboardContent />
  }
}
