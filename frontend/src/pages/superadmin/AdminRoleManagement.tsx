import AdminRoleManagementContent from '@/components/superadmin/AdminRoleManagement'

export default function AdminRoleManagement() {
  return <AdminRoleManagementContent />
}

export const requiredPermission = 'ADMIN.ROLES.VIEW'
