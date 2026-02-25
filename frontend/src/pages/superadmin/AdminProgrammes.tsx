import AdminProgrammesTableContent from '@/components/superadmin/AdminProgrammesTable'

export default function AdminProgrammes() {
  return <AdminProgrammesTableContent />
}

export const requiredPermission = 'ADMIN.PROGRAMMES.VIEW'
