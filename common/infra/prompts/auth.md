# Auth Prompts

All prompts given that relate to authentication, session management, token handling, cross-tab sync, and permission enforcement.

---

## 1. Multi-Tab Login Sharing

**Problem:** Logging in on one tab did not carry over to another tab — the second tab asked to log in again.

**Root cause:** `authStore.ts` was using `sessionStorage` as the Zustand persist storage. `sessionStorage` is **tab-isolated by browser design** — each new tab starts with an empty session regardless of what other tabs have stored. Additionally, `App.tsx` was calling `localStorage.removeItem('spis-auth-storage')` on every page load, actively destroying any cross-tab storage.

**Requirement:**
- Same browser profile must share auth session across all tabs automatically.
- Incognito remains separate (this is acceptable and desired — incognito has its own localStorage partition).

**Fix implemented (`src/store/authStore.ts` + `src/App.tsx`):**

1. **Switched persist storage from `sessionStorage` → `localStorage`**
   - `localStorage` is shared across all tabs in the same browser profile.
   - The Zustand `persist` middleware now reads/writes `spis-auth-storage` in `localStorage`.

2. **Added `BroadcastChannel('spis-auth')` for real-time cross-tab sync**
   - `login()` calls `authChannel.postMessage({ type: 'LOGIN' })` after updating state.
   - `logout()` calls `authChannel.postMessage({ type: 'LOGOUT' })` after clearing state.
   - The channel `onmessage` handler in every other tab immediately clears Zustand state on `LOGOUT`.
   - `LOGIN` events are automatically handled by the shared `localStorage` key — Zustand rehydrates on `storage` change.
   - Falls back gracefully (`authChannel` is `null`) on older browsers that don't support `BroadcastChannel`.

3. **Added `window.addEventListener('storage', ...)` as a fallback**
   - Catches changes to `spis-auth-storage` written by other tabs/windows.
   - Parses the new value and hydrates Zustand state so the tab becomes authenticated without reload.
   - Also handles key deletion (e.g. `localStorage.clear()` in another tab) by clearing state.

4. **One-time migration in `App.tsx`**
   - Removed the `localStorage.removeItem('spis-auth-storage')` call that was destroying sessions on load.
   - Added migration code: if a `spis-auth-storage` entry exists in `sessionStorage` (from a previous login), it is copied to `localStorage` once, then deleted from `sessionStorage`.

**Security constraints maintained:**
- Tokens are signed JWTs — even if localStorage is read, a stolen token is only useful from the same origin.
- `hasPermission()` reads from the JWT payload stored in `session.permissions` — never from a plain user-profile field.
- Backend validates every request; frontend guards are UX only.
- Incognito profiles have a fully isolated `localStorage` partition, so sessions do not bleed between normal and incognito windows.

**Verification steps:**
1. Login in tab1 → open tab2 to same URL → tab2 shows the authenticated view without a login prompt. ✅
2. Logout in tab1 → tab2 is also redirected to login within milliseconds. ✅
3. Open incognito window → it shows login page (isolated from normal tabs). ✅
4. Hard-refresh tab2 while tab1 is logged in → still authenticated. ✅

---

## 2. Every API Request Sent Twice

**Problem:** Each API call appears twice in the network tab.

**Tasks:**
- Identify why requests duplicate:
  - React StrictMode double-invoking effects?
  - Two different fetching mechanisms running in parallel?
  - Axios interceptor replaying requests?
  - Retry logic triggering immediately?
- Fix so only one request is sent per user action.
- If StrictMode is the cause, fix effects to be idempotent OR adjust dev behavior — do NOT break production.

**Verification:**
- Before/after proof: network logs with unique request IDs showing duplicates are gone.

---

## 3. Permission-Tree VIEW Dependency Bug

**Problem:** `SYSTEM → EXPORT` requires VIEW permission when other permissions are selected, but SYSTEM → EXPORT has no VIEW child.

**Root cause (identified & fixed):**
- `enforceViewDependency` in `permissionUtils.ts` and `AdminRoleManagement.tsx` listed `'EXPORT'` inside `WRITE_ACTIONS`.
- This caused any EXPORT permission check to auto-add a `*.VIEW` key that doesn't exist in the permission registry.
- Additionally, `SYSTEM.EXPORT.ALL` and `SYSTEM.REPORTS.*` were dead permissions — never guarded by any `hasPermission()` call anywhere in the codebase.

**Fix applied:**
- Removed `'EXPORT'` from `WRITE_ACTIONS` in both `src/utils/permissionUtils.ts` and `src/pages/superadmin/AdminRoleManagement.tsx`. Export is a read-like data action; VIEW is not a prerequisite.
- Removed the entire `SYSTEM → Export` and `SYSTEM → Reports` sections from `src/config/featureCatalogue.ts` (unused).
- Removed `SYSTEM` key from `src/lib/auth.ts` permission constants (unused).

**Constraints:**
- Only enforce "VIEW required" for modules where a `.VIEW` permission actually exists and is meaningful.
- Export/import permissions must never falsely require VIEW.

---

## 4. SYSTEM → Export and SYSTEM → Reports — Were They Needed?

**Answer: No. Both were completely unused.**

| Permission key | Used anywhere? |
|---|---|
| `SYSTEM.EXPORT.ALL` | ❌ No `hasPermission(...)` call anywhere |
| `SYSTEM.REPORTS.VIEW` | ❌ No `hasPermission(...)` call anywhere |
| `SYSTEM.REPORTS.CREATE` | ❌ No `hasPermission(...)` call anywhere |

These were placeholders for a "bulk system export" and a "reports dashboard" that was never built. Removed entirely.

---

## 5. Permission Enforcement Rules (Global)

Rules that apply everywhere across auth and permission logic:

- **Never base access on role names.** Use permission keys only (e.g., `ADMIN.FAMILIES.EDIT`).
- **Do not trust localStorage user objects for authorisation decisions.** Only the signed JWT/token is authoritative.
- **Backend must enforce authorisation.** Frontend guards (hiding buttons, redirect) are UX-only.
- **VIEW is required for write actions** (CREATE, EDIT, DELETE, ARCHIVE, RESTORE, MANAGE) on modules that have a VIEW permission — enforced automatically by `enforceViewDependency`.
- **EXPORT does not require VIEW** — it is a read-like action, not a mutation.

---

## 6. Permission Key Naming Convention

```
MODULE.SUBMODULE.ACTION

Examples:
  ADMIN.FAMILIES.VIEW
  ADMIN.FAMILIES.CREATE
  ADMIN.FAMILIES.EDIT
  ADMIN.FAMILIES.ARCHIVE
  ADMIN.FAMILIES.EXPORT
  ADMIN.ROLES.MANAGE_PERMISSIONS
  ADMIN.AUDITLOGS.EXPORT
```

Actions in `WRITE_ACTIONS` (auto-add VIEW when checked):
`CREATE`, `EDIT`, `DELETE`, `ARCHIVE`, `RESTORE`, `MANAGE`, `ASSIGN`, `REVIEW`, `APPLY`, `MANAGE_PERMISSIONS`

Actions NOT in `WRITE_ACTIONS` (no VIEW dependency):
`EXPORT`, `VIEW` itself
