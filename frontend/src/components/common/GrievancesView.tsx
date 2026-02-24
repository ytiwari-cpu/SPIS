/**
 * COMMON GRIEVANCES VIEW
 *
 * Role-based wrapper component for grievances pages.
 * - Admin/SuperAdmin → shows admin grievance management (AdminGrievances)
 * - Citizen → shows citizen grievance submittal and tracking
 */

import { usePermissions, SECTION_PREFIXES } from '@/lib/auth'
import AdminGrievances from '@/pages/superadmin/AdminGrievances'
import CitizenGrievances from '@/pages/citizen/Grievances'

export default function GrievancesView() {
    const { hasPrefix } = usePermissions()
    const isAdmin = hasPrefix(SECTION_PREFIXES.Administration)

    if (isAdmin) {
        return <AdminGrievances />
    }

    return <CitizenGrievances />
}
