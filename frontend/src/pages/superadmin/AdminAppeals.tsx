import AdminAppealsContent from '@/components/superadmin/AdminAppeals'

export default function AdminAppeals() {
  return <AdminAppealsContent />
}

export const requiredPermission = 'ADMIN.APPEALS.VIEW'
