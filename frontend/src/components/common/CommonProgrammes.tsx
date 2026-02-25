/**
 * COMMON PROGRAMMES
 *
 * Permission-driven wrapper that renders the correct Programmes variant:
 *
 *   ADMIN.OVERVIEW.VIEW (full admin)
 *     → AdminProgrammesTableContent  — system-wide overview table (Sr No, Name,
 *                                      Status, Enrolled, Budget, Actions)
 *
 *   ADMIN.PROGRAMMES.VIEW | PROGRAMME.PROGRAMMES.VIEW  (programme manager)
 *     → ProgrammesPageContent        — rule builder + programme management view
 *
 *   Anything else (citizen)
 *     → CommonProgramme              — card-based enrolled-programmes view
 *
 * All decisions are permission-driven — no role-name checks.
 */

import AdminProgrammesTableContent from '@/components/superadmin/AdminProgrammesTable'
import ProgrammesPageContent from '@/components/programme-admin/ProgrammesPage'
import CommonProgramme from '@/components/common/CommonProgramme'
import { usePermissions, SECTION_PREFIXES } from '@/lib/auth'

export type ProgrammesVariant = 'admin-table' | 'programme' | 'citizen'

/** Derive the variant from the user's permission set (exported for tests). */
export function resolveProgrammesVariant(
  hasPrefix: (prefix: string) => boolean,
  hasPermission: (p: string) => boolean,
): ProgrammesVariant {
  const hasAdminAccess = hasPrefix(SECTION_PREFIXES.Administration)
  const hasFullAdmin   = hasPermission('ADMIN.OVERVIEW.VIEW')

  const hasProgrammeAccess =
    hasPermission('ADMIN.PROGRAMMES.VIEW') ||
    hasPermission('PROGRAMME.PROGRAMMES.VIEW')

  if (hasFullAdmin && hasAdminAccess) return 'admin-table'
  if (hasProgrammeAccess)             return 'programme'
  return 'citizen'
}

export default function CommonProgrammes() {
  const { hasPrefix, hasPermission } = usePermissions()
  const variant = resolveProgrammesVariant(hasPrefix, hasPermission)

  switch (variant) {
    case 'admin-table':
      return <AdminProgrammesTableContent />
    case 'programme':
      return <ProgrammesPageContent />
    case 'citizen':
    default:
      return <CommonProgramme mode="citizen" />
  }
}
