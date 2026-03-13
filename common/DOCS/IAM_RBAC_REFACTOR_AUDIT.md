# RBAC Deep Audit & Refactor Report

## Deliverable A — Role-Name Usage Elimination Report

### Executive Summary

**Audit Date:** February 20, 2026  
**Status:** 🔴 **CRITICAL VIOLATIONS FOUND** — Requires immediate fixes

The codebase has made good progress toward permission-only authorization, but **several critical role-name checks remain** that violate the core principle.

---

## A1. Role-Name Usage Audit Results

### 🔴 CRITICAL — Authorization Logic Using Role Names

| File | Line | Code Pattern | Risk Level |
|------|------|--------------|------------|
| `backend/family-service/src/routes/auth.routes.ts` | 235-239 | `isWorker = roles.some(role => role === 'SuperAdmin' \|\| role === 'Admin' \|\| ...)` | **CRITICAL** |
| `backend/family-service/src/routes/citizens.routes.ts` | 17-18 | `isAdmin = roles.some((r) => r === 'Admin' \|\| r === 'SuperAdmin')` | **CRITICAL** |
| `backend/iam-service/src/routes/admin.routes.ts` | 68 | `requireRoles('SuperAdmin', 'Admin')` | **CRITICAL** |
| `backend/iam-service/src/middleware/auth.ts` | 93-106 | `requireRoles()` function exists and is used | **CRITICAL** |

### 🟡 WARNING — Role Names in Types/Scripts (Lower Risk)

| File | Line | Code Pattern | Risk Level |
|------|------|--------------|------------|
| `backend/iam-service/src/types.ts` | 11 | `RoleName = 'Citizen' \| 'CaseWorker' \| ...` | Medium (type def) |
| `backend/iam-service/src/scripts/createSuperAdmin.ts` | Various | `addRole(userId, 'SuperAdmin')` | Low (bootstrap script) |
| `frontend/src/store/authStore.ts` | 93 | `hasRole()` function exists | Medium (should deprecate) |
| `frontend/src/mock/superAdminMockData.ts` | 797 | `admin.role === 'SuperAdmin'` | Low (mock data) |

### ✅ GOOD — Permission-Only Patterns Found

| File | Pattern | Status |
|------|---------|--------|
| `frontend/src/lib/auth.ts` | `hasPermission()`, `hasAny()`, `hasAll()`, `hasPrefix()` | ✅ Correct |
| `frontend/src/config/navConfig.ts` | `requiredPermission: 'ADMIN.FAMILIES.VIEW'` | ✅ Correct |
| `frontend/src/components/PermissionGuard.tsx` | `hasPermission(permission)` | ✅ Correct |
| `frontend/src/pages/superadmin/*.tsx` | All use `hasPermission()` from authStore | ✅ Correct |
| `backend/iam-service/src/middleware/auth.ts` | `requirePermissions()` function | ✅ Correct (unused!) |

---

## A2. Required Fixes

### Fix 1: Backend `auth.routes.ts` — Remove Worker Role Check

**File:** `backend/family-service/src/routes/auth.routes.ts`  
**Lines:** 234-251

**Current (BAD):**
```typescript
const roles = (tokenData.roles as string[]) || []
const isWorker = roles.some(role =>
  role === 'SuperAdmin' || role === 'Admin' || role === 'CaseWorker' || role === 'ProgrammeManager'
)
if (isWorker) { ... }
```

**Fixed (GOOD):**
```typescript
// Check for ADMIN.* permissions instead of role names
const permissions = (tokenData.permissions as string[]) || []
const hasAdminPermissions = permissions.some(p => p.startsWith('ADMIN.'))

if (hasAdminPermissions) {
  // Staff users don't need family enrichment
  return res.json({
    success: true,
    data: {
      auth_mode: 'iam_national_id',
      national_id: cleanNationalId,
      access_token: tokenData.access_token,
      user_id: tokenData.user_id,
      email: tokenData.email,
      roles: tokenData.roles,
      permissions: tokenData.permissions,  // ALWAYS include permissions
      is_staff: true,
      is_new_user: tokenData.is_new_user,
    },
  })
}
```

---

### Fix 2: Backend `citizens.routes.ts` — Use Permission Guard

**File:** `backend/family-service/src/routes/citizens.routes.ts`  
**Lines:** 14-24

**Current (BAD):**
```typescript
function requireAdminRole(req, res, next) {
  const roles = req.user?.roles || []
  const isAdmin = roles.some((r) => r === 'Admin' || r === 'SuperAdmin')
  if (!isAdmin) { return res.status(403).json(...) }
  next()
}
```

**Fixed (GOOD):**
```typescript
import { requirePermissions } from '../middleware/requireAuth.js'

// Replace role guard with permission guard
// citizensRouter.use(requireAdminRole)  // DELETE THIS
citizensRouter.use(requirePermissions('ADMIN.USERS.VIEW'))  // ADD THIS
```

Or create generic permission middleware in family-service:

```typescript
function requirePermission(permission: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const permissions = req.user?.permissions || []
    if (!permissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden — requires permission: ${permission}`,
      })
    }
    next()
  }
}

citizensRouter.use(requirePermission('ADMIN.USERS.VIEW'))
```

---

### Fix 3: Backend IAM Admin Routes — Use Permission Guard

**File:** `backend/iam-service/src/routes/admin.routes.ts`  
**Line:** 68

**Current (BAD):**
```typescript
adminRouter.use(requireAuth(), requireRoles('SuperAdmin', 'Admin'))
```

**Fixed (GOOD):**
```typescript
adminRouter.use(requireAuth(), requirePermissions('ADMIN.ROLES.VIEW'))
// Or more granular per-route:
// adminRouter.get('/users', requirePermissions('ADMIN.USERS.VIEW'), ...)
// adminRouter.post('/users', requirePermissions('ADMIN.USERS.CREATE'), ...)
```

---

### Fix 4: Deprecate `requireRoles()` Function

**File:** `backend/iam-service/src/middleware/auth.ts`  
**Lines:** 93-106

Add deprecation warning:

```typescript
/**
 * @deprecated Use requirePermissions() instead.
 * Role-based checks violate permission-only authorization principle.
 */
export function requireRoles(...roles: string[]) {
  console.warn('DEPRECATED: requireRoles() should not be used for authorization. Use requirePermissions().')
  return (req: Request, res: Response, next: NextFunction) => {
    // ... existing code with warning
  }
}
```

---

### Fix 5: Frontend — Remove `hasRole()` Function

**File:** `frontend/src/store/authStore.ts`  
**Lines:** 88-92

Add deprecation and remove usage:

```typescript
/**
 * @deprecated DO NOT USE for authorization. Use hasPermission() instead.
 * Kept only for displaying role labels in UI.
 */
hasRole: (role: string): boolean => {
  console.warn('DEPRECATED: hasRole() should not be used for authorization checks')
  const roles = get().session?.roles || []
  return roles.includes(role)
},
```

---

### Fix 6: Family-Service — Add Permissions to requireAuth Middleware

**File:** `backend/family-service/src/middleware/requireAuth.ts`  
**Lines:** 63-68

The middleware extracts roles but NOT permissions. Add permissions:

```typescript
req.user = {
  sub: payload.sub as string,
  national_id: payload.national_id as string,
  email: payload.email as string | undefined,
  roles: payload.roles as string[] | undefined,
  permissions: payload.permissions as string[] | undefined,  // ADD THIS
}
```

Also update the interface:

```typescript
export interface AuthenticatedRequest extends Request {
  user?: {
    sub: string
    national_id: string
    email?: string
    roles?: string[]
    permissions?: string[]  // ADD THIS
    [key: string]: unknown
  }
}
```

---

## A3. Verification Checklist

### Frontend Authorization Points

| Location | Check | Status |
|----------|-------|--------|
| `lib/auth.ts` | Uses `session.permissions[]` only | ✅ |
| `store/authStore.ts` | `hasPermission()` checks permissions array | ✅ |
| `config/navConfig.ts` | Uses `requiredPermission` key | ✅ |
| `layouts/AppLayout.tsx` | Filters by `hasPermission()` | ✅ |
| `components/PermissionGuard.tsx` | Guards routes by permission | ✅ |
| All `/pages/superadmin/*.tsx` | Use `hasPermission()` | ✅ |
| `store/authStore.ts` | `hasRole()` exists | ⚠️ Deprecate |

### Backend Authorization Points

| Location | Check | Status |
|----------|-------|--------|
| `iam-service/middleware/auth.ts` | `requirePermissions()` exists | ✅ |
| `iam-service/middleware/auth.ts` | `requireRoles()` exists | ❌ Remove/deprecate |
| `iam-service/routes/admin.routes.ts` | Uses `requireRoles()` | ❌ Fix |
| `family-service/routes/auth.routes.ts` | Checks role names | ❌ Fix |
| `family-service/routes/citizens.routes.ts` | Checks role names | ❌ Fix |
| `family-service/middleware/requireAuth.ts` | Extracts permissions | ❌ Add |

### Token Claim Consistency

| Claim | Expected | Location |
|-------|----------|----------|
| `roles` | `string[]` | JWT payload |
| `permissions` | `string[]` | JWT payload |
| Format | `SECTION.RESOURCE.ACTION` | e.g., `ADMIN.FAMILIES.VIEW` |
| Case | UPPERCASE | Consistent throughout |

---

## A3. Troubleshooting: Empty Sidebar

### Likely Root Causes

1. **Token missing `permissions` claim**
   - Backend login doesn't include permissions in response
   - Check `auth.routes.ts` response structure

2. **Frontend not storing permissions**
   - `authStore.login()` not extracting permissions from response
   - Check `session.permissions` after login

3. **Permission mismatch**
   - navConfig uses `ADMIN.FAMILIES.VIEW`
   - Token has `admin.families.view` (case mismatch)
   - Use consistent UPPERCASE

4. **Race condition**
   - Sidebar renders before permissions loaded
   - Add loading state check

### Debugging Steps

```typescript
// In browser console after login:
const session = JSON.parse(sessionStorage.getItem('spis-auth-storage'))
console.log('Permissions:', session?.state?.session?.permissions)

// Compare with navConfig requirements:
// ADMIN.OVERVIEW.VIEW, ADMIN.FAMILIES.VIEW, etc.
```

---

## File-Level Change Summary

| File | Action | Priority |
|------|--------|----------|
| `backend/family-service/src/routes/auth.routes.ts` | Replace role check with permission check | P0 |
| `backend/family-service/src/routes/citizens.routes.ts` | Replace role guard with permission guard | P0 |
| `backend/family-service/src/middleware/requireAuth.ts` | Add permissions extraction | P0 |
| `backend/iam-service/src/routes/admin.routes.ts` | Replace requireRoles with requirePermissions | P0 |
| `backend/iam-service/src/middleware/auth.ts` | Deprecate requireRoles() | P1 |
| `frontend/src/store/authStore.ts` | Deprecate hasRole() | P2 |
| `frontend/src/mock/superAdminMockData.ts` | Remove role checks | P3 |

---

## Test Cases

### TC1: SuperAdmin Login Shows Full Sidebar
1. Login with SuperAdmin credentials
2. Decode JWT and verify `permissions` contains all `ADMIN.*`
3. Verify sidebar shows all admin items
4. Expected: All items visible and clickable

### TC2: New Role with Same Permissions
1. Create new role "TestAdmin" with same permissions as Admin
2. Create user with TestAdmin role
3. Login and verify sidebar shows same items as Admin
4. Expected: Identical access — role name doesn't matter

### TC3: Permission Removal Reflects Immediately
1. Remove `ADMIN.FAMILIES.VIEW` from SuperAdmin
2. Re-login (or refresh token)
3. Verify "Families" nav item is hidden
4. Expected: Item disappears without code changes

### TC4: Backend Rejects Without Permission
1. Remove `ADMIN.USERS.VIEW` from user
2. Call `GET /api/v1/citizens`
3. Expected: 403 Forbidden with permission message

### TC5: Role Rename Has No Effect
1. Rename "SuperAdmin" to "SystemAdministrator"
2. User logs in
3. Expected: Same access (permissions unchanged)
