import AdminUsersContent from '@/components/admin/AdminUsers'

export default function AdminUsers() {
  return <AdminUsersContent />
}

export const requiredPermission = 'ADMIN.USERS.VIEW'
