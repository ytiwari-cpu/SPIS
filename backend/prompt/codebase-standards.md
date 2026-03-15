# Codebase Standards

These rules apply across **all services** — `iam-service`, `family-service`, `email-service`, `programme-service`.
Every file touched must comply with all rules below before being considered done.

---

## Rule 1 — Use the Query Builder for All Queries

**Never write raw SQL strings** (except where the QueryHelper fluent API cannot express the query).
Every repository method creates a **fresh** `new QueryHelper(TABLE)` instance inline — there is no
shared `this.sql` in the constructor. Each `QueryHelper` instance is **single-use**: chain
methods, call `.toParam()`, pass `{ text, values }` to `runQuery`.

```js
// ✅ correct — fresh instance per method, toParam → runQuery
const { text, values } = new QueryHelper(TABLE)
  .select('*')
  .where('status', '=', 'active')
  .toParam()
return this.runQuery(text, values, true)
```

### 1.1 — QueryHelper Architecture & Execution Flow

`QueryHelper` (`base/queryHelper.js`) is a **chainable, single-use SQL query builder**.
Each instance is created fresh inside the repository method, built with fluent chaining, then
finalized via `.toParam()`.

**Core execution flow:**

```
new QueryHelper(TABLE)         ← fresh instance, bound to the table
  .select('*')                 ← set operation (SELECT)
  .where('status', '=', 'x')  ← add WHERE clause + placeholder param
  .toParam()                   ← returns { text: 'SELECT * FROM t WHERE status = $1', values: ['x'] }
  → this.runQuery(text, values, true)   ← BaseRepository executes via pg pool; returns rows[]
```

The **only** execution primitive is `this.runQuery(sql, params, handleResult)`:

```js
// SELECT many  — handleResult = true  → returns rows[]
const { text, values } = new QueryHelper(TABLE).select('*').where('id', '=', id).toParam()
return this.runQuery(text, values, true)

// SELECT one   — handleResult = true  → take rows[0]
const { text, values } = new QueryHelper(TABLE).select('*').where('id', '=', id).toParam()
const rows = await this.runQuery(text, values, true)
return rows[0] ?? null

// COUNT        — handleResult = true  → parse rows[0].count
const { text, values } = new QueryHelper(TABLE).count().where('active', '=', true).toParam()
const rows = await this.runQuery(text, values, true)
return parseInt(rows[0]?.count ?? '0', 10)

// INSERT / UPDATE / DELETE — handleResult = false → returns rowCount
const { text, values } = new QueryHelper(TABLE).insert(fields).toParam()
await this.runQuery(text, values, false)

// PAGINATE — manual Promise.all (no paginate() wrapper)
const { text: dataText,  values: dataVals  } = new QueryHelper(TABLE).select('*').where(...).limit(limit).offset(offset).toParam()
const { text: countText, values: countVals } = new QueryHelper(TABLE).count().where(...).toParam()
const [rows, countRows] = await Promise.all([
  this.runQuery(dataText,  dataVals,  true),
  this.runQuery(countText, countVals, true),
])
const total = parseInt(countRows[0]?.count ?? '0', 10)
return { rows, total, page, pageSize }
```

#### QueryHelper fluent API reference

| Category | Method | Description |
|---|---|---|
| **Starters** | `.select(aliasOrColumns)` | SELECT — pass `'*'`, `'col1, col2'`, or a bare alias (`'br'`) to set a FROM alias |
| | `.insert(fields)` | INSERT — pass an object `{ col: value, … }` |
| | `.update(fields)` | UPDATE — pass an object of columns to set |
| | `.delete()` | DELETE |
| | `.count()` | SELECT COUNT(*) |
| **Fields** | `.field(expr, alias)` | Add one field to SELECT (use after `.select('alias')`) |
| **Clauses** | `.where(col, op, val)` | Add a WHERE condition (`=`, `!=`, `>`, `<`, `ILIKE`, `IS`, `IS NOT`) |
| | `.orWhere(col, op, val)` | Add an OR WHERE condition |
| | `.whereNull(col)` | WHERE col IS NULL |
| | `.whereNotNull(col)` | WHERE col IS NOT NULL |
| | `.whereIn(col, values[])` | WHERE col IN ($1, $2, …) |
| | `.whereBetween(col, lo, hi)` | WHERE col BETWEEN $1 AND $2 |
| | `.orderBy(col, dir)` | ORDER BY — `dir` is `'ASC'` or `'DESC'` |
| | `.orderByExpr(expr)` | ORDER BY with a raw expression (e.g. `CASE WHEN …`) — no sanitization |
| | `.limit(n)` | LIMIT |
| | `.offset(n)` | OFFSET |
| | `.groupBy(col)` | GROUP BY |
| | `.having(expr)` | HAVING |
| **Joins** | `.join(table, alias, on)` | INNER JOIN |
| | `.left_join(table, alias, on)` | LEFT JOIN (only `left_join` — no `leftJoin`) |
| **Finalizer** | `.toParam()` | Returns `{ text, values }` — the pg-compatible parameterized query |

> **`_reset()` does not exist** — `QueryHelper` instances are single-use. Create `new QueryHelper(TABLE)` fresh per method.
> **`leftJoin()` does not exist** — use `left_join()` only.
> **`.raw()` does not exist** — removed. All queries must be expressed with the fluent API.

### 1.2 — BaseRepository execution primitive

`BaseRepository` exposes exactly **two public methods**:

```js
// ─── Only execution primitive ────────────────────────────────────────────────
async runQuery(sql, params = [], handleResult = true) → Promise<rows[] | rowCount>
//   sql           — parameterised SQL string from .toParam()
//   params        — bound values ($1, $2, …)  from .toParam()
//   handleResult  — true  → returns rows[]   (SELECT)
//                 — false → returns rowCount  (INSERT / UPDATE / DELETE)

async transaction(callback) → Promise<T>
//   Wraps callback in BEGIN / COMMIT / ROLLBACK
```

There are **no** `findAll`, `findOne`, `count`, `run`, `paginate`, `query`, `queryOne`, `execute` wrappers.
All SQL goes through the above two methods.

---

### 1.3 — SELECT with table alias and named fields

When a query involves joins or aliased columns, use `.select('alias')` to set the main table alias
and `.field(expression, outputAlias)` to declare each field.

```js
// ✅ correct — table alias + named fields + join
async getBusinessRules(status) {
  const { text, values } = new QueryHelper('programme_rule_master')
    .select('br')
    .field('br.rule_id',   'ruleId')
    .field('br.rule_name', 'ruleName')
    .field('br.status',    'status')
    .where('br.status', '=', status)
    .orderBy('br.rule_name', 'ASC')
    .toParam()
  return this.runQuery(text, values, true)
}
```

Simple queries without joins can use `.select()` with a column list or `'*'`:

```js
// ✅ correct — simple select
async findById(familyId) {
  const { text, values } = new QueryHelper('family')
    .select('*')
    .where('family_id', '=', familyId)
    .toParam()
  const rows = await this.runQuery(text, values, true)
  return rows[0] ?? null
}
```

---

### 1.4 — JOIN and LEFT JOIN (3-argument form)

Both `.join()` and `.left_join()` accept **three arguments**:
1. **Table name** — fully qualified schema.table or bare table name
2. **Table alias** — short identifier used in conditions and fields
3. **ON condition** — the join predicate string

```js
// ✅ correct — INNER JOIN + LEFT JOIN
async getWithAudit(ruleId) {
  const { text, values } = new QueryHelper('rule_master')
    .select('br')
    .field('br.rule_id',   'ruleId')
    .field('br.rule_name', 'ruleName')
    .field('at.action',    'auditAction')
    .field('u.email',      'auditUser')
    .join(     'audit_trail', 'at', 'at.object_id = br.rule_id')    // INNER JOIN
    .left_join('iam_users',   'u',  'u.user_id = at.user_id')       // LEFT JOIN
    .where('br.rule_id', '=', ruleId)
    .toParam()
  const rows = await this.runQuery(text, values, true)
  return rows[0] ?? null
}
```

> **`leftJoin()` does not exist** — always use `left_join()`.

---

### 1.5 — SELECT with filters, ordering, and pagination

```js
// ✅ correct — pagination with two independent builders
async list({ search, page, pageSize, status }) {
  const limit  = pageSize
  const offset = (page - 1) * limit

  const base = () => new QueryHelper('family')
    .where('status', '=', status)

  const dataQh  = base().select('f').field('f.family_id', 'familyId').field('f.status', 'status').orderBy('f.created_at', 'DESC').limit(limit).offset(offset)
  const countQh = base().count()

  if (search) {
    dataQh.where('head_first_name', 'ILIKE', `%${search}%`)
    countQh.where('head_first_name', 'ILIKE', `%${search}%`)
  }

  const { text: dataText,  values: dataVals  } = dataQh.toParam()
  const { text: countText, values: countVals } = countQh.toParam()

  const [rows, countRows] = await Promise.all([
    this.runQuery(dataText,  dataVals,  true),
    this.runQuery(countText, countVals, true),
  ])
  const total = parseInt(countRows[0]?.count ?? '0', 10)
  return { rows, total, page, pageSize }
}
```

---

### 1.6 — INSERT, UPDATE, DELETE

INSERT and UPDATE receive the full payload from the service — no computation inside the repository.

```js
// ✅ INSERT — build + runQuery with handleResult = false
async create(fields) {
  const { text, values } = new QueryHelper(TABLE).insert(fields).toParam()
  await this.runQuery(text, values, false)
}

// ✅ UPDATE
async update(id, updates) {
  const { text, values } = new QueryHelper(TABLE)
    .update(updates)
    .where('id', '=', id)
    .toParam()
  await this.runQuery(text, values, false)
}

// ✅ DELETE
async remove(id) {
  const { text, values } = new QueryHelper(TABLE)
    .delete()
    .where('id', '=', id)
    .toParam()
  await this.runQuery(text, values, false)
}

// ❌ wrong — raw SQL (use QueryHelper instead)
async create(fields) {
  await this.runQuery(`INSERT INTO family (name) VALUES ($1)`, [fields.name], false)
}
```

### 1.7 — Patterns that replace raw SQL

The fluent API covers all common patterns. Here are the standard replacements:

#### ON CONFLICT DO NOTHING → separate check + insert methods in repo, orchestrated from service

```js
// ✅ correct — repository exposes two clean methods
// <feature>Repository.js
async isUserRoleExists(userId, roleName) {
  const { text, values } = new QueryHelper(IAM.USER_ROLES)
    .count('*')
    .where('user_id', '=', userId)
    .where('role_name', '=', roleName)
    .toParam()
  const rows = await this.runQuery(text, values, true)
  return parseInt(rows[0]?.count ?? '0', 10) > 0
}

async insertUserRole(userId, roleName) {
  const { text, values } = new QueryHelper(IAM.USER_ROLES)
    .insert({ user_id: userId, role_name: roleName })
    .toParam()
  await this.runQuery(text, values, false)
}

// ✅ correct — service orchestrates the check-then-insert
// <feature>Service.js
const isRoleExists = await this.repo.isUserRoleExists(userId, 'Citizen')
if (!isRoleExists) {
  await this.repo.insertUserRole(userId, 'Citizen')
}
```

#### ON CONFLICT DO UPDATE → try insert, catch 23505, update

```js
// ✅ correct — try insert, fall back to update on unique violation
async upsertResult(record) {
  const { text: insText, values: insValues } = new QueryHelper(TABLE)
    .insert(record).toParam()
  try {
    await this.runQuery(insText, insValues, false)
  } catch (err) {
    if (err.code === '23505') {
      const updateData = { ...record }
      delete updateData.programme_id
      delete updateData.subject_id
      const { text, values } = new QueryHelper(TABLE)
        .update(updateData)
        .where('programme_id', '=', record.programme_id)
        .where('subject_id', '=', record.subject_id)
        .toParam()
      await this.runQuery(text, values, false)
    } else { throw err }
  }
}
```

#### column = column + 1 → select current, compute in JS, update

```js
// ✅ correct — read current, add 1 in JS, update
async incrementFailed(userId) {
  const { text: selText, values: selValues } = new QueryHelper(IAM.USERS)
    .select('*')
    .where('user_id', '=', userId)
    .toParam()
  const rows = await this.runQuery(selText, selValues, true)
  const current = rows[0]?.failed_login_attempts ?? 0
  const next = current + 1

  const { text, values } = new QueryHelper(IAM.USERS)
    .update({ failed_login_attempts: next })
    .where('user_id', '=', userId)
    .toParam()
  await this.runQuery(text, values, false)
  return next
}
```

#### NOW() → pass `new Date().toISOString()` from JS

```js
// ✅ correct — compute timestamp in JS, pass as data
async deactivate(id) {
  const now = new Date().toISOString()
  const { text, values } = new QueryHelper(TABLE)
    .update({ is_active: false, updated_at: now })
    .where('id', '=', id)
    .toParam()
  await this.runQuery(text, values, false)
}
```

#### Column-to-column comparison → JS post-filter

```js
// ✅ correct — filter attempt_count < max_attempts in JS
async getActiveOtpToken(userId, purpose) {
  const now = new Date().toISOString()
  const { text, values } = new QueryHelper(IAM.PASSWORD_RESET_TOKENS)
    .select('*')
    .where('user_id', '=', userId)
    .where('purpose', '=', purpose)
    .where('used', '=', false)
    .where('expires_at', '>', now)
    .orderBy('created_at', 'DESC')
    .limit(1)
    .toParam()
  const rows = await this.runQuery(text, values, true)
  const token = rows[0] ?? null
  if (token && token.attempt_count >= token.max_attempts) return null
  return token
}
```

#### Dynamic WHERE → applyFilters closure

```js
// ✅ correct — shared closure applies the same filters to count and data queries
async list({ page, limit, status, search } = {}) {
  const offset = (page - 1) * limit
  const applyFilters = (qh) => {
    if (status) qh.where('status', '=', status)
    if (search) qh.where('email', 'ILIKE', `%${search}%`)
    return qh
  }

  const { text: countText, values: countValues } = applyFilters(
    new QueryHelper(TABLE).count('*')
  ).toParam()
  const countRows = await this.runQuery(countText, countValues, true)
  const total = parseInt(countRows[0]?.count || '0', 10)

  const mainQh = applyFilters(new QueryHelper(TABLE).select('*'))
  mainQh.orderBy('created_at', 'DESC').limit(limit).offset(offset)
  const { text, values } = mainQh.toParam()
  const rows = await this.runQuery(text, values, true)
  return { rows, total }
}
```

#### CASE WHEN ORDER BY → .orderByExpr()

```js
// ✅ correct — verbatim expression, no sanitization
.orderByExpr(`CASE r.role_name WHEN 'SuperAdmin' THEN 1 WHEN 'Admin' THEN 2 ELSE 3 END`)
.orderBy('r.role_name')
```

---

## Rule 2 — No `.returning('*')` on Insert, Update, or Delete

`.returning('*')` is **forbidden**. The database does not need to send the row back on write operations.

- After **insert**: the controller returns a success message. If the fresh record is genuinely needed, issue a
  **separate** `runQuery` SELECT after the insert.
- After **update/delete**: same — return nothing from the repository. The controller responds with a message.

```js
// ❌ wrong
async create(fields) {
  const { text, values } = new QueryHelper(TABLE).insert(fields).returning('*').toParam()
  const rows = await this.runQuery(text, values, true)
  return rows[0]
}

// ✅ correct — insert only
async create(fields) {
  const { text, values } = new QueryHelper(TABLE).insert(fields).toParam()
  await this.runQuery(text, values, false)
}

// ✅ correct — insert then fetch separately (when fresh record is truly needed)
async create(fields) {
  const { text: insertText, values: insertValues } = new QueryHelper(TABLE).insert(fields).toParam()
  await this.runQuery(insertText, insertValues, false)

  const { text: selectText, values: selectValues } = new QueryHelper(TABLE).select('*').where('id', '=', fields.id).toParam()
  const rows = await this.runQuery(selectText, selectValues, true)
  return rows[0] ?? null
}
```

The controller that calls the service should respond like this:

```js
// ✅ correct controller response after insert
async create(body) {
  await this.familyService.create(body)
  return this.respondCreated(null, 'Family created successfully.')
}
```

---

## Rule 3 — Inline Zod Validation Only — No External Schema Variables

All request/response Zod schemas must be written **inline** inside the endpoint object.
Never export a schema variable and reference it in an endpoint.

```js
// ❌ wrong — exported schema referenced externally
export const CreateFamilySchema = z.object({ head_first_name: z.string() })

const create = {
  request: { body: CreateFamilySchema },
  ...
}

// ✅ correct — schema is inline
const create = {
  path: '/',
  verb: 'POST',
  handler: { controller: FamilyController, method: 'create', arguments: ['request:body'] },
  request: {
    body: z.object({
      head_first_name: z.string().min(1).max(100),
      head_last_name:  z.string().min(1).max(100),
      household_size:  z.number().int().min(1),
      phone:           z.string().min(7).max(50).optional(),
    }),
  },
}
```

Helper sub-schemas used across multiple endpoints within the **same file** may be declared as a
`const` (not exported) at the top of the file:

```js
// ✅ acceptable — file-private helper, not exported
const PhoneSchema = z.string().min(7).max(50).optional()
const GenderSchema = z.enum(['male', 'female', 'other'])
```

---

## Rule 4 — Controller Methods Receive Arguments as Parameters

Controllers must **never** access `this.context.request.body`, `this.context.request.params`,
`this.context.request.query`, or `this.context.req.*` directly.

Declare `arguments` in the endpoint's `handler` object. The framework resolves them and passes them
as positional arguments to the controller method.

### Supported argument tokens

| Token | Resolves to |
|---|---|
| `'request:body'` | `ctx.request.body` (validated by Zod) |
| `'request:params'` | `ctx.request.params` |
| `'request:query'` | `ctx.request.query` |
| `'user'` | `ctx.user` (decoded JWT payload) |

```js
// ❌ wrong — controller fetches from context directly
async update() {
  const { id }   = this.context.request.params   // ❌
  const body     = this.context.request.body      // ❌
  await this.familyService.update(id, body)
}

// ✅ correct — arguments declared in the endpoint, injected as parameters
// api file:
const update = {
  path: '/:id',
  verb: 'PATCH',
  handler: {
    controller: FamilyController,
    method: 'update',
    arguments: ['request:params', 'request:body'],   // ✅ declared here
  },
  middleware: [requireAuth()],
  permission: 'ADMIN.FAMILIES.EDIT',
  request: {
    body: z.object({
      head_first_name: z.string().min(1).max(100).optional(),
      status:          z.enum(['active', 'inactive']).optional(),
    }),
  },
}

// controller:
async update(params, body) {         // ✅ injected as function arguments
  await this.familyService.update(params.id, body)
  return this.respondOk(null, 'Family updated successfully.')
}
```

---

## Rule 5 — Endpoint Definitions — Named Consts, Passed by Reference

Every endpoint must be declared as a **named `const`** and then passed by reference into the
`ApiSchema` endpoints array. Inline anonymous objects inside the array are not allowed.

```js
// ✅ correct — each endpoint is a named const
const list = {
  path:       '/',
  verb:       'GET',
  handler:    { controller: FamilyController, method: 'list', arguments: ['request:query'] },
  middleware: [requireAuth()],
  permission: { anyOf: ['ADMIN.FAMILIES.VIEW', 'CITIZEN.FAMILY.VIEW'] },
}

const create = {
  path:       '/',
  verb:       'POST',
  handler:    { controller: FamilyController, method: 'create', arguments: ['request:body'] },
  middleware: [requireAuth()],
  permission: 'ADMIN.FAMILIES.CREATE',
  request: {
    body: z.object({
      head_first_name: z.string().min(1).max(100),
      head_last_name:  z.string().min(1).max(100),
      household_size:  z.number().int().min(1),
    }),
  },
}

export const FamilyApi = new ApiSchema({
  name:      'Family',
  url:       '/api/v1/families',
  endpoints: [list, create],   // ✅ passed by reference
})
```

---

## Rule 6 — No Service or Repository Passed via Constructor

Controllers, services, and repositories must **never** receive a service or repository instance
as a constructor argument. Each class is responsible for instantiating its own dependency.

```js
// ❌ wrong — service injected via constructor
export class FamilyController extends BaseController {
  constructor(context, familyService) {    // ❌
    super(context)
    this.familyService = familyService
  }
}

// ✅ correct — controller creates its own service
export class FamilyController extends BaseController {
  constructor(context) {
    super(context)
    this.familyService = new FamilyService(context)
  }
}

// ✅ correct — service creates its own repository
export class FamilyService extends BaseService {
  constructor(context) {
    super(context)
    this.familyRepository = new FamilyRepository(context)
  }
}

// ✅ correct — repository has no shared this.sql (single-use QueryHelper per method)
export class FamilyRepository extends BaseRepository {
  constructor(context) {
    super(context)
    // No this.sql — each method creates new QueryHelper(TABLE) inline
  }
}
```

### Naming convention

| Class | Property name |
|---|---|
| Service instance in controller | `this.<feature>Service` — e.g. `this.familyService` |
| Repository instance in service | `this.<feature>Repository` — e.g. `this.familyRepository` |

---

## Rule 7 — Name ApiContext Variables `context`, Not `ctx`

The ApiContext parameter and any local variable holding it must always be named `context`.
`ctx` is ambiguous and must not appear anywhere.

```js
// ❌ wrong
constructor(ctx) {
  super(ctx)
  this.ctx = ctx              // ❌ re-stored as this.ctx
}
this.ctx.request.headers      // ❌

// ✅ correct
constructor(context) {
  super(context)
  // this.context is already set by BaseService / BaseController — do NOT re-assign it
}
this.context.request.headers  // ✅ (prefer injected arguments per Rule 4)
```

---

## Rule 8 — UUID Generation: `BaseService.generateUUID()` Only — Uppercase, In Service Layer

Repositories and controllers must **never** generate UUIDs or perform any data computation.
All primary key generation, data assembly, transformation, and business logic belong **exclusively
in the service layer**.

- Use `BaseService.generateUUID()` — returns `uuidv4().toUpperCase()` (always uppercase UUID v4)
- **Never** use `crypto.randomUUID()`, `uuidv4()` directly, or any UUID package outside `BaseService`
- **Never** generate a UUID inside a repository or controller
- The repository receives a fully assembled, ready-to-persist payload from the service
- The controller receives only the raw HTTP input and passes it straight to the service — no transformation

```js
// ❌ wrong — UUID generated inside repository
async create(data) {
  const id = crypto.randomUUID()    // ❌ never in repository
  const { text, values } = new QueryHelper(TABLE).insert({ id, ...data }).toParam()
  await this.runQuery(text, values, false)
}

// ❌ wrong — UUID generated inside controller
async create(body) {
  const family_id = crypto.randomUUID()          // ❌ never in controller
  await this.familyService.create({ ...body, family_id })
  return this.respondCreated(null, 'Family created.')
}

// ✅ correct — service prepares the full payload, uppercase UUID
async create(data) {
  const family_id = FamilyService.generateUUID()   // ✅ uuidv4().toUpperCase() via BaseService
  await this.familyRepository.create({ family_id, ...data })
}

// ✅ correct — controller: just pass the raw body to the service, nothing else
async create(body) {
  await this.familyService.create(body)            // ✅ no transformation here
  return this.respondCreated(null, 'Family created successfully.')
}

// familyRepository.js — pure persistence
async create(fields) {
  const { text, values } = new QueryHelper(TABLE).insert(fields).toParam()
  await this.runQuery(text, values, false)   // ✅ no logic, just persist
}
```

---

## Rule 9 — No Global `repository.ts` / `repository.js` Outside `features/` — No Raw Queries

There must be no top-level repository file at `src/db/repository.*`, `src/repository.*`, or
anywhere outside a `features/<feature>/` directory. All repository classes live inside their
feature folder and must **only** use `QueryHelper` — never raw SQL strings.

```
// ❌ wrong
src/
  db/
    repository.ts       ← must be deleted

// ✅ correct
src/
  features/
    email/
      emailRepository.js
    health/
      healthRepository.js
```

---

## Rule 10 — All DB Queries Must Live in the Repository — Never in a Service

No query building or execution (`QueryHelper`, `this.runQuery`, etc.)
may appear inside a service file. Services call named repository methods; repositories own all
DB interaction.

```js
// ❌ wrong — query built and executed inside service
export class FamilyService extends BaseService {
  async getActive() {
    const { text, values } = new QueryHelper('family').select('*').where('status', '=', 'active').toParam()
    return this.runQuery(text, values, true)   // ❌ DB access in service
  }
}

// ✅ correct — service delegates to repository
export class FamilyService extends BaseService {
  async getActive() {
    return this.familyRepository.findActive()     // ✅
  }
}

// familyRepository.js
async findActive() {
  const { text, values } = new QueryHelper(TABLE)
    .select('*')
    .where('status', '=', 'active')
    .toParam()
  return this.runQuery(text, values, true)
}
```

---

## Rule 11 — Standard File Structure for Every Feature

Every feature must have exactly these four files with the following internal structure:

### `<feature>Api.js`

```js
import { z }                from 'zod'
import { ApiSchema }        from '../../../../base/apiSchema.js'
import { FamilyController } from './familyController.js'
import { requireAuth }      from '../../../../base/middleware/requireAuth.js'

const auth = [requireAuth()]

// ── file-private sub-schemas (never exported) ─────────────────────────────────
const PhoneSchema = z.string().min(7).max(50).optional()

// ── endpoint consts ───────────────────────────────────────────────────────────
const list   = { ... }
const get    = { ... }
const create = { ... }
const update = { ... }
const remove = { ... }

// ── ApiSchema export ──────────────────────────────────────────────────────────
export const FamilyApi = new ApiSchema({
  name:      'Family',
  url:       '/api/v1/families',
  endpoints: [list, get, create, update, remove],
})
```

### `<feature>Controller.js`

```js
import { BaseController } from '../../../../base/baseController.js'
import { FamilyService }  from './familyService.js'

export class FamilyController extends BaseController {
  constructor(context) {
    super(context)
    this.familyService = new FamilyService(context)
  }

  async list(query) {
    const data = await this.familyService.list(query)
    return this.respondOk(data)
  }

  async create(body) {
    await this.familyService.create(body)
    return this.respondCreated(null, 'Family created successfully.')
  }

  async update(params, body) {
    await this.familyService.update(params.id, body)
    return this.respondOk(null, 'Family updated successfully.')
  }

  async remove(params) {
    await this.familyService.remove(params.id)
    return this.respondOk(null, 'Family deleted successfully.')
  }
}
```

### `<feature>Service.js`

```js
import { BaseService }      from '../../../../base/baseService.js'
import { FamilyRepository } from './familyRepository.js'

export class FamilyService extends BaseService {
  constructor(context) {
    super(context)
    this.familyRepository = new FamilyRepository(context)
  }

  async list(filters) {
    return this.familyRepository.list(filters)
  }

  async create(data) {
    const family_id = FamilyService.generateUUID()
    await this.familyRepository.create({ family_id, ...data })
  }

  async update(familyId, data) {
    await this.familyRepository.update(familyId, data)
  }

  async remove(familyId) {
    await this.familyRepository.remove(familyId)
  }
}
```

### `<feature>Repository.js`

```js
import { BaseRepository } from '../../../../base/baseRepository.js'
import { QueryHelper }    from '../../../../base/queryHelper.js'

const TABLE = 'family'   // ← declare once at module level

export class FamilyRepository extends BaseRepository {
  constructor(context) {
    super(context)
    // No this.sql — each method creates new QueryHelper(TABLE) inline
  }

  async list({ status, page, pageSize }) {
    const limit  = pageSize
    const offset = (page - 1) * limit
    const { text: dataText,  values: dataVals  } = new QueryHelper(TABLE).select('*').where('status', '=', status).orderBy('created_at', 'DESC').limit(limit).offset(offset).toParam()
    const { text: countText, values: countVals } = new QueryHelper(TABLE).count().where('status', '=', status).toParam()

    const [rows, countRows] = await Promise.all([
      this.runQuery(dataText,  dataVals,  true),
      this.runQuery(countText, countVals, true),
    ])
    const total = parseInt(countRows[0]?.count ?? '0', 10)
    return { rows, total, page, pageSize }
  }

  async findById(familyId) {
    const { text, values } = new QueryHelper(TABLE)
      .select('*')
      .where('family_id', '=', familyId)
      .toParam()
    const rows = await this.runQuery(text, values, true)
    return rows[0] ?? null
  }

  async create(fields) {
    const { text, values } = new QueryHelper(TABLE).insert(fields).toParam()
    await this.runQuery(text, values, false)
  }

  async update(familyId, updates) {
    const { text, values } = new QueryHelper(TABLE)
      .update(updates)
      .where('family_id', '=', familyId)
      .toParam()
    await this.runQuery(text, values, false)
  }

  async remove(familyId) {
    const { text, values } = new QueryHelper(TABLE)
      .delete()
      .where('family_id', '=', familyId)
      .toParam()
    await this.runQuery(text, values, false)
  }
}
```

---

## Rule 12 — Redis Must Not Cause Performance Regressions

If Redis is unavailable or slow, all operations must **fail-open** (proceed without cache) —
never block or add latency to the primary request path.

- Always wrap Redis calls in `try/catch`.
- Set a short TTL appropriate to the data volatility.
- On a cache hit the response must be **faster** than the first call.

```js
// ✅ correct — fail-open Redis pattern
async list(filters) {
  const cacheKey = `family:list:${JSON.stringify(filters)}`

  try {
    const cached = await this.redis.get(cacheKey)
    if (cached) return JSON.parse(cached)
  } catch (err) {
    this.log.warn('Cache read failed — proceeding without cache', { err: err.message })
  }

  const data = await this.familyRepository.list(filters)

  try {
    await this.redis.setex(cacheKey, 60, JSON.stringify(data))
  } catch (err) {
    this.log.warn('Cache write failed', { err: err.message })
  }

  return data
}
```

---

## Rule 13 — Strict 4-Layer Architecture Per Feature

Every feature **must** consist of exactly four files. No more, no fewer.
Each layer has a single, non-overlapping responsibility.

```
<feature>/
  <feature>Api.js          ← routing, auth middleware, Zod schemas, endpoint wiring
  <feature>Controller.js   ← HTTP glue only: receive args, call service, return response
  <feature>Service.js      ← ALL business logic, UUID generation, data assembly, computation
  <feature>Repository.js   ← ALL database access, zero logic or computation
```

### Layer responsibilities (strict)

| Layer | Allowed | Forbidden |
|---|---|---|
| **Api** | Route definitions, Zod schemas, middleware, permission declarations | Business logic, DB access, UUID generation |
| **Controller** | Receive injected args, call one service method, return `respondOk`/`respondCreated` | Any computation, data transformation, UUID generation, DB access |
| **Service** | Business logic, UUID via `generateUUID()`, data assembly, calling repository methods | DB queries (`QueryHelper`, `runQuery`, etc.), direct HTTP context usage |
| **Repository** | `new QueryHelper(TABLE)` per method → `.toParam()` → `this.runQuery(text, values, bool)` | Any computation, UUID generation, business logic, `returning('*')`, `this.sql` shared state |

### Controller — HTTP glue only

```js
// ✅ correct — controller is pure HTTP glue
async create(body) {
  await this.familyService.create(body)   // pass raw body straight through
  return this.respondCreated(null, 'Family created successfully.')
}

async update(params, body) {
  await this.familyService.update(params.id, body)
  return this.respondOk(null, 'Family updated successfully.')
}
```

### Service — all computation lives here

```js
// ✅ correct — service assembles the full record before handing to repository
async create(data) {
  const family_id  = FamilyService.generateUUID()    // UUID generated here
  const created_by = this.getUserId()                // auth context used here
  const created_at = new Date().toISOString()        // timestamps set here
  await this.familyRepository.create({ family_id, created_by, created_at, ...data })
}
```

### Repository — pure persistence

```js
// ✅ correct — fresh QueryHelper per method, toParam, runQuery
async create(fields) {
  const { text, values } = new QueryHelper(TABLE).insert(fields).toParam()
  await this.runQuery(text, values, false)   // no logic, just persist
}

async update(familyId, updates) {
  const { text, values } = new QueryHelper(TABLE)
    .update(updates)
    .where('family_id', '=', familyId)
    .toParam()
  await this.runQuery(text, values, false)
}
```

---

## Compliance Checklist

Run these checks on every file before marking it done:

| # | Rule | Verification |
|---|---|---|
| 1a | No raw `this.query / this.queryOne / this.execute` — use `runQuery` | `grep -rn "this\.query\b\|this\.queryOne\b\|this\.execute\b" src/` → 0 results |
| 1b | No `this.findAll / this.findOne / this.run / this.paginate` wrappers | `grep -rn "this\.findAll\b\|this\.findOne\b\|this\.run\b\|this\.paginate\b" src/` → 0 results |
| 1c | No shared `this.sql` in repositories | `grep -rn "this\.sql\s*=" src/features/` → 0 results |
| 1d | No `leftJoin` or `_reset` usage | `grep -rn "leftJoin\|_reset\b" src/` → 0 results |
| 2 | No `.returning('*')` | `grep -rn "\.returning(" src/features/` → 0 results |
| 3 | No exported Zod schemas | `grep -rn "^export const.*Schema" src/features/` → 0 results |
| 4 | No `this.context.request.*` in controllers | `grep -rn "this\.context\.request\." src/features/` → 0 results in `*Controller.js` |
| 5 | All endpoint consts named, passed by reference | No anonymous `{...}` objects inside `endpoints: [...]` |
| 6 | No injected service/repo in constructor | `grep -rn "constructor(context," src/features/` → 0 results (only `context` param) |
| 7 | No `ctx` — use `context` | `grep -rn "\bthis\.ctx\b\|= ctx\b" src/features/` → 0 results |
| 8 | No UUID generation outside service layer | `grep -rn "randomUUID\|uuidv4\|generateUUID" src/features/*Repository.js src/features/*Controller.js` → 0 results |
| 9 | No global repository file outside features/ | `find src -name "repository.*" ! -path "*/features/*"` → 0 results |
| 10 | No query execution inside service files | `grep -rn "new QueryHelper\|this\.runQuery\b" src/features/*Service.js` → 0 results |
| 11 | Standard 4-file structure per feature | Each feature folder has exactly Api / Controller / Service / Repository |
| 12 | Redis wrapped in try/catch | All `redis.get` / `redis.set` calls have surrounding `try/catch` |
| 13a | No computation in controllers | `grep -rn "new Date\|generateUUID\|crypto\|uuidv4" src/features/*Controller.js` → 0 results |
| 13b | No computation in repositories | `grep -rn "new Date\|generateUUID\|crypto\|uuidv4" src/features/*Repository.js` → 0 results |
