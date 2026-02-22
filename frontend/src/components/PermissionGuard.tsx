/**
 * PERMISSION GUARD
 *
 * Wraps a route element. If the user lacks the required permission
 * the guard renders <ForbiddenPage /> instead of the child.
 * SuperAdmin always passes.
 */

import { useAuthStore } from '@/store/authStore'
import ForbiddenPage from '@/pages/ForbiddenPage'

interface PermissionGuardProps {
  /** The permission key required (e.g. "ADMIN.FAMILIES.VIEW"). */
  permission: string
  children: React.ReactNode
}

export default function PermissionGuard({ permission, children }: PermissionGuardProps) {
  const { hasPermission } = useAuthStore()

  if (!hasPermission(permission)) {
    return <ForbiddenPage requiredPermission={permission} />
  }

  return <>{children}</>
}
