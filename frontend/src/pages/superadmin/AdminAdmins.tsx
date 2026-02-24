import CommonAdminAccess from '@/components/common/CommonAdminAccess'

export default function AdminAdmins() {
  return <CommonAdminAccess />
}

export const requiredPermission = 'ADMIN.ACCESS.VIEW'
