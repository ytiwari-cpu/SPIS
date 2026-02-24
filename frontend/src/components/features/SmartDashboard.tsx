/**
 * SMART DASHBOARD
 *
 * Entry point for /dashboard. Delegates to CommonDashboard which picks
 * the correct dashboard experience based on permissions.
 *
 * ⚠️ IMPORTANT: This uses PERMISSIONS not roles.
 * Roles are just containers - we check permissions only.
 */

import CommonDashboard from '@/components/common/CommonDashboard'

export default function SmartDashboardContent() {
  return <CommonDashboard />
}
