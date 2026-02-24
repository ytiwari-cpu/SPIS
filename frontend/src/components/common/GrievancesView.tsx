/**
 * COMMON GRIEVANCES VIEW
 *
 * Permission-based wrapper for grievances pages.
 * Delegates to CommonGrievances which selects the correct variant.
 *
 * Kept as a thin re-export for backward compatibility.
 */

import CommonGrievances from '@/components/common/CommonGrievances'

export default function GrievancesView() {
    return <CommonGrievances />
}
