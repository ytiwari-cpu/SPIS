# SPIS Feature-Permission Playbook

## Scalable Approach to Adding Features & Permissions

**Version:** 1.0  
**Last Updated:** February 20, 2026

---

## Table of Contents

1. [Permission Naming Standard](#permission-naming-standard)
2. [Permission Registry](#permission-registry)
3. [Codegen Strategy](#codegen-strategy)
4. [Sync Strategy](#sync-strategy)
5. [Adding a New Feature (Step-by-Step)](#adding-a-new-feature-step-by-step)
6. [Edge Cases](#edge-cases)
7. [CI/CD Integration](#cicd-integration)

---

## Permission Naming Standard

### Format

```
MODULE.RESOURCE.ACTION
```

### Rules

| Component | Rule | Examples |
|-----------|------|----------|
| **MODULE** | Top-level area | `ADMIN`, `CITIZEN`, `SYSTEM` |
| **RESOURCE** | Entity/feature | `FAMILIES`, `USERS`, `PROGRAMMES` |
| **ACTION** | Operation | `VIEW`, `CREATE`, `EDIT`, `DELETE`, `EXPORT` |
| **Case** | UPPERCASE only | `ADMIN.FAMILIES.VIEW` ✓ |
| **Separator** | Single dot | `ADMIN.FAMILIES.VIEW` ✓ |
| **Characters** | Letters, numbers, underscore | `ADMIN.AUDIT_LOGS.VIEW` ✓ |

### Standard Actions

| Action | Meaning |
|--------|---------|
| `VIEW` | Read-only access to list/detail |
| `CREATE` | Add new records |
| `EDIT` | Modify existing records |
| `DELETE` | Remove records (soft or hard) |
| `EXPORT` | Download/export data |
| `ARCHIVE` | Move to archive state |
| `RESTORE` | Restore from archive |
| `ASSIGN` | Assign relations (workers to cases, etc.) |
| `MANAGE_PERMISSIONS` | Special: manage role permissions |
| `APPROVE` | Approve pending items |
| `REJECT` | Reject pending items |

### Wildcard Convention (Optional)

If your system supports wildcards:

```
ADMIN.*           // All admin permissions
ADMIN.FAMILIES.*  // All family operations
```

**Note:** Current implementation does NOT use wildcards. Each permission is explicit.

---

## Permission Registry

### Single Source of Truth

Create a registry file that defines ALL permissions:

```yaml
# permissions/registry.yaml

version: "1.0"
generated_at: null  # Will be set by codegen

modules:
  ADMIN:
    description: "Administrative functions"
    resources:
      OVERVIEW:
        description: "Admin dashboard overview"
        actions:
          - VIEW
      
      FAMILIES:
        description: "Family record management"
        actions:
          - VIEW
          - CREATE
          - EDIT
          - DELETE
          - EXPORT
          - ARCHIVE
      
      PROGRAMMES:
        description: "Programme management"
        actions:
          - VIEW
          - CREATE
          - EDIT
          - DELETE
          - EXPORT
          - ASSIGN
      
      USERS:
        description: "Citizen user management"
        actions:
          - VIEW
          - CREATE
          - EDIT
          - DELETE
          - SUSPEND
      
      ROLES:
        description: "Role and permission management"
        actions:
          - VIEW
          - CREATE
          - EDIT
          - DELETE
          - MANAGE_PERMISSIONS
      
      AUDITLOGS:
        description: "Security audit logs"
        actions:
          - VIEW
          - EXPORT

  CITIZEN:
    description: "Citizen self-service"
    resources:
      DASHBOARD:
        actions: [VIEW]
      FAMILY:
        actions: [VIEW, EDIT]
      PROFILE:
        actions: [VIEW, EDIT]
      DOCUMENTS:
        actions: [VIEW, UPLOAD, DELETE]
      PROGRAMMES:
        actions: [VIEW, APPLY]
      BENEFITS:
        actions: [VIEW]
      GRIEVANCES:
        actions: [VIEW, CREATE]

  SYSTEM:
    description: "System administration"
    resources:
      SETTINGS:
        actions: [VIEW, EDIT]
      MAINTENANCE:
        actions: [EXECUTE]
      BACKUP:
        actions: [CREATE, RESTORE]
```

### TypeScript Version (Alternative)

```typescript
// permissions/registry.ts

export const PERMISSION_REGISTRY = {
  ADMIN: {
    OVERVIEW: ['VIEW'],
    FAMILIES: ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'EXPORT', 'ARCHIVE'],
    PROGRAMMES: ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'EXPORT', 'ASSIGN'],
    USERS: ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'SUSPEND'],
    ROLES: ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'MANAGE_PERMISSIONS'],
    AUDITLOGS: ['VIEW', 'EXPORT'],
  },
  CITIZEN: {
    DASHBOARD: ['VIEW'],
    FAMILY: ['VIEW', 'EDIT'],
    PROFILE: ['VIEW', 'EDIT'],
    DOCUMENTS: ['VIEW', 'UPLOAD', 'DELETE'],
    PROGRAMMES: ['VIEW', 'APPLY'],
    BENEFITS: ['VIEW'],
    GRIEVANCES: ['VIEW', 'CREATE'],
  },
  SYSTEM: {
    SETTINGS: ['VIEW', 'EDIT'],
    MAINTENANCE: ['EXECUTE'],
    BACKUP: ['CREATE', 'RESTORE'],
  },
} as const

// Generate flat list
export function getAllPermissions(): string[] {
  const perms: string[] = []
  for (const [module, resources] of Object.entries(PERMISSION_REGISTRY)) {
    for (const [resource, actions] of Object.entries(resources)) {
      for (const action of actions) {
        perms.push(`${module}.${resource}.${action}`)
      }
    }
  }
  return perms
}
```

---

## Codegen Strategy

### Generate Constants

Create a script that reads the registry and generates typed constants:

```typescript
// scripts/generate-permissions.ts

import { PERMISSION_REGISTRY, getAllPermissions } from '../permissions/registry'
import fs from 'fs'

function generateFrontendConstants() {
  let output = `// AUTO-GENERATED - DO NOT EDIT
// Generated from permissions/registry.ts
// Run: npm run generate:permissions

export const PERMISSIONS = {\n`

  for (const [module, resources] of Object.entries(PERMISSION_REGISTRY)) {
    output += `  ${module}: {\n`
    for (const [resource, actions] of Object.entries(resources)) {
      output += `    ${resource}: {\n`
      for (const action of actions) {
        const key = `${module}.${resource}.${action}`
        output += `      ${action}: '${key}' as const,\n`
      }
      output += `    },\n`
    }
    output += `  },\n`
  }
  output += `} as const\n\n`

  // Also generate flat array
  output += `export const ALL_PERMISSIONS = [\n`
  for (const perm of getAllPermissions()) {
    output += `  '${perm}',\n`
  }
  output += `] as const\n\n`

  output += `export type Permission = typeof ALL_PERMISSIONS[number]\n`

  return output
}

function generateSQLSeed() {
  let output = `-- AUTO-GENERATED - DO NOT EDIT
-- Generated from permissions/registry.ts
-- Run: npm run generate:permissions

INSERT INTO authz.permission (code, label, description, module, resource, action) VALUES\n`

  const perms = getAllPermissions()
  const lines = perms.map((perm, i) => {
    const [module, resource, action] = perm.split('.')
    const label = `${action.charAt(0) + action.slice(1).toLowerCase()} ${resource.toLowerCase()}`
    const comma = i < perms.length - 1 ? ',' : ''
    return `('${perm}', '${label}', '', '${module}', '${resource}', '${action}')${comma}`
  })

  output += lines.join('\n')
  output += `\nON CONFLICT (code) DO UPDATE SET updated_at = now();\n`

  return output
}

// Write files
fs.writeFileSync('frontend/src/lib/permissions.generated.ts', generateFrontendConstants())
fs.writeFileSync('database/migrations/generated_permissions.sql', generateSQLSeed())

console.log('✓ Generated permission constants')
```

### Generated Output Example

```typescript
// frontend/src/lib/permissions.generated.ts (AUTO-GENERATED)

export const PERMISSIONS = {
  ADMIN: {
    OVERVIEW: {
      VIEW: 'ADMIN.OVERVIEW.VIEW' as const,
    },
    FAMILIES: {
      VIEW: 'ADMIN.FAMILIES.VIEW' as const,
      CREATE: 'ADMIN.FAMILIES.CREATE' as const,
      EDIT: 'ADMIN.FAMILIES.EDIT' as const,
      DELETE: 'ADMIN.FAMILIES.DELETE' as const,
      EXPORT: 'ADMIN.FAMILIES.EXPORT' as const,
      ARCHIVE: 'ADMIN.FAMILIES.ARCHIVE' as const,
    },
    // ...
  },
  // ...
} as const

export const ALL_PERMISSIONS = [
  'ADMIN.OVERVIEW.VIEW',
  'ADMIN.FAMILIES.VIEW',
  'ADMIN.FAMILIES.CREATE',
  // ...
] as const

export type Permission = typeof ALL_PERMISSIONS[number]
```

### Usage After Codegen

```typescript
// Instead of magic strings:
hasPermission('ADMIN.FAMILIES.VIEW')  // ❌ Typo-prone

// Use generated constants:
import { PERMISSIONS } from '@/lib/permissions.generated'
hasPermission(PERMISSIONS.ADMIN.FAMILIES.VIEW)  // ✅ Type-safe
```

---

## Sync Strategy

### Option 1: Database as Source (Recommended for SPIS)

**Current Flow:**
1. Permissions defined in SQL migration
2. Roles assigned permissions via SQL
3. Backend queries DB for user permissions
4. JWT includes permissions from DB

**Pros:** Simple, single source in DB  
**Cons:** Must run migrations to add permissions

### Option 2: Registry + DB Sync

**Flow:**
1. Permissions defined in `registry.yaml`
2. Codegen creates SQL seed
3. CI runs sync script on deploy
4. DB is kept in sync with registry

```bash
# scripts/sync-permissions.sh

#!/bin/bash
set -e

echo "=== Permission Sync ==="

# 1. Generate SQL from registry
npm run generate:permissions

# 2. Apply to database
psql "$DATABASE_URL" -f database/migrations/generated_permissions.sql

# 3. Verify
psql "$DATABASE_URL" -c "SELECT count(*) as permission_count FROM authz.permission"

echo "✓ Permissions synced"
```

### Option 3: Keycloak Client Roles (If Using Keycloak)

**Flow:**
1. Permissions = Keycloak client roles
2. Sync script creates roles in Keycloak
3. Token includes roles from Keycloak
4. Backend trusts Keycloak claims

```typescript
// scripts/sync-keycloak.ts
import KcAdminClient from '@keycloak/keycloak-admin-client'
import { getAllPermissions } from '../permissions/registry'

async function syncToKeycloak() {
  const kcAdmin = new KcAdminClient({ baseUrl: 'http://keycloak:8080' })
  await kcAdmin.auth({ grantType: 'client_credentials', ... })

  const clientId = await kcAdmin.clients.findOne({ clientId: 'spis-backend' })
  const existingRoles = await kcAdmin.clients.listRoles({ id: clientId.id })
  const existingNames = new Set(existingRoles.map(r => r.name))

  for (const perm of getAllPermissions()) {
    if (!existingNames.has(perm)) {
      await kcAdmin.clients.createRole({ id: clientId.id }, { name: perm })
      console.log(`Created: ${perm}`)
    }
  }
}
```

---

## Adding a New Feature (Step-by-Step)

### Example: Adding "Reports" Feature

#### Step 1: Add to Registry

```yaml
# permissions/registry.yaml

modules:
  ADMIN:
    resources:
      # ... existing resources ...
      
      REPORTS:
        description: "Business intelligence reports"
        actions:
          - VIEW
          - CREATE
          - EXPORT
          - SCHEDULE
```

#### Step 2: Run Codegen

```bash
npm run generate:permissions
```

This updates:
- `frontend/src/lib/permissions.generated.ts`
- `database/migrations/generated_permissions.sql`

#### Step 3: Apply Database Migration

```bash
# Option A: Run generated SQL
psql $DATABASE_URL -f database/migrations/generated_permissions.sql

# Option B: Create formal migration
npm run migration:create -- add-reports-permissions
```

#### Step 4: Assign to Roles

```sql
-- Assign to relevant roles
INSERT INTO authz.role_permission (role_id, permission_code)
SELECT r.id, p.code
FROM authz.role r
CROSS JOIN authz.permission p
WHERE r.name IN ('SuperAdmin', 'Admin')
  AND p.code LIKE 'ADMIN.REPORTS.%'
ON CONFLICT DO NOTHING;
```

#### Step 5: Protect Backend Endpoints

```typescript
// backend/iam-service/src/routes/reports.routes.ts

import { requireAuth, requirePermissions } from '../middleware/auth.js'

export const reportsRouter = Router()

// List reports
reportsRouter.get(
  '/',
  requireAuth(),
  requirePermissions('ADMIN.REPORTS.VIEW'),
  async (req, res) => { /* ... */ }
)

// Create report
reportsRouter.post(
  '/',
  requireAuth(),
  requirePermissions('ADMIN.REPORTS.CREATE'),
  async (req, res) => { /* ... */ }
)

// Export report
reportsRouter.get(
  '/:id/export',
  requireAuth(),
  requirePermissions('ADMIN.REPORTS.EXPORT'),
  async (req, res) => { /* ... */ }
)
```

#### Step 6: Add Frontend Navigation

```typescript
// frontend/src/config/navConfig.ts

export const navConfig: NavItem[] = [
  // ... existing items ...
  
  { 
    path: '/admin/reports', 
    label: 'Reports', 
    icon: 'assessment',
    requiredPermission: 'ADMIN.REPORTS.VIEW',  // Use constant ideally
    section: 'Administration'
  },
]
```

#### Step 7: Create Frontend Route

```typescript
// frontend/src/App.tsx

import AdminReports from './pages/admin/AdminReports'

// Inside Routes:
<Route 
  path="/admin/reports" 
  element={
    <PermissionGuard permission="ADMIN.REPORTS.VIEW">
      <AdminReports />
    </PermissionGuard>
  } 
/>
```

#### Step 8: Gate UI Actions

```typescript
// frontend/src/pages/admin/AdminReports.tsx

import { PERMISSIONS } from '@/lib/permissions.generated'

export default function AdminReports() {
  const { hasPermission } = useAuthStore()
  
  const canCreate = hasPermission(PERMISSIONS.ADMIN.REPORTS.CREATE)
  const canExport = hasPermission(PERMISSIONS.ADMIN.REPORTS.EXPORT)
  
  return (
    <div>
      {canCreate && <Button onClick={handleCreate}>New Report</Button>}
      {canExport && <Button onClick={handleExport}>Export</Button>}
    </div>
  )
}
```

#### Step 9: Write Tests

```typescript
// __tests__/reports.test.ts

describe('Reports Feature', () => {
  it('shows Reports nav item when user has ADMIN.REPORTS.VIEW', () => {
    // Mock session with permission
    renderWithAuth({ permissions: ['ADMIN.REPORTS.VIEW'] })
    expect(screen.getByText('Reports')).toBeInTheDocument()
  })
  
  it('hides Reports nav item without permission', () => {
    renderWithAuth({ permissions: [] })
    expect(screen.queryByText('Reports')).not.toBeInTheDocument()
  })
  
  it('shows create button with ADMIN.REPORTS.CREATE', () => {
    renderWithAuth({ permissions: ['ADMIN.REPORTS.VIEW', 'ADMIN.REPORTS.CREATE'] })
    expect(screen.getByText('New Report')).toBeInTheDocument()
  })
  
  it('hides create button without ADMIN.REPORTS.CREATE', () => {
    renderWithAuth({ permissions: ['ADMIN.REPORTS.VIEW'] })
    expect(screen.queryByText('New Report')).not.toBeInTheDocument()
  })
})
```

#### Step 10: Deploy & Test

```bash
# 1. Run migrations
npm run db:migrate

# 2. Restart services
docker-compose restart iam-service family-service

# 3. Test with different users
# - SuperAdmin should see Reports
# - Citizen should not see Reports
# - User without REPORTS.CREATE should not see "New Report" button
```

---

## Edge Cases

### User with No Permissions

```typescript
// Frontend: Show empty state
if (permissions.length === 0) {
  return <EmptyPermissionsPage />
}

// Backend: Reject with clear message
if (userPermissions.length === 0) {
  return res.status(403).json({
    error: 'No permissions assigned. Contact administrator.'
  })
}
```

### Token Too Large

JWT in header has ~8KB limit. With many permissions:

```typescript
// Option 1: Use permission prefixes/wildcards
permissions: ['ADMIN.*', 'CITIZEN.*']  // Instead of 50+ individual perms

// Option 2: Fetch permissions on-demand
// Store minimal claims in JWT, fetch full list from API

// Option 3: Use opaque token + introspection
// Token is just an ID, permissions fetched from backend
```

### Permission Deprecation

Never hard-delete permissions. Mark as deprecated:

```sql
UPDATE authz.permission
SET is_active = false,
    deprecated_at = now(),
    deprecated_by = 'user-uuid',
    deprecation_reason = 'Feature removed in v2.5'
WHERE code = 'ADMIN.OLD_FEATURE.VIEW';
```

Deprecated permissions:
- Still exist in DB for audit history
- Not included in new token grants
- Can be restored if needed

---

## CI/CD Integration

### GitHub Actions Example

```yaml
# .github/workflows/permissions.yml

name: Permission Sync

on:
  push:
    paths:
      - 'permissions/registry.yaml'
      - 'permissions/registry.ts'
  workflow_dispatch:

jobs:
  validate-and-sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Validate registry
        run: |
          npm run permissions:validate
          # Checks:
          # - All codes match format
          # - No duplicates
          # - All references valid
      
      - name: Generate constants
        run: npm run generate:permissions
      
      - name: Check for drift
        run: |
          git diff --exit-code frontend/src/lib/permissions.generated.ts
          if [ $? -ne 0 ]; then
            echo "::error::Generated permissions are out of sync. Run 'npm run generate:permissions' and commit."
            exit 1
          fi
      
      - name: Sync to database (staging)
        if: github.ref == 'refs/heads/develop'
        run: |
          npm run permissions:sync
        env:
          DATABASE_URL: ${{ secrets.STAGING_DATABASE_URL }}
      
      - name: Sync to database (production)
        if: github.ref == 'refs/heads/main'
        run: |
          npm run permissions:sync
        env:
          DATABASE_URL: ${{ secrets.PRODUCTION_DATABASE_URL }}
```

### Validation Script

```typescript
// scripts/validate-permissions.ts

import { PERMISSION_REGISTRY, getAllPermissions } from '../permissions/registry'

function validate() {
  const errors: string[] = []
  const seen = new Set<string>()
  
  for (const perm of getAllPermissions()) {
    // Check format
    if (!/^[A-Z][A-Z0-9_]*\.[A-Z][A-Z0-9_]*\.[A-Z][A-Z0-9_]*$/.test(perm)) {
      errors.push(`Invalid format: ${perm}`)
    }
    
    // Check duplicates
    if (seen.has(perm)) {
      errors.push(`Duplicate: ${perm}`)
    }
    seen.add(perm)
  }
  
  if (errors.length > 0) {
    console.error('Validation failed:')
    errors.forEach(e => console.error(`  - ${e}`))
    process.exit(1)
  }
  
  console.log(`✓ Validated ${seen.size} permissions`)
}

validate()
```

---

## Summary Checklist

### Adding a New Feature

- [ ] Add permissions to `permissions/registry.yaml`
- [ ] Run `npm run generate:permissions`
- [ ] Apply database migration
- [ ] Assign permissions to appropriate roles
- [ ] Add `requirePermissions()` to backend routes
- [ ] Add to `navConfig.ts` with `requiredPermission`
- [ ] Add `<PermissionGuard>` to route in `App.tsx`
- [ ] Gate UI actions with `hasPermission()`
- [ ] Write permission-based tests
- [ ] Update docs if needed
- [ ] Deploy and verify with test users

### CI Checks

- [ ] Registry validates (format, no duplicates)
- [ ] Generated files are in sync
- [ ] Database has all permissions
- [ ] No orphaned permissions in code
