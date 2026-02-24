/**
 * Citizen Programmes — delegates to CommonProgramme with mode='citizen'
 * All logic, UI, and data fetching lives in CommonProgramme.
 */
import CommonProgramme from '@/components/common/CommonProgramme'

export default function ProgrammesContent() {
  return <CommonProgramme mode="citizen" />
}
