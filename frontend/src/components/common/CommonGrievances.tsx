/**
 * COMMON GRIEVANCES
 *
 * Permission-based wrapper that renders the correct grievances view:
 *
 *   1. **Admin mode** — user has ADMIN.GRIEVANCES.VIEW → admin grievance
 *      management (AdminGrievances) with active/archive tabs.
 *   2. **Citizen mode** — user has CITIZEN.GRIEVANCES.VIEW → citizen
 *      grievance submittal and tracking.
 *
 * All decisions are permission-driven — no role-name checks.
 */

import { usePermissions, SECTION_PREFIXES } from '@/lib/auth'
import AdminGrievancesContent from '@/components/superadmin/AdminGrievances'
import GrievancesContent from '@/components/citizen/Grievances'

export type GrievanceMode = 'admin' | 'citizen'

export interface CommonGrievancesProps {
  mode?: GrievanceMode
}

export function resolveGrievanceMode(
  hasPrefix: (p: string) => boolean,
): GrievanceMode {
  if (hasPrefix(SECTION_PREFIXES.Administration)) return 'admin'
  return 'citizen'
}

export default function CommonGrievances({ mode: modeProp }: CommonGrievancesProps = {}) {
  const { hasPrefix } = usePermissions()
  const mode = modeProp ?? resolveGrievanceMode(hasPrefix)

  switch (mode) {
    case 'admin':
      return <AdminGrievancesContent />
    case 'citizen':
    default:
      return <GrievancesContent />
  }
}
