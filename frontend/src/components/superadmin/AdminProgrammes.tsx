/**
 * Admin Programmes — delegates to CommonProgramme with mode='admin'
 * All logic, UI, and data fetching lives in CommonProgramme.
 */
import CommonProgramme from '@/components/common/CommonProgramme'

export default function AdminProgrammesContent() {
  return <CommonProgramme mode="admin" />
}
