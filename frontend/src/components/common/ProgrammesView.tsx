/**
 * COMMON PROGRAMMES VIEW
 *
 * Role-based wrapper component for programme pages.
 * - Admin/SuperAdmin/ProgrammeManager → redirects to Programme Admin module
 * - Citizen → shows enrolled programmes from real API data
 */

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePermissions, SECTION_PREFIXES } from '@/lib/auth'
import CitizenProgrammes from '@/pages/citizen/Programmes'

export default function ProgrammesView() {
    const { hasPrefix } = usePermissions()
    const navigate = useNavigate()
    const isAdmin = hasPrefix(SECTION_PREFIXES.Administration)

    useEffect(() => {
        // Admin users should use the full Programme Admin module
        if (isAdmin) {
            navigate('/programme-admin/programmes', { replace: true })
        }
    }, [isAdmin, navigate])

    // Citizens see the citizen programmes view
    if (!isAdmin) {
        return <CitizenProgrammes />
    }

    // Will redirect, but return null during navigation
    return null
}
