import AdminGrievancesContent from '@/components/superadmin/AdminGrievances'

export default function AdminGrievances() {
  return <AdminGrievancesContent />
}

export const requiredPermission = 'ADMIN.GRIEVANCES.VIEW'
