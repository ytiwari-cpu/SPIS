import AdminProgrammesContent from '@/components/superadmin/AdminProgrammes'

export default function AdminProgrammes() {
  return <AdminProgrammesContent />
}

export const requiredPermission = 'ADMIN.PROGRAMMES.VIEW'
