# SPIS Authorization Reference

> **Scope:** Authorization only — RBAC design, permission checks, and how they are
> enforced in the frontend and backend.

---

## 1. RBAC Setup Prompt

> Paste this to an AI to implement or fix the permission-based authorization system.

```
You are a Senior Full-Stack Engineer working on SPIS Jamaica.

Goal: Implement a pure permission-based RBAC system where role names are NEVER used
for access control. All authorization decisions use permission keys only.

══════════════════════════════════════
CORE DESIGN RULES (NON-NEGOTIABLE)
══════════════════════════════════════
1. NEVER check role names to control access.
   ❌  if (hasRole('Admin')) { ... }
   ✅  if (hasPermission('ADMIN.FAMILIES.EDIT')) { ... }

2. Permissions come from the signed JWT — embedded at login time.
   session.permissions[] from the JWT is the only authoritative source on the frontend.

3. Backend enforces every permission. Frontend checks are UX only (hide/show).

4. SuperAdmin bypasses ALL permission checks automatically via requirePermissions()
   middleware and hasPermission() in the store. No special-casing needed elsewhere.

5. VIEW is required for write actions (CREATE, EDIT, DELETE, ARCHIVE, MANAGE).
   EXPORT does NOT require VIEW — it is a read-like action, not a mutation.

══════════════════════════════════════
PERMISSION KEY FORMAT
══════════════════════════════════════
  MODULE.SUBMODULE.ACTION

  WRITE_ACTIONS (auto-add VIEW when selected):
    CREATE, EDIT, DELETE, ARCHIVE, RESTORE, MANAGE,
    ASSIGN, REVIEW, APPLY, MANAGE_PERMISSIONS

  READ-LIKE (no VIEW dependency):
    VIEW, EXPORT, PUBLISH, RUN

Examples:
  CITIZEN.FAMILY.VIEW
  ADMIN.FAMILIES.EDIT
  ADMIN.ROLES.MANAGE_PERMISSIONS
  PROGRAMME.BENEFICIARIES.ENROLL

══════════════════════════════════════
DATABASE SCHEMA (auth_db — public schema)
══════════════════════════════════════
  permissions       (permission_id UUID PK, permission_key TEXT UNIQUE, description TEXT)
  roles             (role_id UUID PK, role_name TEXT UNIQUE, is_active BOOL)
  role_permissions  (role_id FK, permission_id FK)
  user_roles        (user_id FK, role_id FK)

  At login, IAM service runs:
    SELECT permission_key FROM permissions
      JOIN role_permissions USING (permission_id)
      JOIN roles            USING (role_id)
      JOIN user_roles       USING (role_id)
    WHERE user_roles.user_id = ?
  → embeds result as permissions[] in the JWT payload.

══════════════════════════════════════
BACKEND MIDDLEWARE (iam-service — middleware/auth.ts)
══════════════════════════════════════
  requireAuth()             — validates HS256 JWT, attaches req.user
  requirePermissions(...p)  — SuperAdmin bypasses; else checks req.user.permissions
  requireRoles(...r)        — SuperAdmin bypasses; else checks req.user.roles
                              USE ONLY for system-level endpoints, never for business logic

  Correct route guard:
    router.put('/families/:id',
      requireAuth(),
      requirePermissions('ADMIN.FAMILIES.EDIT'),  ← permission key always
      handler
    )

  Wrong (never do this for business routes):
    router.put('/families/:id',
      requireAuth(),
      requireRoles('Admin', 'SuperAdmin'),  ❌
      handler
    )

══════════════════════════════════════
FRONTEND AUTHORIZATION UTILITIES
══════════════════════════════════════
  File: frontend/src/lib/auth.ts

  hasPermission(key)           — single key check, SuperAdmin always true
  hasAnyPermission(keys[])     — OR logic, SuperAdmin always true
  hasAllPermissions(keys[])    — AND logic, SuperAdmin always true
  hasPermissionPrefix(prefix)  — section-level, e.g. hasPermissionPrefix('ADMIN.')
  usePermissions()             — reactive React hook (re-renders on session change)
  hasStrict(key)               — no SuperAdmin bypass (for explicitly-granted-only perms)

  File: frontend/src/store/authStore.ts

  hasPermission(key)           — same logic, usable outside React tree
  hasExplicitPermission(key)   — no SuperAdmin bypass

══════════════════════════════════════
NAVIGATION GUARD (navConfig.ts)
══════════════════════════════════════
  Each nav item declares: requiredPermission: string | string[]
    string   → single permission required
    string[] → OR — any one of the listed permissions grants access

  AppLayout iterates navConfig and calls hasPermission() per item.
  Items without requiredPermission are visible to all authenticated users.

  Example:
    { path: '/admin/families', label: 'Families', icon: 'family_restroom',
      requiredPermission: 'ADMIN.FAMILIES.VIEW', section: 'Administration' }

    { path: '/programme-admin/programmes', label: 'Programmes',
      requiredPermission: ['ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.PROGRAMMES.VIEW'] }

══════════════════════════════════════
ROUTE GUARD (PermissionGuard.tsx)
══════════════════════════════════════
  Wraps a route element. Renders <ForbiddenPage /> if permission is missing.
  SuperAdmin always passes (handled inside hasPermission()).

    <PermissionGuard permission="ADMIN.ROLES.VIEW">
      <AdminRoleManagement />
    </PermissionGuard>

══════════════════════════════════════
PORTAL SELECTION (SmartDashboard + AppLayout)
══════════════════════════════════════
  SECTION_PREFIXES:
    'CITIZEN.'    → Citizen Portal sidebar + CitizenDashboard
    'ADMIN.'      → Administration sidebar + AdminDashboard
    'PROGRAMME.'  → Programme Admin sidebar + ProgrammeDashboard

  Logic:
    hasPermissionPrefix('ADMIN.')      → show Admin section
    hasPermissionPrefix('CITIZEN.')    → show Citizen section
    hasPermissionPrefix('PROGRAMME.')  → show Programme section

  A user with permissions from multiple sections sees all their sections.

══════════════════════════════════════
VIEW DEPENDENCY RULE
══════════════════════════════════════
  File: frontend/src/utils/permissionUtils.ts  +  AdminRoleManagement.tsx

  enforceViewDependency():
    When a WRITE_ACTION permission is checked in Role Management UI,
    the corresponding VIEW permission is auto-checked too.

    WRITE_ACTIONS = ['CREATE','EDIT','DELETE','ARCHIVE','RESTORE',
                     'MANAGE','ASSIGN','REVIEW','APPLY','MANAGE_PERMISSIONS']

    ✅  User selects ADMIN.FAMILIES.CREATE → ADMIN.FAMILIES.VIEW auto-added
    ✅  EXPORT is NOT in WRITE_ACTIONS → never auto-adds VIEW

  Past bug (fixed): 'EXPORT' was inside WRITE_ACTIONS, causing SYSTEM.EXPORT
  to auto-add a non-existent SYSTEM.EXPORT.VIEW. Fixed by removing EXPORT
  from WRITE_ACTIONS in both permissionUtils.ts and AdminRoleManagement.tsx.

══════════════════════════════════════
HOW TO ADD A NEW PERMISSION (5 steps)
══════════════════════════════════════
1. DB — insert:
     INSERT INTO permissions (permission_key, description)
     VALUES ('MODULE.SUBMODULE.ACTION', 'Human description');

2. DB — assign to role:
     INSERT INTO role_permissions (role_id, permission_id)
     SELECT r.role_id, p.permission_id FROM roles r, permissions p
     WHERE r.role_name = 'RoleName'
       AND p.permission_key = 'MODULE.SUBMODULE.ACTION';

3. frontend/src/lib/auth.ts — add to PERMISSIONS constant:
     MODULE: { SUBMODULE: { ACTION: 'MODULE.SUBMODULE.ACTION' } }

4. frontend/src/config/featureCatalogue.ts — add to feature tree:
     { key: 'MODULE.SUBMODULE.ACTION', label: 'Action', description: '...' }

5. Backend route — guard it:
     router.get('/route', requireAuth(), requirePermissions('MODULE.SUBMODULE.ACTION'), h)

   ⚠️  User must re-login to get updated permissions in their JWT.

══════════════════════════════════════
WHAT NEVER TO DO
══════════════════════════════════════
- DO NOT check role names for access control in components or routes
- DO NOT trust localStorage user objects for authorization — only session.permissions[]
- DO NOT add EXPORT to WRITE_ACTIONS
- DO NOT add permissions to featureCatalogue that are not guarded anywhere in code
- DO NOT manually assign permissions to SuperAdmin — it bypasses checks already
- DO NOT use hasRole() in new code — deprecated, use hasPermission() only
```

---

## 2. Permission Key Catalogue

### Citizen
| Key | Description |
|---|---|
| `CITIZEN.DASHBOARD.VIEW` | Citizen dashboard |
| `CITIZEN.FAMILY.VIEW` / `EDIT` | Own family data |
| `CITIZEN.PROFILE.VIEW` / `EDIT` | Own profile |
| `CITIZEN.DOCUMENTS.VIEW` / `CREATE` / `DELETE` | Document vault |
| `CITIZEN.PROGRAMMES.VIEW` / `APPLY` | Programme enrollment |
| `CITIZEN.BENEFITS.VIEW` | Benefits received |
| `CITIZEN.GRIEVANCES.VIEW` / `CREATE` | Grievances |

### Administration
| Key | Description |
|---|---|
| `ADMIN.OVERVIEW.VIEW` | Admin dashboard |
| `ADMIN.FAMILIES.VIEW` / `CREATE` / `EDIT` / `ARCHIVE` | Family management |
| `ADMIN.PROGRAMMES.VIEW` / `CREATE` / `EDIT` / `ARCHIVE` | Programmes |
| `ADMIN.GRIEVANCES.VIEW` / `EDIT` / `ASSIGN` / `ARCHIVE` | Grievances |
| `ADMIN.APPEALS.VIEW` / `EDIT` / `REVIEW` / `ARCHIVE` | Appeals |
| `ADMIN.USERS.VIEW` / `CREATE` / `EDIT` / `DELETE` | Users |
| `ADMIN.CASEWORKERS.VIEW` / `CREATE` / `EDIT` / `DELETE` / `ASSIGN` | Caseworkers |
| `ADMIN.ACCESS.VIEW` / `MANAGE_PERMISSIONS` | Admin access control |
| `ADMIN.ROLES.VIEW` / `CREATE` / `EDIT` / `DELETE` / `MANAGE_PERMISSIONS` | Roles |
| `ADMIN.AUDITLOGS.VIEW` | Audit logs |

### Programme Admin
| Key | Description |
|---|---|
| `PROGRAMME.PROGRAMMES.VIEW` / `CREATE` / `EDIT` / `DELETE` / `PUBLISH` | Programmes |
| `PROGRAMME.BENEFICIARIES.VIEW` / `ENROLL` / `MANAGE` | Beneficiaries |
| `PROGRAMME.RULES.VIEW` / `MANAGE` | Eligibility rules |
| `PROGRAMME.REPORTS.VIEW` | Reports |
| `PROGRAMME.MANAGERS.VIEW` / `MANAGE` | Managers |
| `PROGRAMME.ENGINE.RUN` | Run eligibility engine |
| `PROGRAMME.AUDITLOGS.VIEW` | Audit logs |

---

## 3. Backend Authorization Flow

```
Incoming request
  │
  ▼
requireAuth()
  ├─ Extract Bearer token
  ├─ Verify HS256 signature
  └─ req.user = { sub, roles[], permissions[] }
  │
  ▼
requirePermissions('ADMIN.FAMILIES.EDIT')           → next()  [bypass]
  ├─ permissions.includes('ADMIN.FAMILIES.EDIT') → next()
  └─ else                                      → 403 FORBIDDEN
  │
  ▼
Handler runs
```

---

## 4. Frontend Authorization Flow

```
Login response received
  │
  ├─ authStore.login(sessionData)
  │     session.permissions = ['CITIZEN.DASHBOARD.VIEW', ...]
  │     session.roles       = ['Citizen']
  │     persisted to localStorage 'spis-auth-storage'
  │
  ▼
App renders
  │
  ├─ ProtectedRoute          → !isAuthenticated → redirect /login
  │
  ├─ AppLayout (sidebar)
  │     navConfig.forEach(item => hasPermission(item.requiredPermission))
  │     → enabled link if true, lock icon if false
  │
  ├─ SmartDashboard
  │     hasPermissionPrefix('ADMIN.')      → AdminDashboard
  │     hasPermissionPrefix('CITIZEN.')    → CitizenDashboard
  │     hasPermissionPrefix('PROGRAMME.')  → ProgrammeDashboard
  │
  └─ PermissionGuard (per route)
        hasPermission('ADMIN.ROLES.VIEW') → render page
        else                              → ForbiddenPage
```

**In components:**
```typescript
const { hasPermission, hasAny, hasPrefix } = usePermissions()

hasPermission('ADMIN.USERS.CREATE')                              // single key
hasAny(['ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.PROGRAMMES.VIEW'])  // OR logic
hasPrefix('ADMIN.')                                              // section check
```

---

## 5. Roles & Default Permissions

| Role | Section | Permissions |
|---|---|---|
| `SuperAdmin` | All | Bypasses all checks — no explicit permissions needed |
| `Admin` | Administration | `ADMIN.*` (role management excluded by default) |
| `CaseWorker` | Administration | `ADMIN.FAMILIES.VIEW`, `ADMIN.GRIEVANCES.VIEW/EDIT` |
| `ProgrammeManager` | Programme Admin | `PROGRAMME.*` |
| `Citizen` | Citizen Portal | `CITIZEN.*` |

---

## 6. Common Issues

| Problem | Cause | Fix |
|---|---|---|
| 403 on a valid user | Permission not in `role_permissions` for their role | Add to DB; user must re-login |
| Permission change has no effect | JWT baked at login — stale | Re-login, or call `refreshPermissions()` |
| Wrong 403 from role-name check | Code uses `roles.includes('Admin')` not `permissions.includes(...)` | Replace with `requirePermissions()` / `hasPermission()` |
| SuperAdmin still blocked | Middleware uses manual `req.user.roles` check, not `requirePermissions()` | Swap to `requirePermissions()` middleware |

---

## 7. File Map

| File | Authorization responsibility |
|---|---|
| `backend/iam-service/src/middleware/auth.ts` | `requireAuth`, `requirePermissions`, `requireRoles` |
| `backend/iam-service/src/features/login/loginService.js` | Queries and embeds permissions into JWT |
| `frontend/src/lib/auth.ts` | `hasPermission`, `usePermissions`, `PERMISSIONS`, `SECTION_PREFIXES` |
| `frontend/src/store/authStore.ts` | Zustand session, `hasPermission()`, cross-tab sync |
| `frontend/src/config/navConfig.ts` | Nav items with `requiredPermission` |
| `frontend/src/components/PermissionGuard.tsx` | Route-level permission gate |
| `frontend/src/config/featureCatalogue.ts` | Full permission key tree for Role Management UI |
| `frontend/src/utils/permissionUtils.ts` | `enforceViewDependency` rule |
| `frontend/src/pages/superadmin/AdminRoleManagement.tsx` | UI to assign permissions to roles |
