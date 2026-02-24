/**
 * COMMON PROGRAMMES VIEW
 *
 * Permission-based wrapper for programme pages.
 * Delegates to CommonProgramme which selects the correct variant.
 *
 * Kept as a thin re-export for backward compatibility.
 */

import CommonProgramme from '@/components/common/CommonProgramme'

export default function ProgrammesView() {
  return <CommonProgramme />
}
