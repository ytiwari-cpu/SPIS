# Auth Bypass — Developer Reference

> **Purpose:** This file documents every change made to bypass authentication for local development.
> When you say _"refer AUTH_BYPASS.md"_, revert or re-apply all the changes listed here.

---

## Current State: BYPASS ACTIVE

All 7 changes below are currently applied. To restore real auth, revert each one as described.

---

## Changes Made

### 1. `backend/iam-service/src/middleware/auth.ts`

**What changed:** `requireAuth()` factory replaced with a no-op that injects a fake user.

**Current (bypass):**
```ts
export function requireAuth() {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.user = { sub: 'bypass', national_id: 'bypass', roles: ['SuperAdmin'], permissions: [] }
    next()
  }
}
```

**Revert to (real):**
```ts
export function requireAuth() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing bearer token' } })
      return
    }
    const token = authHeader.slice(7)
    try {
      const { payload } = await jwtVerify(token, secretKey, {
        issuer: config.jwt.issuer,
        audience: config.jwt.audience,
      })
      if (payload.iat && payload.iat < config.jwt.serverStartTime) {
        res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Token invalidated by server restart' } })
        return
      }
      req.user = {
        sub: payload.sub as string,
        national_id: payload.national_id as string | undefined,
        email: payload.email as string | undefined,
        roles: payload.roles as string[] | undefined,
        permissions: payload.permissions as string[] | undefined,
      }
      next()
    } catch (err) {
      const message = (err as Error).name === 'JWTExpired' ? 'Token has expired' : (err as Error).message
      logger.warn('JWT validation failed', { error: message })
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message } })
    }
  }
}
```

---

### 2. `backend/family-service/src/middleware/requireAuth.ts`

**What changed:** `requireAuth` replaced with a no-op that injects a fake user.

**Current (bypass):**
```ts
// ── DEV BYPASS: always passes through ──
export function requireAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): void {
  req.user = { sub: 'bypass', national_id: 'bypass', roles: ['SuperAdmin'], permissions: [] }
  next()
}
```

**Revert to (real):**
```ts
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Authentication required. Provide a valid Bearer token.' })
    return
  }
  const token = authHeader.slice(7)
  try {
    const { payload } = await jwtVerify(token, secretKey, { issuer: JWT_ISSUER, audience: JWT_AUDIENCE })
    const tokenIssuedAt = (payload.iat as number) * 1000
    if (tokenIssuedAt < SERVER_START_TIME) {
      res.status(401).json({ success: false, error: 'Token is no longer valid. Please login again.' })
      return
    }
    req.user = {
      sub: payload.sub as string,
      national_id: payload.national_id as string,
      email: payload.email as string | undefined,
      roles: payload.roles as string[] | undefined,
      permissions: payload.permissions as string[] | undefined,
    }
    next()
  } catch (err) {
    const message = (err as Error).name === 'JWTExpired'
      ? 'Token has expired. Please login again.'
      : 'Invalid or malformed token.'
    res.status(401).json({ success: false, error: message })
  }
}
```

---

### 3. `backend/programme-service/src/middleware/requireAuth.ts`

**What changed:** Same as family-service — no-op bypass.

**Current (bypass):**
```ts
// ── DEV BYPASS: always passes through ──
export function requireAuth(
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction,
): void {
    req.user = { sub: 'bypass', national_id: 'bypass', roles: ['SuperAdmin'], permissions: [] }
    next()
}
```

**Revert to (real):** Same as family-service above (uses identical JWT validation pattern with `JWT_ISSUER`, `JWT_AUDIENCE`, `SERVER_START_TIME`).

---

### 4. `frontend/src/store/authStore.ts`

**What changed — 3 locations in this file:**

#### 4a. Initial state (inside `persist` initializer)

**Current (bypass):** Lines ~39–50
```ts
// ── DEV BYPASS: always authenticated ──────────────────────────────
isAuthenticated: true,
session: {
  access_token: 'bypass-token',
  uuid: 'bypass-uuid',
  user_id: 'bypass-uuid',
  family_id: 'bypass-family-id',
  email: 'bypass@dev.local',
  roles: ['SuperAdmin'],
  permissions: [],
} as unknown as AuthSession,
// ── END BYPASS ────────────────────────────────────────────────────
```

**Revert to (real):**
```ts
isAuthenticated: false,
session: null,
```

#### 4b. `onRehydrateStorage` in persist config (forces bypass after every page reload)

**Current (bypass):** Inside the persist config object `{ name: 'spis-auth-storage', ... }`
```ts
// ── DEV BYPASS: force bypass state after every rehydration ──
onRehydrateStorage: () => (rehydratedState) => {
  if (rehydratedState) {
    rehydratedState.isAuthenticated = true
    rehydratedState.session = {
      access_token: 'bypass-token',
      uuid: 'bypass-uuid',
      user_id: 'bypass-uuid',
      family_id: 'bypass-family-id',
      email: 'bypass@dev.local',
      roles: ['SuperAdmin'],
      permissions: [],
    } as unknown as AuthSession
    rehydratedState.user = { uuid: 'bypass-uuid', family_id: 'bypass-family-id', name: 'Dev Bypass' }
  }
},
// ── END BYPASS ──
```

**Revert to (real):** Delete the entire `onRehydrateStorage` block.

#### 4c. `useAuthStore.setState(...)` call after store definition

**Current (bypass):** ~Line 172 (after the `useAuthStore = create(...)` block closes)
```ts
// ── DEV BYPASS: override any persisted auth state so bypass is always active ──
useAuthStore.setState({
  isAuthenticated: true,
  session: {
    access_token: 'bypass-token',
    uuid: 'bypass-uuid',
    user_id: 'bypass-uuid',
    family_id: 'bypass-family-id',
    email: 'bypass@dev.local',
    roles: ['SuperAdmin'],
    permissions: [],
  } as unknown as AuthSession,
  user: { uuid: 'bypass-uuid', family_id: 'bypass-family-id', name: 'Dev Bypass' },
})
// ── END BYPASS ──
```

**Revert to (real):** Delete this entire block.

#### 4d. `hasPermission` function inside the store

**Current (bypass):** Returns `true` for SuperAdmin role
```ts
hasPermission: (permission: string): boolean => {
  const session = get().session
  if (!session) return false
  // SuperAdmin has all permissions
  if (Array.isArray(session.roles) && session.roles.includes('SuperAdmin')) return true
  if (!session.permissions || !Array.isArray(session.permissions)) return false
  return session.permissions.includes(permission)
},
```

**Revert to (real):**
```ts
hasPermission: (permission: string): boolean => {
  const session = get().session
  if (!session || !session.permissions) return false
  if (!Array.isArray(session.permissions)) return false
  return session.permissions.includes(permission)
},
```

---

### 5. `frontend/src/App.tsx`

**What changed:** Added early return to skip JWT validation when using the bypass token.

**Current (bypass):** ~Lines 37–39
```ts
// ── DEV BYPASS: skip token validation ──
if (session.access_token === 'bypass-token') return
// ── END BYPASS ──
```

**Revert to (real):** Delete those 3 lines.

---

### 6. `frontend/src/services/api.ts`

**What changed:** 401 response handler that redirects to `/login` is commented out.

**Current (bypass):** ~Lines 52–55
```ts
// ── DEV BYPASS: 401 redirect disabled ──────────────────────────────
// if (error.response?.status === 401 && !globalThis.location.pathname.includes('/login')) {
//   localStorage.removeItem('spis-auth-storage')
//   globalThis.location.href = '/login'
```

**Revert to (real):** Uncomment those 3 lines (remove the `//` prefix from the `if` block).

---

### 7. `frontend/src/components/PermissionGuard.tsx`

**What changed:** Guard now allows SuperAdmin role to pass regardless of permission.

**Current (bypass/superadmin-aware):**
```tsx
export default function PermissionGuard({ permission, children }: PermissionGuardProps) {
  const { hasPermission, hasRole } = useAuthStore()

  // SuperAdmin has access to everything
  if (hasRole('SuperAdmin') || hasPermission(permission)) {
    return <>{children}</>
  }

  return <ForbiddenPage requiredPermission={permission} />
}
```

**Revert to (real):**
```tsx
export default function PermissionGuard({ permission, children }: PermissionGuardProps) {
  const { hasPermission } = useAuthStore()

  if (!hasPermission(permission)) {
    return <ForbiddenPage requiredPermission={permission} />
  }

  return <>{children}</>
}
```

> **Note:** `frontend/src/lib/auth.ts` also has SuperAdmin short-circuits in `hasPermission`, `hasAnyPermission`, `hasAllPermissions`, `hasPermissionPrefix`, and `usePermissions`. These were added to support real SuperAdmin users from the DB — they are **not purely bypass code** and should be kept even after reverting the bypass.

---

## Quick Checklist for Reverting

| # | File | Action |
|---|------|--------|
| 1 | `backend/iam-service/src/middleware/auth.ts` | Restore full `async` JWT validation in `requireAuth()` |
| 2 | `backend/family-service/src/middleware/requireAuth.ts` | Restore full `async` JWT validation |
| 3 | `backend/programme-service/src/middleware/requireAuth.ts` | Restore full `async` JWT validation |
| 4a | `frontend/src/store/authStore.ts` | Change `isAuthenticated: true` → `false`, `session: {...bypass}` → `null` |
| 4b | `frontend/src/store/authStore.ts` | Delete `onRehydrateStorage` block from persist config |
| 4c | `frontend/src/store/authStore.ts` | Delete `useAuthStore.setState(...)` block after store definition |
| 4d | `frontend/src/store/authStore.ts` | Remove SuperAdmin short-circuit from `hasPermission` |
| 5 | `frontend/src/App.tsx` | Delete the 3-line `bypass-token` early return |
| 6 | `frontend/src/services/api.ts` | Uncomment the 401 redirect block |
| 7 | `frontend/src/components/PermissionGuard.tsx` | Remove `hasRole('SuperAdmin')` check, revert to original |

After reverting, also run in browser console:
```js
localStorage.removeItem('spis-auth-storage')
```
to clear any cached bypass session.
