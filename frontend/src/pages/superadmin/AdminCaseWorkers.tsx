import AdminCaseWorkersContent from '@/components/superadmin/AdminCaseWorkers'

export default function AdminCaseWorkers() {
  return <AdminCaseWorkersContent />
}

export const requiredPermission = 'ADMIN.CASEWORKERS.VIEW'
