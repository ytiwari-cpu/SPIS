# SPIS Authentication & Authorization Flow

## Complete End-to-End Documentation

**Version:** 2.0  
**Last Updated:** February 20, 2026  
**Status:** Production Ready

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Component Diagram](#component-diagram)
3. [Authentication Flow](#authentication-flow)
4. [Authorization Model](#authorization-model)
5. [Token Structure](#token-structure)
6. [Frontend Implementation](#frontend-implementation)
7. [Backend Implementation](#backend-implementation)
8. [Security Considerations](#security-considerations)
9. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SPIS ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │   Frontend   │───▶│ Family Svc   │───▶│   IAM Svc    │                  │
│  │  (React SPA) │    │   :3001      │    │    :3003     │                  │
│  └──────────────┘    └──────────────┘    └──────────────┘                  │
│         │                   │                   │                           │
│         │                   │                   │                           │
│         ▼                   ▼                   ▼                           │
│  ┌──────────────────────────────────────────────────────┐                  │
│  │                 Supabase PostgreSQL                   │                  │
│  │  ┌─────────────────┐  ┌─────────────────┐           │                  │
│  │  │  authz schema   │  │  audit schema   │           │                  │
│  │  │  - permission   │  │  - security_log │           │                  │
│  │  │  - role         │  │                 │           │                  │
│  │  │  - user_role    │  │                 │           │                  │
│  │  │  - role_perm    │  │                 │           │                  │
│  │  └─────────────────┘  └─────────────────┘           │                  │
│  └──────────────────────────────────────────────────────┘                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Principles

| Principle | Description |
|-----------|-------------|
| **Permission-Only Authorization** | ALL access decisions use permissions, NEVER role names |
| **Role Names = Labels** | Roles can be renamed/removed without code changes |
| **Signed Token Authority** | JWT is the source of truth, not localStorage |
| **Backend Enforcement** | Frontend checks are UX-only; backend enforces |

---

## Component Diagram

```
                           ┌────────────────────────────────────────┐
                           │           FRONTEND (React)             │
                           │                                        │
                           │  ┌──────────────────────────────────┐ │
                           │  │         LoginPage.tsx             │ │
                           │  │  - Collects national_id + password│ │
                           │  │  - Calls POST /api/v1/auth/login  │ │
                           │  └──────────────────────────────────┘ │
                           │                  │                     │
                           │                  ▼                     │
                           │  ┌──────────────────────────────────┐ │
                           │  │         authStore.ts              │ │
                           │  │  - Stores session in Zustand      │ │
                           │  │  - Persists to sessionStorage     │ │
                           │  │  - Provides hasPermission()       │ │
                           │  └──────────────────────────────────┘ │
                           │                  │                     │
                           │                  ▼                     │
                           │  ┌──────────────────────────────────┐ │
                           │  │      lib/auth.ts                  │ │
                           │  │  - Permission check utilities     │ │
                           │  │  - hasPermission()                │ │
                           │  │  - hasAnyPermission()             │ │
                           │  │  - hasPermissionPrefix()          │ │
                           │  └──────────────────────────────────┘ │
                           │                  │                     │
                           │                  ▼                     │
                           │  ┌──────────────────────────────────┐ │
                           │  │      navConfig.ts                 │ │
                           │  │  - Menu items with                │ │
                           │  │    requiredPermission             │ │
                           │  └──────────────────────────────────┘ │
                           │                  │                     │
                           │                  ▼                     │
                           │  ┌──────────────────────────────────┐ │
                           │  │      PermissionGuard.tsx          │ │
                           │  │  - Route-level protection         │ │
                           │  │  - Shows ForbiddenPage if denied  │ │
                           │  └──────────────────────────────────┘ │
                           └────────────────────────────────────────┘
                                             │
                                             │ HTTP + Bearer Token
                                             ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                        FAMILY SERVICE (:3001)                               │
│                                                                             │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐     │
│  │ auth.routes.ts   │───▶│ requireAuth.ts   │───▶│ Supabase Client  │     │
│  │ POST /login      │    │ JWT validation   │    │ Family data      │     │
│  │ GET /me          │    │ Extract user     │    │                  │     │
│  └──────────────────┘    │ + permissions    │    │                  │     │
│                          └──────────────────┘    └──────────────────┘     │
│           │                                                                │
│           │ Proxy auth to IAM                                             │
│           ▼                                                                │
└────────────────────────────────────────────────────────────────────────────┘
                                             │
                                             │ Internal HTTP
                                             ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                         IAM SERVICE (:3003)                                 │
│                                                                             │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐     │
│  │ login.routes.ts  │───▶│ login.ts service │───▶│ repository.ts    │     │
│  │ POST /iam/login  │    │ Verify password  │    │ Get user roles   │     │
│  │                  │    │ Build JWT        │    │ Get permissions  │     │
│  └──────────────────┘    │ Include perms    │    │                  │     │
│                          └──────────────────┘    └──────────────────┘     │
│                                   │                                        │
│                                   ▼                                        │
│                          ┌──────────────────┐                              │
│                          │ Sign JWT (HS256) │                              │
│                          │ Include:         │                              │
│                          │  - sub           │                              │
│                          │  - national_id   │                              │
│                          │  - roles[]       │                              │
│                          │  - permissions[] │ ◀── KEY CLAIM                │
│                          └──────────────────┘                              │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Authentication Flow

### Sequence Diagram

```
┌────────┐     ┌─────────────┐     ┌─────────────┐     ┌──────────┐
│ User   │     │  Frontend   │     │Family Svc   │     │ IAM Svc  │
└───┬────┘     └──────┬──────┘     └──────┬──────┘     └────┬─────┘
    │                 │                   │                 │
    │ Enter ID + Pass │                   │                 │
    │────────────────▶│                   │                 │
    │                 │                   │                 │
    │                 │ POST /auth/login  │                 │
    │                 │──────────────────▶│                 │
    │                 │                   │                 │
    │                 │                   │ POST /iam/login │
    │                 │                   │────────────────▶│
    │                 │                   │                 │
    │                 │                   │  Verify creds   │
    │                 │                   │  Get user roles │
    │                 │                   │  Get permissions│
    │                 │                   │  Sign JWT       │
    │                 │                   │◀────────────────│
    │                 │                   │  { token,       │
    │                 │                   │    roles[],     │
    │                 │                   │    permissions[]│
    │                 │                   │  }              │
    │                 │                   │                 │
    │                 │ Check admin perms │                 │
    │                 │ (ADMIN.* prefix)  │                 │
    │                 │◀──────────────────│                 │
    │                 │                   │                 │
    │                 │ { token,          │                 │
    │                 │   permissions[],  │                 │
    │                 │   is_staff: true  │                 │
    │                 │ }                 │                 │
    │                 │                   │                 │
    │                 │ Store in Zustand  │                 │
    │                 │ (sessionStorage)  │                 │
    │                 │                   │                 │
    │ Redirect to     │                   │                 │
    │ /dashboard      │                   │                 │
    │◀────────────────│                   │                 │
    │                 │                   │                 │
```

### Step-by-Step Flow

#### 1. User Enters Credentials

```typescript
// frontend/src/pages/public/LoginPage.tsx
const handleSubmit = async () => {
  const response = await authApi.login(nationalId, password)
  // response.data contains:
  // - access_token: string
  // - roles: string[]
  // - permissions: string[]  <-- CRITICAL
  // - user_id, email, etc.
}
```

#### 2. Frontend Stores Session

```typescript
// frontend/src/store/authStore.ts
login: (session: AuthSession) => {
  set({
    isAuthenticated: true,
    session,  // Contains permissions[]
    error: null,
  })
}
```

#### 3. Backend Validates & Enriches

```typescript
// backend/family-service/src/routes/auth.routes.ts

// Call IAM service
const tokenResult = await authenticateWithIAM(nationalId, password)

// Check permissions (NOT role names) to determine user type
const permissions = tokenResult.data.permissions || []
const hasAdminPermissions = permissions.some(p => p.startsWith('ADMIN.'))

if (hasAdminPermissions) {
  // Staff user - return auth data only
  return { ...authData, permissions, is_staff: true }
}

// Citizen user - enrich with family data
const family = await supabase.from('family')...
return { ...authData, permissions, ...family }
```

#### 4. IAM Service Signs JWT

```typescript
// backend/iam-service/src/services/login.ts
const payload = {
  sub: user.id,
  national_id: user.national_id,
  email: user.email,
  roles: userRoles,           // For display only
  permissions: userPermissions, // FOR AUTHORIZATION
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 86400,
}

const token = await new SignJWT(payload)
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuer('spis-iam')
  .setAudience('spis')
  .sign(secretKey)
```

---

## Authorization Model

### Permission Structure

```
SECTION.RESOURCE.ACTION

Examples:
  ADMIN.FAMILIES.VIEW
  ADMIN.FAMILIES.CREATE
  ADMIN.FAMILIES.EDIT
  ADMIN.FAMILIES.DELETE
  CITIZEN.PROFILE.VIEW
  CITIZEN.DOCUMENTS.UPLOAD
```

### Permission Hierarchy

```
ADMIN
├── OVERVIEW
│   └── VIEW
├── FAMILIES
│   ├── VIEW
│   ├── CREATE
│   ├── EDIT
│   ├── DELETE
│   ├── EXPORT
│   └── ARCHIVE
├── PROGRAMMES
│   ├── VIEW
│   ├── CREATE
│   ├── EDIT
│   ├── DELETE
│   ├── EXPORT
│   └── ASSIGN
├── USERS
│   ├── VIEW
│   ├── CREATE
│   ├── EDIT
│   ├── DELETE
│   └── SUSPEND
├── ROLES
│   ├── VIEW
│   ├── CREATE
│   ├── EDIT
│   ├── DELETE
│   └── MANAGE_PERMISSIONS
└── AUDITLOGS
    ├── VIEW
    └── EXPORT

CITIZEN
├── DASHBOARD
│   └── VIEW
├── FAMILY
│   ├── VIEW
│   └── EDIT
├── PROFILE
│   ├── VIEW
│   └── EDIT
├── DOCUMENTS
│   ├── VIEW
│   ├── UPLOAD
│   └── DELETE
└── GRIEVANCES
    ├── VIEW
    └── CREATE
```

---

## Token Structure

### JWT Payload

```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "national_id": "11333355555578",
  "email": "superadmin@spis.gov",
  "roles": ["SuperAdmin"],
  "permissions": [
    "ADMIN.OVERVIEW.VIEW",
    "ADMIN.FAMILIES.VIEW",
    "ADMIN.FAMILIES.CREATE",
    "ADMIN.FAMILIES.EDIT",
    "ADMIN.FAMILIES.DELETE",
    "ADMIN.FAMILIES.EXPORT",
    "ADMIN.FAMILIES.ARCHIVE",
    "ADMIN.PROGRAMMES.VIEW",
    "ADMIN.ROLES.VIEW",
    "ADMIN.ROLES.MANAGE_PERMISSIONS",
    "ADMIN.AUDITLOGS.VIEW"
  ],
  "iat": 1708444800,
  "exp": 1708531200,
  "iss": "spis-iam",
  "aud": "spis"
}
```

### Storage Location

| Storage | What | Why |
|---------|------|-----|
| `sessionStorage` | Full session object | Cleared on tab close |
| Memory (Zustand) | Session + computed state | Fast access |
| Never localStorage | - | Persists across sessions, security risk |

### Why Not Trust localStorage

```typescript
// ❌ DANGEROUS - user can tamper
const user = JSON.parse(localStorage.getItem('user'))
if (user.role === 'SuperAdmin') { showAdminPanel() }

// ✅ SAFE - permissions from signed JWT
const session = useAuthStore.getState().session
const permissions = session?.permissions || []
if (permissions.includes('ADMIN.FAMILIES.VIEW')) { showFamilies() }
```

---

## Frontend Implementation

### Key Files

| File | Purpose |
|------|---------|
| `lib/auth.ts` | Permission check utilities |
| `store/authStore.ts` | Session state management |
| `config/navConfig.ts` | Menu items with required permissions |
| `components/PermissionGuard.tsx` | Route protection |
| `layouts/AppLayout.tsx` | Sidebar rendering |

### Permission Check Utilities

```typescript
// frontend/src/lib/auth.ts

export function getPermissions(): string[] {
  const session = useAuthStore.getState().session
  return session?.permissions || []
}

export function hasPermission(permission: string): boolean {
  return getPermissions().includes(permission)
}

export function hasAnyPermission(permissions: string[]): boolean {
  const userPerms = getPermissions()
  return permissions.some(p => userPerms.includes(p))
}

export function hasPermissionPrefix(prefix: string): boolean {
  return getPermissions().some(p => p.startsWith(prefix))
}
```

### Navigation Config

```typescript
// frontend/src/config/navConfig.ts

export const navConfig: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { 
    path: '/admin/families', 
    label: 'Families', 
    icon: 'family_restroom',
    requiredPermission: 'ADMIN.FAMILIES.VIEW'  // Permission, not role
  },
  // ...
]
```

### Route Guard

```typescript
// frontend/src/components/PermissionGuard.tsx

export default function PermissionGuard({ permission, children }) {
  const { hasPermission } = useAuthStore()
  
  if (!hasPermission(permission)) {
    return <ForbiddenPage requiredPermission={permission} />
  }
  
  return <>{children}</>
}

// Usage in App.tsx
<Route path="/admin/families" element={
  <PermissionGuard permission="ADMIN.FAMILIES.VIEW">
    <AdminFamilies />
  </PermissionGuard>
} />
```

---

## Backend Implementation

### Key Files

| File | Purpose |
|------|---------|
| `middleware/requireAuth.ts` | JWT validation, extracts user |
| `middleware/auth.ts` | Permission check middleware |
| `routes/admin.routes.ts` | Protected admin endpoints |
| `services/login.ts` | JWT generation with permissions |

### JWT Validation Middleware

```typescript
// backend/family-service/src/middleware/requireAuth.ts

export async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.slice(7)
  
  const { payload } = await jwtVerify(token, secretKey, {
    issuer: 'spis-iam',
    audience: 'spis',
  })
  
  req.user = {
    sub: payload.sub,
    national_id: payload.national_id,
    roles: payload.roles,
    permissions: payload.permissions,  // CRITICAL
  }
  
  next()
}
```

### Permission Check Middleware

```typescript
// backend/iam-service/src/middleware/auth.ts

export function requirePermissions(...permissions: string[]) {
  return (req, res, next) => {
    const userPermissions = req.user?.permissions || []
    const hasPermission = permissions.some(p => userPermissions.includes(p))
    
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: `Requires one of: ${permissions.join(', ')}`,
      })
    }
    next()
  }
}

// Usage
adminRouter.use(requireAuth(), requirePermissions('ADMIN.ROLES.VIEW'))
```

---

## Security Considerations

### Token Lifecycle

| Event | Action |
|-------|--------|
| Login | Issue new JWT with current permissions |
| Role change | User must re-login to get new permissions |
| Server restart | All tokens issued before restart are invalid |
| Session close | sessionStorage cleared, user must re-login |

### Permission Changes

When an admin changes a user's role permissions:

1. The change is persisted to database immediately
2. User's existing JWT still has old permissions
3. User must re-login (or call refresh endpoint)
4. New JWT will have updated permissions

```typescript
// Optional: Refresh permissions without full re-login
// frontend/src/store/authStore.ts

refreshPermissions: async () => {
  const { getMyPermissions } = await import('@/services/rbacApi')
  const permissions = await getMyPermissions()
  
  set({
    session: { ...currentSession, permissions },
  })
}
```

---

## Troubleshooting

### Empty Sidebar After Login

**Symptoms:** User logs in successfully but sidebar shows no menu items.

**Diagnostic Steps:**

```typescript
// 1. Check sessionStorage
const stored = JSON.parse(sessionStorage.getItem('spis-auth-storage'))
console.log('Session:', stored?.state?.session)
console.log('Permissions:', stored?.state?.session?.permissions)

// 2. Decode JWT manually
const token = stored?.state?.session?.access_token
const payload = JSON.parse(atob(token.split('.')[1]))
console.log('JWT permissions:', payload.permissions)

// 3. Check navConfig requirements
import { navConfig } from '@/config/navConfig'
navConfig.forEach(item => {
  if (item.requiredPermission) {
    const has = payload.permissions?.includes(item.requiredPermission)
    console.log(`${item.label}: ${has ? '✓' : '✗'} (needs ${item.requiredPermission})`)
  }
})
```

**Common Causes:**

| Cause | Solution |
|-------|----------|
| IAM not returning permissions | Check `login.ts` includes permissions in JWT |
| Family service not forwarding | Check `auth.routes.ts` includes permissions in response |
| Frontend not storing | Check `authStore.login()` stores permissions |
| Case mismatch | Ensure UPPERCASE throughout |
| Race condition | Add loading state check |

### 403 Forbidden on API Call

**Diagnostic Steps:**

```bash
# 1. Check what permissions the user has
curl -H "Authorization: Bearer $TOKEN" http://localhost:3003/iam/admin/me/permissions

# 2. Check what permission the endpoint requires
# Look at the route definition in admin.routes.ts

# 3. Compare
```

### Token Rejected After Server Restart

This is expected behavior. The IAM service invalidates tokens issued before the current server start time.

**Solution:** Re-login to get a fresh token.

### Stale Permissions After Role Change

If an admin changes a user's role, the user's current session still has old permissions.

**Solution:** User must:
1. Log out and log back in, OR
2. Call `authStore.refreshPermissions()` if implemented

---

## Code Pointers

### Frontend

| File | Key Functions |
|------|---------------|
| [lib/auth.ts](frontend/src/lib/auth.ts) | `hasPermission()`, `getPermissions()` |
| [store/authStore.ts](frontend/src/store/authStore.ts) | `login()`, `hasPermission()` |
| [config/navConfig.ts](frontend/src/config/navConfig.ts) | Navigation items with permissions |
| [layouts/AppLayout.tsx](frontend/src/layouts/AppLayout.tsx) | Sidebar filtering |
| [components/PermissionGuard.tsx](frontend/src/components/PermissionGuard.tsx) | Route guard |

### Backend

| File | Key Functions |
|------|---------------|
| [family-service/middleware/requireAuth.ts](backend/family-service/src/middleware/requireAuth.ts) | JWT validation |
| [family-service/routes/auth.routes.ts](backend/family-service/src/routes/auth.routes.ts) | Login endpoint |
| [iam-service/middleware/auth.ts](backend/iam-service/src/middleware/auth.ts) | `requirePermissions()` |
| [iam-service/services/login.ts](backend/iam-service/src/services/login.ts) | JWT generation |
| [iam-service/db/repository.ts](backend/iam-service/src/db/repository.ts) | Permission queries |

---

## Summary

| Layer | Authorization Method |
|-------|---------------------|
| Frontend Sidebar | `navConfig.requiredPermission` + `hasPermission()` |
| Frontend Routes | `<PermissionGuard permission="...">` |
| Frontend Actions | `hasPermission()` to show/hide buttons |
| Backend Routes | `requirePermissions('...')` middleware |
| Database | `authz.v_user_permissions` view |

**Golden Rule:** If you're checking a role name for authorization, you're doing it wrong.
