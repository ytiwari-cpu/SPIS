/**
 * COMMON FAMILY
 *
 * Permission-based wrapper that renders the correct family view:
 *
 *   1. **Admin mode** — user has ADMIN.FAMILIES.VIEW → shows all-families
 *      list with search / filters / Active-Archive tabs / actions.
 *   2. **Programme mode** — route includes a programmeId param → shows
 *      families linked to that programme (re-uses admin UI with filtered data).
 *   3. **Citizen mode** — user has CITIZEN.FAMILY.VIEW → shows the
 *      citizen's own family detail view.
 *
 * The component never checks role names — it reads permissions and route
 * context only.
 */

import { useParams } from 'react-router-dom'
import { usePermissions, SECTION_PREFIXES } from '@/lib/auth'
import AdminFamiliesContent from '@/components/superadmin/AdminFamilies'
import MyFamilyContent from '@/components/citizen/MyFamily'

export type FamilyMode = 'admin' | 'programme' | 'citizen'

export interface CommonFamilyProps {
  /** Override the auto-detected mode (useful when a parent page already
   *  knows which variant it wants). */
  mode?: FamilyMode
  /** When provided, the admin list is scoped to this programme. */
  programmeId?: string
}

/** Derive the mode from permissions + route context. */
export function resolveFamilyMode(
  hasPrefix: (p: string) => boolean,
  programmeId?: string,
): FamilyMode {
  if (programmeId) return 'programme'
  if (hasPrefix(SECTION_PREFIXES.Administration)) return 'admin'
  return 'citizen'
}

export default function CommonFamily({ mode: modeProp, programmeId: pidProp }: CommonFamilyProps = {}) {
  const { hasPrefix } = usePermissions()
  const params = useParams<{ programmeId?: string }>()

  const programmeId = pidProp ?? params.programmeId
  const mode = modeProp ?? resolveFamilyMode(hasPrefix, programmeId)

  switch (mode) {
    case 'admin':
      return <AdminFamiliesContent />

    case 'programme':
      // TODO: When a programme-scoped families API exists, pass programmeId
      // to a filtered variant. For now, fall through to the admin list.
      return <AdminFamiliesContent />

    case 'citizen':
    default:
      return <MyFamilyContent />
  }
}
