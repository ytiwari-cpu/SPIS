# EXECUTOR PROMPT — Final Repository & Architecture Cleanup

> **SCOPE**: This prompt drives the next implementation pass. Read it fully before writing a single line of code.
> **CONSTRAINT**: Zero database schema changes — no new migration files, no ALTER TABLE, no CREATE TABLE.
> **LANGUAGE**: All backend files are `.js` (CommonJS ESM) except email-service TypeScript files (`*.ts`). TypeScript files import JS as `.js`.

---

## 0. Core Principle Reminder

Every repository method must ultimately call:

```js
const { text, values } = new QueryHelper(TABLE)
  .select(...)  // or .insert / .update / .delete / .count
  // chain: .field() .left_join() .join() .where() .whereIn() .orderBy() .limit() .offset()
  .toParam()
return this.runQuery(text, values, bool)
```

**Always use the fluent API first**: `.select()`, `.field()`, `.join()`, `.left_join()`, `.where()`, `.whereIn()`, `.orderBy()`, `.limit()`, `.offset()`, `.insert()`, `.update()`, `.delete()`, `.count()`.

Key techniques that **replace the need for `.raw()`** in most complex queries:

| Technique | How |
|---|---|
| Subquery LEFT JOIN | `.left_join('(SELECT ... FROM ...)', 'alias', 'alias.col = t.col')` |
| CASE WHEN expression | `.field("CASE WHEN col = 'x' THEN ... END", 'alias')` |
| COALESCE / cast | `.field('COALESCE(u.count, 0)::int', 'user_count')` |
| ORDER BY CASE WHEN / expression | `.orderByExpr("CASE col WHEN 'x' THEN 1 ELSE 2 END, col_name")` — see Phase 0 |
| UNION-based derived table | Pass the entire `(SELECT ... UNION SELECT ...)` as the table constructor arg |
| Dynamic WHERE | `applyFilters` closure: `if (x) qh = qh.where(...)` applied to both count and data queries |
| Role/tag filter needing JOIN | Pre-fetch matching IDs with `.whereIn()`, then filter the main query with `.whereIn('id', ids)` |

**`.raw()` is NEVER used.** There is always a fluent alternative:

| Scenario | Fluent alternative |
|---|---|
| `ON CONFLICT DO NOTHING` | Check-then-insert: `.count().where()` → skip if exists, else `.insert()` |
| `ON CONFLICT DO UPDATE` (upsert) | Try `.insert()`, catch PostgreSQL error `23505`, then `.update()` |
| `col = col + 1` (atomic increment) | `.select()` current value → compute `+1` in JS → `.update()` |
| INSERT when caller needs new row | `.insert({...})` then follow-up `.select().where()` by unique key |
| UPDATE when caller needs updated row | `.update({...})` then follow-up `.select().where()` by PK |
| `DELETE WHERE col < NOW()` | Pass `now` from the **service** → `.delete().where('col', '<', now)` |
| Dynamic SET fields | Build plain JS object `updates = {}` → pass to `.update(updates)` |
| `retry_at <= NOW()` | Pass `now` from caller → `.where('retry_at', '<=', now)` |

```js
// ✅ the ONLY allowed pattern — full fluent chain
const { text, values } = new QueryHelper(TABLE)
  .select('p')
  .field('p.permission_key')
  .join(IAM.ROLE_PERMISSIONS, 'rp', 'rp.permission_key = p.permission_key')
  .join(IAM.USER_ROLES,       'ur', 'ur.role_name = rp.role_name::text')
  .where('ur.user_id', '=', userId)
  .toParam()
```

**Never** pass a raw SQL string directly to `this.runQuery(rawSql, params, bool)`.

**Exception** (no change required — raw-by-design):
- `sqlEditorRepository.js` — entire file, raw SQL execution IS the feature

---

## Phase 0 — Prerequisite: Extend QueryHelper with `.orderByExpr()`

**Do this FIRST**, before any other phase. The `.orderBy()` method sanitises its argument by stripping non-alphanumeric characters, which mangles CASE WHEN expressions. Add `.orderByExpr()` which passes the expression verbatim.

Open `backend/base/queryHelper.js` and insert this method immediately **after** the existing `orderBy()` method:

```js
/**
 * ORDER BY with a SQL expression (CASE WHEN, COALESCE, multi-key, etc.)
 * Unlike orderBy(), this does NOT sanitise — the expression is used verbatim.
 * Multiple ORDER BY columns can be packed into one call: "expr1, col2".
 *
 * @param {string} expression
 * @returns {QueryHelper}
 */
orderByExpr(expression) {
  this._orderClauses.push(expression)
  return this
}
```

Verify: `grep -n 'orderByExpr' backend/base/queryHelper.js` — should show the new method.

---

## Phase A — OTP `maxAttempts`: Single Source of Truth

### Problem
Every `createOtpToken({ ..., maxAttempts = 5 })` call in service files uses a hardcoded default instead of `config.otp.maxAttempts`. The config already defines this:

```ts
// iam-service/src/config.ts
otp: {
  maxAttempts: envInt('OTP_MAX_ATTEMPTS', 5),
}
```

### Fix — update ALL service files that call `createOtpToken`

Find every call to `this.<repo>.createOtpToken({...})` in service files and ensure `maxAttempts` is passed explicitly from config:

```js
// ✅ correct — reads from config
await this.mfaRepository.createOtpToken({
  userId,
  otpHash,
  purpose,
  expiresAt,
  maxAttempts: config.otp.maxAttempts,   // ← explicit, from config
})
```

Files to search and update:
- `iam-service/src/features/mfa/mfaService.js`
- `iam-service/src/features/otpLogin/otpLoginService.js`
- `iam-service/src/features/passwordReset/passwordResetService.js`
- `iam-service/src/features/workerRegister/workerRegisterService.js`
- `iam-service/src/features/invite/inviteService.js`

Ensure `import { config } from '../../config.js'` is present in each service file.

---

## Phase B — Migrate `email-service/src/db/repository.ts`

### Problem
`src/db/repository.ts` violates Rule 9 (no repository outside `features/`). It uses `pool.query()` directly instead of `BaseRepository`. Only two of its functions are actually imported anywhere.

### B.1 — Audit all imports

Run:
```bash
grep -rn "from.*db/repository" email-service/src/
```

You will find only: `email-service/src/services/worker.ts` imports `{ updateEmailStatus, getEmailRequest }`.

All other exports (`getProviders`, `getActiveProvider`, `recordProviderFailure`, `recordProviderSuccess`, `getLatestTemplate`, `recordBounce`, `checkRateLimit`) are **dead code** — not imported anywhere outside `repository.ts` itself.

### B.2 — Add `updateStatus` to `emailRepository.js`

`emailRepository.js` already has `findByRequestId` (maps to `getEmailRequest`) and `createRequest`. Add the missing `updateStatus` method:

```js
// In emailRepository.js — add this method:
async updateStatus(requestId, status, extra = {}) {
  // Read current attempt_count so we can increment without raw col+1
  const { text: readText, values: readValues } = new QueryHelper(TABLE)
    .select('attempt_count')
    .where('request_id', '=', requestId)
    .toParam()
  const readRows    = await this.runQuery(readText, readValues, true)
  const nextAttempt = (readRows[0]?.attempt_count ?? 0) + 1

  // Build update payload dynamically
  const updates = { status, attempt_count: nextAttempt }
  if (extra.last_error    !== undefined) updates.last_error    = extra.last_error
  if (extra.provider_used !== undefined) updates.provider_used = extra.provider_used
  if (extra.sent_at       !== undefined) updates.sent_at       = extra.sent_at
  if (extra.retry_at      !== undefined) updates.retry_at      = extra.retry_at

  const { text, values } = new QueryHelper(TABLE)
    .update(updates)
    .where('request_id', '=', requestId)
    .toParam()
  await this.runQuery(text, values, false)
}
```

Also add the retry-sweep SELECT to `emailRepository.js`:

```js
// Service caller must pass now:
const rows = await emailRepo.findRetryPending(50, new Date().toISOString())

// In emailRepository.js:
async findRetryPending(limit = 50, now) {
  const { text, values } = new QueryHelper(TABLE)
    .select('t')
    .field('t.request_id')
    .field('t.to_email')
    .field('t.template_code')
    .field('t.payload_json')
    .field('t.attempt_count')
    .where('t.status',   '=',  'retry_pending')
    .where('t.retry_at', '<=', now)
    .orderBy('retry_at', 'ASC')
    .limit(limit)
    .toParam()
  return this.runQuery(text, values, true)
}
```

### B.3 — Create a minimal worker context helper

`worker.ts` is a background process with no HTTP request. Create a helper to provide a valid BaseRepository context:

Create new file `email-service/src/db/workerContext.ts`:

```ts
import { pool } from './pool.js'
import { createLogger } from '../../../base/logger.js'

const log = createLogger('email-worker')

/**
 * Minimal context for using BaseRepository / service classes inside workers.
 * There is no HTTP request — only db pool and logger.
 */
export function createWorkerContext() {
  return {
    db:      pool,
    log,
    user:    null,
    request: null,
  }
}
```

### B.4 — Update `worker.ts`

Replace:
```ts
import { updateEmailStatus, getEmailRequest } from '../db/repository.js'
```

With:
```ts
import { EmailRepository } from '../features/email/emailRepository.js'
import { createWorkerContext } from '../db/workerContext.js'

const workerCtx    = createWorkerContext()
const emailRepo    = new EmailRepository(workerCtx)
```

Then replace every call:
- `await updateEmailStatus(request_id, status, extra?)` → `await emailRepo.updateStatus(request_id, status, extra)`
- `await getEmailRequest(requestId)` → `await emailRepo.findByRequestId(requestId)`

For the retry sweep in `sweepRetryPending()`, replace the raw `pool.query(...)` block with:
```ts
const rows = await emailRepo.findRetryPending(50)
```

### B.5 — Delete `email-service/src/db/repository.ts`

After confirming no remaining imports:
```bash
rm email-service/src/db/repository.ts
```

Verify Rule 9 compliance:
```bash
find email-service/src -name "repository.*" ! -path "*/features/*"
# Expected: 0 results (workerContext.ts is not a repository)
```

---

## Phase C — IAM Service Repository Raw SQL Fixes

### C.1 `adminRepository.js`

#### `grantPermission` — plain `.insert()` in repository; controller guards against duplicates

Same principle as `addRole`: the repository does a plain insert; the controller checks first so the service/repository is never called when the permission is already granted.

```js
// In the REPOSITORY (adminRepository.js) — plain insert only:
async grantPermission(roleName, permissionKey, grantedBy) {
  const { text, values } = new QueryHelper(IAM.ROLE_PERMISSIONS)
    .insert({ role_name: roleName, permission_key: permissionKey, granted_by: grantedBy })
    .toParam()
  await this.runQuery(text, values, false)
}

// In the SERVICE (adminService.js) — add a helper for the guard:
async isPermissionGranted(roleName, permissionKey) {
  return this.adminRepository.permissionExists(roleName, permissionKey)
}

// In the CONTROLLER (adminController.js):
async grantPermission({ roleName, permissionKey, grantedBy }) {
  const already = await this.adminService.isPermissionGranted(roleName, permissionKey)
  if (already) return this.respondOk({ success: true, message: 'Permission already granted' })
  await this.adminService.grantPermission(roleName, permissionKey, grantedBy)
  return this.respondOk({ success: true, message: 'Permission granted' })
}
```

Add a `permissionExists(roleName, permissionKey)` helper to `adminRepository.js`:
```js
async permissionExists(roleName, permissionKey) {
  const { text, values } = new QueryHelper(IAM.ROLE_PERMISSIONS)
    .count()
    .where('role_name',      '=', roleName)
    .where('permission_key', '=', permissionKey)
    .toParam()
  const rows = await this.runQuery(text, values, true)
  return parseInt(rows[0]?.count ?? '0', 10) > 0
}
```

#### `getUserPermissions` — 3-table JOIN
```js
async getUserPermissions(userId) {
  const { text, values } = new QueryHelper(IAM.PERMISSIONS)
    .select('p')
    .field('p.permission_key')
    .join(IAM.ROLE_PERMISSIONS, 'rp', 'rp.permission_key = p.permission_key')
    .join(IAM.USER_ROLES,       'ur', 'ur.role_name = rp.role_name::text')
    .where('ur.user_id', '=', userId)
    .toParam()
  const rows = await this.runQuery(text, values, true)
  return [...new Set(rows.map(r => r.permission_key))]  // deduplicate in JS
}
```

#### `replaceRolePermissions` — plain insert loop (caller already diff-computes `toAdd`)
The caller diff-computes `toAdd` from existing permissions. The insert loop only runs for genuinely new entries, so the check is already done by the caller logic. Use a plain insert per entry:
```js
for (const permKey of toAdd) {
  const { text, values } = new QueryHelper(IAM.ROLE_PERMISSIONS)
    .insert({ role_name: roleName, permission_key: permKey, granted_by: grantedBy })
    .toParam()
  await this.runQuery(text, values, false)
}
```

#### `listUsers` — `applyFilters` helper with conditional chaining; pre-fetch user_ids for role filter

The role filter requires a JOIN only to identify matching users. Pre-fetching those `user_id`s first and using `.whereIn()` eliminates the branching FROM clause entirely — both count and data queries stay clean.

```js
async listUsers({ page = 1, limit = 20, status, role, search } = {}) {
  const offset = (page - 1) * limit
  const roles  = role ? role.split(',').map(r => r.trim()).filter(Boolean) : []

  // Step 1: if filtering by role, resolve matching user_ids upfront
  let userIdFilter = null
  if (roles.length) {
    const { text: ridText, values: ridValues } = new QueryHelper(IAM.USER_ROLES)
      .select('user_id')
      .whereIn('role_name', roles)
      .toParam()
    const ridRows  = await this.runQuery(ridText, ridValues, true)
    userIdFilter   = ridRows.map(r => r.user_id)
    if (userIdFilter.length === 0) return { users: [], total: 0 }
  }

  // Step 2: apply all scalar filters to both count and data via the same helper
  const applyFilters = (qh) => {
    if (status)       qh = qh.where('status', '=',    status)
    if (search)       qh = qh.where('email',  'ILIKE', `%${search}%`)
    if (userIdFilter) qh = qh.whereIn('user_id', userIdFilter)
    return qh
  }

  const { text: countText, values: countValues } = applyFilters(
    new QueryHelper(IAM.USERS).count()
  ).toParam()
  const countRows = await this.runQuery(countText, countValues, true)
  const total     = parseInt(countRows[0]?.count || '0', 10)

  // Step 3: data query — LEFT JOIN aggregated roles subquery for the roles array
  const { text, values } = applyFilters(
    new QueryHelper(IAM.USERS)
      .select('u')
      .field('u.user_id').field('u.email').field('u.status').field('u.registry_id')
      .field('u.national_id_hash').field('u.mfa_enabled').field('u.failed_login_attempts')
      .field('u.locked_until').field('u.created_at').field('u.updated_at')
      .field(`COALESCE(r2.roles, '[]'::json)`, 'roles')
      .left_join(
        `(SELECT user_id,
                 json_agg(json_build_object('role_name', role_name, 'created_at', created_at)) AS roles
          FROM user_roles GROUP BY user_id)`,
        'r2',
        'r2.user_id = u.user_id',
      )
  )
    .orderBy('u.created_at', 'DESC')
    .limit(limit)
    .offset(offset)
    .toParam()
  const rows = await this.runQuery(text, values, true)
  return { users: rows, total }
}
```

> Note: `applyFilters` for the data query uses unqualified column names (`status`, `email`, `user_id`) — these resolve correctly against the `u` alias because PostgreSQL matches unqualified names. Alternatively qualify them as `u.status`, `u.email`, `u.user_id` for clarity.

#### `getAllRoles` — UNION-derived table as constructor arg + fluent `.field()` / `.left_join()`

Pass the entire UNION subquery as the table argument to the constructor. `.select('r')` sets the alias; `.field()` builds every column expression including CASE WHEN; `.left_join()` accepts subquery strings as the table argument.

```js
async getAllRoles() {
  // UNION-based derived table — pass as the table arg so QueryHelper builds FROM correctly
  const derivedTable =
    `(SELECT DISTINCT role_name::text AS role_name FROM user_roles
      UNION
      SELECT DISTINCT role_name FROM role_permissions)`

  const { text, values } = new QueryHelper(derivedTable)
    .select('r')
    .field('r.role_name')
    .field('r.role_name', 'display_name')
    .field(
      `CASE
         WHEN r.role_name = 'Citizen'          THEN 'Regular citizens accessing the portal'
         WHEN r.role_name = 'CaseWorker'        THEN 'Staff managing citizen cases'
         WHEN r.role_name = 'ProgrammeManager'  THEN 'Staff managing programmes'
         WHEN r.role_name = 'Admin'             THEN 'System administrators'
         WHEN r.role_name = 'SuperAdmin'        THEN 'Full system access'
         ELSE 'Custom role'
       END`,
      'description',
    )
    .field(
      `r.role_name IN ('Citizen','CaseWorker','ProgrammeManager','Admin','SuperAdmin')`,
      'is_system',
    )
    .field('COALESCE(u.user_count, 0)',       'user_count')
    .field('COALESCE(p.permission_count, 0)', 'permission_count')
    .field('NOW()',                           'created_at')
    .left_join(
      `(SELECT role_name::text AS role_name, COUNT(*) AS user_count
        FROM user_roles GROUP BY role_name::text)`,
      'u',
      'u.role_name = r.role_name',
    )
    .left_join(
      `(SELECT role_name, COUNT(*) AS permission_count
        FROM role_permissions GROUP BY role_name)`,
      'p',
      'p.role_name = r.role_name',
    )
    .orderByExpr(
      `CASE r.role_name WHEN 'SuperAdmin' THEN 1 WHEN 'Admin' THEN 2 WHEN 'ProgrammeManager' THEN 3 WHEN 'CaseWorker' THEN 4 WHEN 'Citizen' THEN 5 ELSE 6 END, r.role_name`,
    )
    .toParam()
  return this.runQuery(text, values, true)
}
```

#### `getAllRolesEnhanced` — fluent `.left_join()` subquery strings + `.field()` COALESCE + `.orderByExpr()` single call
```js
async getAllRolesEnhanced(isActive = true) {
  const { text, values } = new QueryHelper(IAM.ROLES)
    .select('r')
    .field('r.*')
    .field('COALESCE(u.user_count, 0)::int',       'user_count')
    .field('COALESCE(p.permission_count, 0)::int',  'permission_count')
    .left_join(
      `(SELECT role_name::text AS role_name, COUNT(*) AS user_count
        FROM user_roles GROUP BY role_name::text)`,
      'u',
      'u.role_name = r.role_name',
    )
    .left_join(
      `(SELECT role_name, COUNT(*) AS permission_count
        FROM role_permissions GROUP BY role_name)`,
      'p',
      'p.role_name = r.role_name',
    )
    .where('r.is_active', '=', isActive)
    .orderByExpr(
      `CASE r.role_type WHEN 'system' THEN 0 ELSE 1 END, CASE r.role_name WHEN 'SuperAdmin' THEN 1 WHEN 'Admin' THEN 2 WHEN 'ProgrammeManager' THEN 3 WHEN 'CaseWorker' THEN 4 WHEN 'Citizen' THEN 5 ELSE 6 END, r.role_name`,
    )
    .toParam()
  return this.runQuery(text, values, true)
}
```

#### `getRoleByName` — fluent `.field()` CASE expression + `.left_join()` subqueries
```js
async getRoleByName(roleName) {
  const { text, values } = new QueryHelper(IAM.ROLES)
    .select('r')
    .field('r.role_name')
    .field('r.display_name')
    .field('r.description')
    .field(`CASE WHEN r.role_type = 'system' THEN true ELSE false END`, 'is_system')
    .field('COALESCE(u.user_count, 0)',       'user_count')
    .field('COALESCE(p.permission_count, 0)', 'permission_count')
    .field('r.created_at')
    .left_join(
      `(SELECT role_name::text AS role_name, COUNT(*) AS user_count
        FROM user_roles GROUP BY role_name::text)`,
      'u',
      'u.role_name = r.role_name',
    )
    .left_join(
      `(SELECT role_name, COUNT(*) AS permission_count
        FROM role_permissions GROUP BY role_name)`,
      'p',
      'p.role_name = r.role_name',
    )
    .where('r.role_name', '=', roleName)
    .where('r.is_active', '=', true)
    .toParam()
  const rows = await this.runQuery(text, values, true)
  return rows[0] ?? null
}
```

#### `roleNameExists` — EXISTS query → use COUNT instead
```js
async roleNameExists(roleName) {
  const { text, values } = new QueryHelper(IAM.ROLES)
    .count()
    .where('role_name', '=', roleName)
    .toParam()
  const rows = await this.runQuery(text, values, true)
  return parseInt(rows[0]?.count ?? '0', 10) > 0
}
```

#### `deleteRole` — fluent `.update()` + `runQuery` rowCount (no RETURNING needed)

The service must pass `updatedAt` (computed via `new Date().toISOString()` in the service — Rule 13b).

```js
// adminService.js — caller:
await this.adminRepository.deleteRole(roleName, new Date().toISOString())

// adminRepository.js:
async deleteRole(roleName, updatedAt) {
  const { text: delRolesText, values: delRolesValues } = new QueryHelper(IAM.USER_ROLES)
    .delete()
    .where('role_name', '=', roleName)
    .toParam()
  await this.runQuery(delRolesText, delRolesValues, false)

  // Only update custom active roles — rowCount tells us if it matched
  const { text, values } = new QueryHelper(IAM.ROLES)
    .update({ is_active: false, updated_at: updatedAt })
    .where('role_name', '=', roleName)
    .where('role_type', '=', 'custom')
    .where('is_active', '=', true)
    .toParam()
  const rowCount = await this.runQuery(text, values, false)  // false → returns rowCount
  return rowCount > 0
}
```

#### `restoreRole` — fluent `.update()` + `runQuery` rowCount

```js
// adminService.js — caller:
await this.adminRepository.restoreRole(roleName, new Date().toISOString())

// adminRepository.js:
async restoreRole(roleName, updatedAt) {
  const { text, values } = new QueryHelper(IAM.ROLES)
    .update({ is_active: true, updated_at: updatedAt })
    .where('role_name', '=', roleName)
    .where('is_active', '=', false)
    .toParam()
  const rowCount = await this.runQuery(text, values, false)
  return rowCount > 0
}
```

#### `permanentlyDeleteRole` — fluent `.delete()` + `runQuery` rowCount

```js
async permanentlyDeleteRole(roleName) {
  // Fetch + guard — already uses QueryHelper (no change needed)
  const { text: fetchText, values: fetchValues } = new QueryHelper(IAM.ROLES)
    .select('*')
    .where('role_name', '=', roleName)
    .toParam()
  const rows = await this.runQuery(fetchText, fetchValues, true)
  const role = rows[0] ?? null
  if (!role) return false
  if (role.role_type === 'system') throw new Error('System roles cannot be permanently deleted')
  if (role.is_active) throw new Error('Active roles cannot be permanently deleted. Deactivate first.')

  // Delete permissions
  const { text: delPermsText, values: delPermsValues } = new QueryHelper(IAM.ROLE_PERMISSIONS)
    .delete()
    .where('role_name', '=', roleName)
    .toParam()
  await this.runQuery(delPermsText, delPermsValues, false)

  // Delete role — rowCount tells us if a row was actually removed
  const { text, values } = new QueryHelper(IAM.ROLES)
    .delete()
    .where('role_name', '=', roleName)
    .toParam()
  const rowCount = await this.runQuery(text, values, false)
  return rowCount > 0
}
```

#### `getAuditLogs` — `applyFilters` helper with full QueryHelper conditional chaining

The `applyFilters` closure returns the same QueryHelper instance with all optional `.where()` calls applied. Both the count and the data query reuse it — no string building, no `.raw()`.

```js
async getAuditLogs({ page = 1, limit = 50, start_date, end_date, actor_sub, action, resource_type, status_code, method } = {}) {
  const offset = (page - 1) * limit

  const applyFilters = (qh) => {
    if (start_date)    qh = qh.where('created_at',    '>=',    start_date)
    if (end_date)      qh = qh.where('created_at',    '<=',    end_date)
    if (actor_sub)     qh = qh.where('actor_sub',     '=',     actor_sub)
    if (action)        qh = qh.where('action',        'ILIKE', `%${action}%`)
    if (resource_type) qh = qh.where('resource_type', '=',     resource_type)
    if (status_code)   qh = qh.where('status_code',   '=',     status_code)
    if (method)        qh = qh.where('method',        '=',     method)
    return qh
  }

  const { text: countText, values: countValues } = applyFilters(
    new QueryHelper(IAM.AUDIT_LOG).count()
  ).toParam()
  const countRows = await this.runQuery(countText, countValues, true)
  const total     = parseInt(countRows[0]?.count ?? '0', 10)

  const { text, values } = applyFilters(
    new QueryHelper(IAM.AUDIT_LOG).select('*')
  )
    .orderBy('created_at', 'DESC')
    .limit(limit)
    .offset(offset)
    .toParam()
  const rows = await this.runQuery(text, values, true)
  return { logs: rows, total }
}
```

---

### C.2 `loginRepository.js`

#### `getPermissions` — 3-table JOIN
```js
async getPermissions(userId) {
  const { text, values } = new QueryHelper(IAM.PERMISSIONS)
    .select('p')
    .field('p.permission_key')
    .join(IAM.ROLE_PERMISSIONS, 'rp', 'rp.permission_key = p.permission_key')
    .join(IAM.USER_ROLES,       'ur', 'ur.role_name = rp.role_name::text')
    .where('ur.user_id', '=', userId)
    .toParam()
  const rows = await this.runQuery(text, values, true)
  return [...new Set(rows.map(r => r.permission_key))]  // deduplicate in JS
}
```

#### `incrementFailed` — select current + compute in JS + update
```js
async incrementFailed(userId) {
  // Read current value
  const { text: readText, values: readValues } = new QueryHelper(IAM.USERS)
    .select('failed_login_attempts')
    .where('user_id', '=', userId)
    .toParam()
  const readRows = await this.runQuery(readText, readValues, true)
  const newCount = (readRows[0]?.failed_login_attempts ?? 0) + 1

  // Write incremented value
  const { text, values } = new QueryHelper(IAM.USERS)
    .update({ failed_login_attempts: newCount })
    .where('user_id', '=', userId)
    .toParam()
  await this.runQuery(text, values, false)
  return newCount
}
```

---

### C.3 `inviteRepository.js`

#### `addRole` — plain `.insert()` in repository; controller guards against duplicates

The repository does only a plain insert — no existence check. The controller is responsible for checking first so the service/repository layer is skipped entirely when the role is already assigned.

```js
// In the REPOSITORY (inviteRepository.js) — plain insert only:
async addRole(userId, roleName) {
  const { text, values } = new QueryHelper(IAM.USER_ROLES)
    .insert({ user_id: userId, role_name: roleName })
    .toParam()
  await this.runQuery(text, values, false)
}

// In the CONTROLLER (inviteController.js) — guard before calling service:
async addRoleToUser({ userId, roleName }) {
  // Existence check here so service + repository are never called unnecessarily
  const alreadyAssigned = await this.inviteService.isRoleAssigned(userId, roleName)
  if (alreadyAssigned) return this.respondOk({ success: true, message: 'Role already assigned' })

  await this.inviteService.addRole(userId, roleName)
  return this.respondOk({ success: true, message: 'Role assigned' })
}
```

Add a thin `isRoleAssigned(userId, roleName)` helper to the service (which delegates to a repository count check). This keeps the controller's guard self-contained without coupling it to SQL details.

---

### C.4 `mfaRepository.js`

#### `getActiveOtpToken` — fluent `.where()` + JS post-filter

Change the method signature to accept `now` from the service (`new Date().toISOString()` must be computed in the **service**, not here — Rule 13b prohibits `new Date()` in repositories). The column-to-column check `attempt_count < max_attempts` is handled in JS after the query returns.

```js
// In the SERVICE (mfaService.js) — pass now when calling:
const token = await this.mfaRepository.getActiveOtpToken(userId, purpose, new Date().toISOString())

// In the REPOSITORY:
async getActiveOtpToken(userId, purpose, now) {
  const { text, values } = new QueryHelper(IAM.PASSWORD_RESET_TOKENS)
    .select('*')
    .where('user_id',    '=', userId)
    .where('purpose',    '=', purpose)
    .where('used',       '=', false)
    .where('expires_at', '>', now)
    .orderBy('created_at', 'DESC')
    .limit(1)
    .toParam()
  const rows  = await this.runQuery(text, values, true)
  const token = rows[0] ?? null
  // attempt_count < max_attempts is a column-to-column comparison — checked here
  if (!token || token.attempt_count >= token.max_attempts) return null
  return token
}
```

#### `incrementOtpAttempt` — select current + compute in JS + update
```js
async incrementOtpAttempt(tokenId) {
  // Read current value
  const { text: readText, values: readValues } = new QueryHelper(IAM.PASSWORD_RESET_TOKENS)
    .select('attempt_count')
    .where('id', '=', tokenId)
    .toParam()
  const readRows = await this.runQuery(readText, readValues, true)
  const newCount = (readRows[0]?.attempt_count ?? 0) + 1

  // Write incremented value
  const { text, values } = new QueryHelper(IAM.PASSWORD_RESET_TOKENS)
    .update({ attempt_count: newCount })
    .where('id', '=', tokenId)
    .toParam()
  await this.runQuery(text, values, false)
  return newCount
}
```

---

### C.5 `otpLoginRepository.js`

Apply **all four** of these fixes:

1. `getPermissions` → same as C.2 `getPermissions` (use `.join().join()`)
2. `addRole` → same as C.3 `addRole` (plain `.insert()` in repository; controller guards, no `.raw()`)
3. `getActiveOtpToken` → same as C.4 `getActiveOtpToken` (fluent `.where()` + `now` param + JS filter)
4. `incrementOtpAttempt` → same as C.4 `incrementOtpAttempt` (select current + compute in JS + update, no `.raw()`)

Also update `otpLoginService.js` to pass `new Date().toISOString()` as the third argument to `getActiveOtpToken`.

---

### C.6 `passwordResetRepository.js`

Apply these fixes:

1. `getActiveOtpToken` → same as C.4 `getActiveOtpToken` (fluent `.where()` + `now` param + JS filter)
2. `incrementOtpAttempt` → same as C.4 `incrementOtpAttempt` (select current + compute in JS + update, no `.raw()`)

Also update `passwordResetService.js` to pass `new Date().toISOString()` as the third argument to `getActiveOtpToken`.

---

### C.7 `workerRegisterRepository.js`

Apply these fixes:

1. `addRole` → same as C.3 `addRole` (plain `.insert()` in repository; controller guards, no `.raw()`)
2. `getActiveOtpToken` → same as C.4 `getActiveOtpToken` (fluent `.where()` + `now` param + JS filter)

Also update `workerRegisterService.js` to pass `new Date().toISOString()` as the third argument to `getActiveOtpToken`.

---

## Phase D — Programme Service Repository Raw SQL Fixes

### D.1 `auditRepository.js`

This file uses direct `this.runQuery(raw_sql_string, ...)` with no QueryHelper. Add `import { QueryHelper } from '../../../../base/queryHelper.js'` and convert all methods:

```js
import { BaseRepository }      from '../../../../base/baseRepository.js'
import { QueryHelper }         from '../../../../base/queryHelper.js'
import { PROGRAMME as TABLES } from '../../../../base/table.js'

export class AuditRepository extends BaseRepository {
  constructor(context) {
    super(context)
  }

  async findProgrammeHistory(programmeId) {
    const { text, values } = new QueryHelper(TABLES.PROGRAMME_HISTORY)
      .select('*')
      .where('programme_id', '=', programmeId)
      .orderBy('changed_at', 'DESC')
      .limit(100)
      .toParam()
    return this.runQuery(text, values, true)
  }

  async findRulesHistory(programmeId) {
    const { text, values } = new QueryHelper(TABLES.PROGRAMME_RULES_HISTORY)
      .select('*')
      .where('programme_id', '=', programmeId)
      .orderBy('changed_at', 'DESC')
      .limit(100)
      .toParam()
    return this.runQuery(text, values, true)
  }

  async findExitHistory(programmeId) {
    const { text, values } = new QueryHelper(TABLES.PROGRAMME_EXIT_HISTORY)
      .select('*')
      .where('programme_id', '=', programmeId)
      .orderBy('exited_at', 'DESC')
      .limit(100)
      .toParam()
    return this.runQuery(text, values, true)
  }

  async findAllHistory() {
    const { text, values } = new QueryHelper(TABLES.PROGRAMME_HISTORY)
      .select('*')
      .orderBy('changed_at', 'DESC')
      .limit(200)
      .toParam()
    return this.runQuery(text, values, true)
  }
}
```

---

### D.2 `customFieldRepository.js`

#### `create` — fluent `.insert()` then SELECT-after-write
The caller expects the created row. INSERT first, then SELECT by unique key (no `RETURNING` needed):
```js
async create(fields) {
  const {
    display_name, column_name, target_table, data_type, pg_type,
    enum_values, is_required, default_value, description, created_by,
  } = fields
  const { text: insertText, values: insertValues } = new QueryHelper(TABLE)
    .insert({
      display_name,
      column_name,
      target_table,
      data_type,
      pg_type,
      enum_values:   JSON.stringify(enum_values || null),
      is_required:   is_required   || false,
      default_value: default_value || null,
      description:   description   || null,
      created_by:    created_by    || null,
    })
    .toParam()
  await this.runQuery(insertText, insertValues, false)

  // Retrieve the newly created row by its unique business key
  const { text, values } = new QueryHelper(TABLE)
    .select('*')
    .where('column_name',  '=', column_name)
    .where('target_table', '=', target_table)
    .toParam()
  const rows = await this.runQuery(text, values, true)
  return rows[0] ?? null
}
```

#### `update` — dynamic JS updates object + fluent `.update().where()` then SELECT-after-write
The service must pass `updatedAt` (Rule 13b: no `new Date()` in repositories):

```js
// In customFieldService.js — caller:
await this.customFieldRepository.update(id, fields, new Date().toISOString())

// In customFieldRepository.js:
async update(id, fields, updatedAt) {
  // Build update payload dynamically
  const updates = { updated_at: updatedAt }
  for (const [key, val] of Object.entries(fields)) {
    updates[key] = key === 'enum_values' ? JSON.stringify(val) : val
  }

  const { text, values } = new QueryHelper(TABLE)
    .update(updates)
    .where('custom_field_id', '=', id)
    .toParam()
  await this.runQuery(text, values, false)

  // Return the updated row
  const { text: selectText, values: selectValues } = new QueryHelper(TABLE)
    .select('*')
    .where('custom_field_id', '=', id)
    .toParam()
  const rows = await this.runQuery(selectText, selectValues, true)
  return rows[0] ?? null
}
```

#### `deactivate` — fluent `.update().where()`

`updated_at` must be computed in the **service** (Rule 13b: no `new Date()` in repositories) and passed in:

```js
// In customFieldService.js:
await this.customFieldRepository.deactivate(id, new Date().toISOString())

// In customFieldRepository.js:
async deactivate(id, updatedAt) {
  const { text, values } = new QueryHelper(TABLE)
    .update({ is_active: false, updated_at: updatedAt })
    .where('custom_field_id', '=', id)
    .toParam()
  await this.runQuery(text, values, false)
}
```

---

### D.3 `engineRepository.js`

#### `upsertResult` — try INSERT, catch unique violation (`23505`), then UPDATE
```js
async upsertResult(record) {
  const { programme_id, subject_id, ...rest } = record

  // Attempt INSERT first
  const { text: insertText, values: insertValues } = new QueryHelper(TABLES.PROGRAMME_CITIZENS)
    .insert(record)
    .toParam()

  try {
    await this.runQuery(insertText, insertValues, false)
  } catch (err) {
    if (err.code !== '23505') throw err  // only handle unique_violation

    // Row already exists — update all non-PK fields
    const { text: updateText, values: updateValues } = new QueryHelper(TABLES.PROGRAMME_CITIZENS)
      .update(rest)
      .where('programme_id', '=', programme_id)
      .where('subject_id',   '=', subject_id)
      .toParam()
    await this.runQuery(updateText, updateValues, false)
  }
}
```

---

### D.4 `programmeRepository.js`

#### `findById` — raw SELECT with LEFT JOINs
Replace with QueryHelper (same structure as existing `findByIdWithRelations`):
```js
async findById(programmeId) {
  const { text, values } = new QueryHelper(TABLE)
    .select('pm')
    .field('pm.*')
    .field('row_to_json(pc.*)',  'programme_config')
    .field('row_to_json(pps.*)', 'programme_payment_settings')
    .left_join(TABLES.PROGRAMME_CONFIG,           'pc',  'pc.programme_id = pm.programme_id')
    .left_join(TABLES.PROGRAMME_PAYMENT_SETTINGS, 'pps', 'pps.programme_id = pm.programme_id')
    .where('pm.programme_id', '=', programmeId)
    .toParam()
  const rows    = await this.runQuery(text, values, true)
  const programme = rows[0] ?? null
  if (!programme) return null

  const { text: rulesText, values: rulesValues } = new QueryHelper(TABLES.PROGRAMME_RULES)
    .select('*')
    .where('programme_id', '=', programmeId)
    .orderBy('created_at', 'ASC')
    .toParam()
  programme.programme_rules = await this.runQuery(rulesText, rulesValues, true)
  return programme
}
```

---

## Phase E — Family Service Repository Fixes

### E.1 `authRepository.js` — explicit column selection

The user requires `.field()` chaining for multi-column selects. Convert all methods that specify column lists:

#### Before (using comma-separated string in `.select()`):
```js
const { text, values } = new QueryHelper('family')
  .select('uuid, family_id, status, registration_status, household_size, created_at')
  .where('uuid', '=', familyUuid)
  .toParam()
```

#### After (using alias + `.field()` chaining):
```js
const { text, values } = new QueryHelper('family')
  .select('f')
  .field('f.uuid')
  .field('f.family_id')
  .field('f.status')
  .field('f.registration_status')
  .field('f.household_size')
  .field('f.created_at')
  .where('f.uuid', '=', familyUuid)
  .toParam()
```

Apply this pattern to ALL methods in `authRepository.js` that enumerate columns:
- `getFamilyByUuid` — 6 columns
- `getFamilyFullByUuid` — 14 columns
- `getHeadMemberByFamily` — 5 columns (`uuid, member_id, first_name, last_name, national_id`)

> Note: `getMemberByNationalId` and `getFamilyByFamilyId` already use `.select('*')` and `.select('uuid')` respectively — no change needed.

### E.2 `memberRepository.js` — `lookupByNationalId`

Apply the same `.field()` chaining:
```js
async lookupByNationalId(nationalId) {
  const { text, values } = new QueryHelper(TABLE)
    .select('fm')
    .field('fm.uuid')
    .field('fm.member_id')
    .field('fm.first_name')
    .field('fm.last_name')
    .field('fm.national_id')
    .field('fm.email')
    .field('fm.phone')
    .field('fm.family_uuid')
    .where('fm.national_id', '=', nationalId)
    .limit(1)
    .toParam()
  const rows = await this.runQuery(text, values, true)
  return rows[0] ?? null
}
```

---

## Phase F — Email Service `emailRepository.js`

### `checkRateLimit` — fully fluent; pass `now` from the service caller

The service must pass `now = new Date().toISOString()` so the repository never calls `new Date()` (Rule 13b). The DELETE cleanup uses fluent `.where()` on the `now` param. The upsert uses check-then-read-then-insert-or-update.

```js
// In the service that calls checkRateLimit:
await this.emailRepository.checkRateLimit(key, windowSeconds, maxCount, new Date().toISOString())

// In emailRepository.js:
async checkRateLimit(key, windowSeconds, maxCount, now) {
  const nowMs       = new Date(now).getTime()
  const windowStart = new Date(nowMs - windowSeconds * 1000).toISOString()
  const expiresAt   = new Date(nowMs + windowSeconds * 1000).toISOString()

  // 1. Cleanup expired rows — fluent .delete().where() using 'now' param
  const { text: cleanText, values: cleanValues } = new QueryHelper('rate_limits')
    .delete()
    .where('expires_at', '<', now)
    .toParam()
  await this.runQuery(cleanText, cleanValues, false)

  // 2. Count current window — fluent .select() with aggregate expression
  const { text: countText, values: countValues } = new QueryHelper('rate_limits')
    .select('COALESCE(SUM(count), 0)::TEXT AS total')
    .where('key',          '=',  key)
    .where('window_start', '>=', windowStart)
    .toParam()
  const countRows    = await this.runQuery(countText, countValues, true)
  const currentCount = parseInt(countRows[0]?.total ?? '0', 10)

  if (currentCount >= maxCount) {
    return { allowed: false, remaining: 0, resetAt: expiresAt }
  }

  // 3. Check if a row already exists for this key + window
  const { text: checkText, values: checkValues } = new QueryHelper('rate_limits')
    .count()
    .where('key',          '=', key)
    .where('window_start', '=', windowStart)
    .toParam()
  const checkRows = await this.runQuery(checkText, checkValues, true)
  const exists    = parseInt(checkRows[0]?.count ?? '0', 10) > 0

  if (exists) {
    // Read current count then increment in JS (avoids col = col + 1)
    const { text: readText, values: readValues } = new QueryHelper('rate_limits')
      .select('count')
      .where('key',          '=', key)
      .where('window_start', '=', windowStart)
      .toParam()
    const readRows = await this.runQuery(readText, readValues, true)
    const newCount = (readRows[0]?.count ?? 0) + 1

    const { text: incrText, values: incrValues } = new QueryHelper('rate_limits')
      .update({ count: newCount })
      .where('key',          '=', key)
      .where('window_start', '=', windowStart)
      .toParam()
    await this.runQuery(incrText, incrValues, false)
  } else {
    // First request in this window
    const { text: insertText, values: insertValues } = new QueryHelper('rate_limits')
      .insert({ key, window_start: windowStart, count: 1, expires_at: expiresAt })
      .toParam()
    await this.runQuery(insertText, insertValues, false)
  }

  return { allowed: true, remaining: maxCount - currentCount - 1, resetAt: expiresAt }
}
```

---

## Phase G — ESLint & Code Quality

After completing all above phases, run these checks on every modified file:

### G.1 No unused variables / imports
```bash
# Check for imported symbols never used
grep -n "^import" <file> | while read -r line; do
  symbol=$(echo "$line" | sed "s/.*{ \(.*\) }.*/\1/" | tr ',' '\n' | xargs)
  # manually verify each is referenced in the file body
done
```

Specific patterns to eliminate:
- `import { QueryHelper }` present but never instantiated → remove
- Destructured variables from `toParam()` never referenced → rename or remove

### G.2 Async/await consistency
- Every `await this.runQuery(...)` must be in an `async` method
- Never use `.then()` on `runQuery` calls — use `await`
- Never let a returned promise be unhandled — use `await` or `return`

### G.3 Indentation
- All files: **2-space indent**, no tabs
- No trailing whitespace
- Single blank line between methods, no double blanks

### G.4 Consistent QueryHelper construction
- Table constant always at module level: `const TABLE = TABLES.PROGRAMME_HISTORY`
- Never inline the string twice: `new QueryHelper('programme_history')` when `TABLE` is already defined

---

## Phase H — Verification

### H.1 After each phase run these compliance checks

```bash
# From each service's src/ directory:

# Rule 1a — no direct this.query / this.execute
grep -rn "this\.query\b\|this\.execute\b" src/features/

# Rule 1b — no wrapper methods
grep -rn "this\.findAll\b\|this\.findOne\b\|this\.paginate\b" src/features/

# Rule 1d — no leftJoin or _reset
grep -rn "leftJoin\|_reset\b" src/

# No .raw() anywhere (sqlEditorRepository is the only exception)
grep -rn "\.raw(" src/features/ | grep -v sqlEditor

# Rule 9 — no repository outside features
find src -name "repository.*" ! -path "*/features/*"

# Rule 10 — no QueryHelper in service files
grep -rn "new QueryHelper\|this\.runQuery\b" src/features/*Service.js

# Raw SQL passed directly to runQuery (should be 0)
grep -rn "this\.runQuery(\`\|this\.runQuery('" src/features/
```

Expected result for all checks: **0 matches**.

### H.2 Start all services and verify no startup errors
```bash
cd /home/nikhil/Desktop/SPIS
./start-infra.sh
# Wait for infra to be healthy, then:
# Start each service individually and check for import errors, syntax errors
cd backend/iam-service      && node --input-type=module < /dev/null 2>&1 | head -5
cd backend/family-service   && node --input-type=module < /dev/null 2>&1 | head -5
cd backend/programme-service && node --input-type=module < /dev/null 2>&1 | head -5
cd backend/email-service    && npx tsc --noEmit 2>&1 | head -20
```

### H.3 API spot-checks (curl or Postman)
After starting all services, verify these endpoints respond without 500 errors:
1. `POST /api/iam/auth/login` — valid credentials → 200 JWT
2. `GET /api/iam/admin/users` — requires Admin token → 200 list
3. `GET /api/iam/admin/roles` — requires Admin token → 200 list
4. `GET /api/programme/programmes` — requires token → 200 list
5. `GET /api/family/health` → 200

---

## Phase I — Update `codebase-standards.md`

After all phases are verified, update `backend/prompt/codebase-standards.md` to:

1. Replace the `.raw()` escape hatch section with a strict prohibition:

```markdown
### 1.2 — `.raw()` is Completely Forbidden

`.raw()` MUST NOT be used anywhere except `sqlEditorRepository.js` (where raw SQL execution IS the feature).

Alternatives for every previously considered "unavoidable" case:

| Previously considered unavoidable | Fluent replacement |
|---|---|
| `ON CONFLICT DO NOTHING` | Check-then-insert: `.count().where()` → skip if exists |
| `ON CONFLICT DO UPDATE` | Try `.insert()`, catch `23505`, then `.update()` |
| `col = col + 1` | `.select()` current → `+1` in JS → `.update()` |
| `INSERT RETURNING *` | `.insert({...})` then `.select().where()` by unique key |
| `UPDATE RETURNING *` | `.update({...})` then `.select().where()` by PK |
| `DELETE WHERE col < NOW()` | Pass `now` from service → `.delete().where('col', '<', now)` |

**Never** call `this.runQuery(rawSqlString, params, bool)` directly.
```

2. Add Rule 14 — Worker Context Pattern:

```markdown
## Rule 14 — Background Workers Use a Minimal Context

Worker/daemon processes that run outside the HTTP request lifecycle must create a
minimal context for BaseRepository compatibility:

```js
// ✅ correct — worker context factory
export function createWorkerContext() {
  return { db: pool, log: createLogger('service-worker'), user: null, request: null }
}

// Usage in worker:
const ctx  = createWorkerContext()
const repo = new FeatureRepository(ctx)
await repo.findById(id)
```

**Never** call `pool.query()` directly inside worker files — always go through a Repository.
```

---

## Summary Checklist

| Phase | File(s) | Status |
|---|---|---|
| 0 | `backend/base/queryHelper.js` — add `.orderByExpr()` method | ⬜ |
| A | 5 service files — add `maxAttempts: config.otp.maxAttempts` to all `createOtpToken` calls | ⬜ |
| B.1 | Audit `db/repository.ts` imports | ⬜ |
| B.2 | Add `updateStatus` + `findRetryPending` to `emailRepository.js` | ⬜ |
| B.3 | Create `email-service/src/db/workerContext.ts` | ⬜ |
| B.4 | Update `worker.ts` — remove `db/repository` import, use `EmailRepository` | ⬜ |
| B.5 | Delete `email-service/src/db/repository.ts` | ⬜ |
| C.1 | `adminRepository.js` — 12 methods | ⬜ |
| C.2 | `loginRepository.js` — `getPermissions`, `incrementFailed` | ⬜ |
| C.3 | `inviteRepository.js` — `addRole` | ⬜ |
| C.4 | `mfaRepository.js` — `getActiveOtpToken`, `incrementOtpAttempt` | ⬜ |
| C.5 | `otpLoginRepository.js` — 4 methods | ⬜ |
| C.6 | `passwordResetRepository.js` — 2 methods | ⬜ |
| C.7 | `workerRegisterRepository.js` — 2 methods | ⬜ |
| D.1 | `programme/auditRepository.js` — all 4 methods + add QueryHelper import | ⬜ |
| D.2 | `programme/customFieldRepository.js` — `create`, `update`, `deactivate` | ⬜ |
| D.3 | `programme/engineRepository.js` — `upsertResult` | ⬜ |
| D.4 | `programme/programmeRepository.js` — `findById` | ⬜ |
| E.1 | `family/authRepository.js` — all column-enumerated `.select()` calls | ⬜ |
| E.2 | `family/memberRepository.js` — `lookupByNationalId` | ⬜ |
| F | `email/emailRepository.js` — `checkRateLimit` | ⬜ |
| G | ESLint + async/await + indentation across all changed files | ⬜ |
| H | Compliance grep checks + service startup + API spot-checks | ⬜ |
| I | Update `codebase-standards.md` | ⬜ |
