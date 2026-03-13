# RBAC Architecture - Pure Permission-Based Access Control

## ⚠️ CRITICAL DESIGN PRINCIPLES

### 1. **Role Names NEVER Control Access**
Roles are containers for permissions. The role name (SuperAdmin, Admin, CaseWorker, Citizen) is NEVER used in access control decisions.

```typescript
// ❌ WRONG - Role-based access
if (hasRole('SuperAdmin')) { showButton() }
if (user.role === 'Admin') { allowAccess() }

// ✅ CORRECT - Permission-based access  
if (hasPermission('ADMIN.ROLES.MANAGE_PERMISSIONS')) { showButton() }
if (hasPermission('ADMIN.FAMILIES.EDIT')) { allowAccess() }
```

### 2. **Permissions Come From Signed JWT**
- Permissions are embedded in the JWT token at login time
- Client-side checks use `session.permissions[]` from the JWT
- Backend enforces the same permissions (defense in depth)
- Never trust localStorage/sessionStorage alone - verify token signature

### 3. **Permission Format**
```
{SECTION}.{RESOURCE}.{ACTION}
```

Examples:
- `CITIZEN.FAMILY.VIEW` - View own family data
- `ADMIN.FAMILIES.EDIT` - Edit any family
- `ADMIN.ROLES.MANAGE_PERMISSIONS` - Manage role permissions

---

## Architecture Files

### `/frontend/src/lib/auth.ts` (NEW)
Central authorization utilities:
- `hasPermission(permission)` - Check single permission
- `hasAnyPermission(permissions)` - Check if ANY permission granted
- `hasAllPermissions(permissions)` - Check if ALL permissions granted  
- `hasPermissionPrefix(prefix)` - Check for section access (e.g., "ADMIN.")
- `usePermissions()` - React hook for reactive permission checks
- `PERMISSIONS` - Type-safe permission constants
- `SECTION_PREFIXES` - Section prefixes for sidebar/dashboard logic

### `/frontend/src/store/authStore.ts`
Zustand store with session management:
- `session.permissions[]` - Array of permission strings from JWT
- `hasPermission()` - Method to check permissions (defensive against null)
- `hasRole()` - DEPRECATED - kept for backwards compatibility only

### `/frontend/src/config/navConfig.ts`
Navigation configuration with `requiredPermission` field:
```typescript
{ path: '/family', label: 'My Family', icon: 'family_restroom', 
  requiredPermission: 'CITIZEN.FAMILY.VIEW', section: 'Citizen' }
```

### `/frontend/src/layouts/AppLayout.tsx`
Unified layout that:
- Uses `hasPrefix()` for portal label (admin vs citizen)
- Uses `hasPermission()` for item-level visibility
- Hides entire sections where user has zero accessible items

### `/frontend/src/components/PermissionGuard.tsx`
Route-level guard:
```tsx
<Route path="/admin/roles" element={
  <PermissionGuard permission="ADMIN.ROLES.VIEW">
    <AdminRoleManagement />
  </PermissionGuard>
} />
```

---

## Migration Summary (What Changed)

### Removed
- `AdminLayout.tsx` - Dead code, unused
- `adminUtils.ts` - Dead code, contained role-based helpers
- All `STAFF_ROLES` arrays
- All `isSuperAdmin = hasRole('SuperAdmin')` patterns
- All `currentAdmin` mock data usage for permissions

### Updated Files
| File | Change |
|------|--------|
| `AppLayout.tsx` | Use `hasPrefix()` for portal label, removed hasRole |
| `SmartDashboard.tsx` | Use permission prefix instead of role array |
| `LoginPage.tsx` | Check `CITIZEN.` permission prefix instead of role |
| `AdminFamilies.tsx` | Use JWT permissions: `ADMIN.FAMILIES.EDIT` etc |
| `AdminAppeals.tsx` | Use JWT permissions: `ADMIN.APPEALS.EDIT` etc |
| `AdminGrievances.tsx` | Use JWT permissions |
| `AdminProgrammes.tsx` | Use JWT permissions |
| `AdminArchived.tsx` | Use JWT permissions |
| `AdminAuditLogs.tsx` | Use JWT permissions |
| `AdminAdmins.tsx` | Use `ADMIN.ACCESS.MANAGE_PERMISSIONS` |
| `AdminCaseWorkers.tsx` | Use JWT permissions |
| `AdminCaseWorkerDetail.tsx` | Use JWT permissions |
| `AdminRoleManagement.tsx` | Use `ADMIN.ROLES.MANAGE_PERMISSIONS` |

---

## Permission Matrix

### SuperAdmin (47 permissions)
All `ADMIN.*` permissions including:
- `ADMIN.ROLES.MANAGE_PERMISSIONS`
- `ADMIN.ACCESS.MANAGE_PERMISSIONS`
- `ADMIN.USERS.DELETE`
- etc.

### Admin (varies by configuration)
Subset of `ADMIN.*` permissions, typically:
- `ADMIN.FAMILIES.*`
- `ADMIN.PROGRAMMES.*`
- `ADMIN.GRIEVANCES.*`
- NO role management

### CaseWorker
- `ADMIN.FAMILIES.VIEW`
- `ADMIN.GRIEVANCES.VIEW`, `ADMIN.GRIEVANCES.EDIT`
- `ADMIN.CASEWORKERS.VIEW`

### Citizen
All `CITIZEN.*` permissions:
- `CITIZEN.DASHBOARD.VIEW`
- `CITIZEN.FAMILY.VIEW`, `CITIZEN.FAMILY.EDIT`
- `CITIZEN.DOCUMENTS.*`
- etc.

---

## Testing Checklist

### SuperAdmin User
1. ✅ Login → sees Admin Dashboard (has ADMIN.* prefix)
2. ✅ Can access Role Management (`ADMIN.ROLES.MANAGE_PERMISSIONS`)
3. ✅ Sidebar shows Admin section
4. ❌ Should NOT see Citizen section (unless granted)

### Admin User
1. ✅ Login → sees Admin Dashboard
2. ❌ Cannot access Role Management (no `ADMIN.ROLES.MANAGE_PERMISSIONS`)
3. ✅ Can edit families if has `ADMIN.FAMILIES.EDIT`

### Citizen User
1. ✅ Login → sees Citizen Dashboard
2. ✅ Sidebar shows Citizen section only
3. ❌ Cannot access any `/admin/*` routes

### Token Refresh Testing
1. Remove permission from role via Role Management
2. User MUST log out and back in to see changes
3. Stale token should still show old permissions until refresh

---

## Backend Enforcement (TODO)

The backend MUST also enforce permissions:
```typescript
// iam-service middleware
function requirePermission(permission: string) {
  return (req, res, next) => {
    const userPerms = req.user.permissions || []
    if (!userPerms.includes(permission)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    next()
  }
}

// Usage
app.put('/families/:id', 
  requirePermission('ADMIN.FAMILIES.EDIT'),
  familyController.update
)
```

---

## Known Issues / Future Work

1. **Token Staleness**: When permissions are changed, users must re-login. Consider implementing token refresh or permission invalidation.

2. **Mock Data**: Some admin pages still use mock data from `superAdminMockData.ts`. The mock `hasPermission` function there is no longer used, but the mock data arrays remain for UI development.

3. **Backend Audit**: Need to audit backend routes to ensure they also check JWT permissions, not role names.
