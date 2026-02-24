import AdminRolesContent from '@/components/superadmin/AdminRoles'

export default function AdminRoles() {
  return <AdminRolesContent />
}

export const requiredPermission = 'ADMIN.ROLES.VIEW'
