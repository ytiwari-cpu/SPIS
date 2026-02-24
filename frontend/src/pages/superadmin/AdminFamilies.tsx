import AdminFamiliesContent from '@/components/superadmin/AdminFamilies'

export default function AdminFamilies() {
  return <AdminFamiliesContent />
}

export const requiredPermission = 'ADMIN.FAMILIES.VIEW'
