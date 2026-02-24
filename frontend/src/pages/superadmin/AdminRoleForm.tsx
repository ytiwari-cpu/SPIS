import AdminRoleFormContent from '@/components/superadmin/AdminRoleForm'

export default function AdminRoleForm() {
  return <AdminRoleFormContent />
}

export const requiredPermission = 'ADMIN.ROLES.VIEW'
