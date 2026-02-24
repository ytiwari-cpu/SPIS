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
  /**
   * Permission key(s) required to access this route.
   *   string   → single permission check
   *   string[] → OR semantics (any one grants access)
   */
  permission: string | string[]
  children: React.ReactNode
}

export default function PermissionGuard({ permission, children }: PermissionGuardProps) {
  const { hasPermission } = useAuthStore()

  // hasPermission() already bypasses for SuperAdmin internally —
  // no role-name check needed here.
  const perms = Array.isArray(permission) ? permission : [permission]
  if (perms.some(p => hasPermission(p))) {
    return <>{children}</>
  }

  return <ForbiddenPage requiredPermission={perms.join(' or ')} />
}
