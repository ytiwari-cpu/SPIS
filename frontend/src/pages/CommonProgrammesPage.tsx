/**
 * Programmes Page — permission-driven wrapper.
 *
 * Renders:
 *   • AdminProgrammesTable   for full admins  (ADMIN.OVERVIEW.VIEW)
 *   • ProgrammesPage         for programme managers
 *   • CommonProgramme cards  for citizens
 *
 * See CommonProgrammes for variant logic.
 */
import CommonProgrammes from '@/components/common/CommonProgrammes'

export const requiredPermission = [
  'ADMIN.OVERVIEW.VIEW',
  'ADMIN.PROGRAMMES.VIEW',
  'PROGRAMME.PROGRAMMES.VIEW',
  'CITIZEN.PROGRAMMES.VIEW',
] as const

export default function CommonProgrammesPage() {
  return <CommonProgrammes />
}
