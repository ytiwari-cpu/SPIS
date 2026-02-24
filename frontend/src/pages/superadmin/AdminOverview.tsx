import AdminOverviewContent from '@/components/superadmin/AdminOverview'

export default function AdminOverview() {
  return <AdminOverviewContent />
}

export const requiredPermission = 'ADMIN.OVERVIEW.VIEW'
