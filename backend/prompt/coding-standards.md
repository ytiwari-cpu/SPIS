# SPIS Backend — Coding Standards Reference

This document defines the **non-negotiable conventions** every AI agent and developer must follow
when writing or modifying any backend code in `iam-service`, `family-service`, `email-service`,
or `programme-service`. Read this alongside `codebase-standards.md`.

---

## 1. Language & Module System

| Rule | Detail |
|---|---|
| Language | JavaScript (`.js`) with JSDoc types — no TypeScript in feature code |
| Module system | ESM only — `import` / `export`, never `require()` / `module.exports` |
| Node target | Node 20 LTS |
| `"type": "module"` | Must be set in every service `package.json` |
| File extensions | Always `.js` — include extension in every import path (`'./familyService.js'`) |

---

## 2. Naming Conventions

| Thing | Convention | Example |
|---|---|---|
| Files | `camelCase` | `familyRepository.js`, `loginService.js` |
| Classes | `PascalCase` | `FamilyService`, `LoginRepository` |
| Methods & variables | `camelCase` | `findById`, `headFirstName` |
| Database column names | `snake_case` | `family_id`, `head_first_name`, `created_at` |
| Constants (module-level) | `UPPER_SNAKE_CASE` | `MAX_RETRY_COUNT`, `DEFAULT_PAGE_SIZE` |
| Private class fields | `_camelCase` prefix | `_breaker`, `_pool` |
| API context variable | Always `context` | Never `ctx` |

---

## 3. Four-Layer Architecture (Mandatory)

Every feature folder must contain exactly **four files** — no more, no fewer.

```
src/features/<feature>/
  <feature>Api.js          ← routing + Zod schemas + auth middleware
  <feature>Controller.js   ← HTTP glue only
  <feature>Service.js      ← all business logic and computation
  <feature>Repository.js   ← all database access
```

### What each layer may and may not do

#### `<feature>Api.js`
✅ Define named endpoint `const` objects  
✅ Declare inline Zod request/response schemas  
✅ Attach `requireAuth()` middleware  
✅ Declare permission strings  
✅ Export a single `ApiSchema` instance  
✅ Place `arguments` array **inside** the `handler` object (see §3a below)  
❌ No business logic  
❌ No DB access  
❌ No exported Zod schema variables (file-private `const` is acceptable)  
❌ **No shared response schema files** — all Zod schemas must be inline per endpoint  
❌ **Never put `arguments` at the route level** — it must be inside `handler: { ... }`  

### 3a. API Endpoint Object Structure (Critical)

Every endpoint object in an `*Api.js` file must follow this exact shape:

```js
const myEndpoint = {
  path:       '/resource/:id',
  verb:       'GET',
  handler:    { controller: FeatureController, method: 'get', arguments: ['request:params'] },
  middleware: [auth],
  permission: 'MODULE.FEATURE.VIEW',
  request:    { params: z.object({ id: z.string().uuid() }) },
  response:   z.object({ success: z.boolean(), data: z.any() }),
}
```

#### Rules

| Field | Required | Notes |
|---|---|---|
| `path` | ✅ | Express route path |
| `verb` | ✅ | `GET`, `POST`, `PUT`, `PATCH`, `DELETE` |
| `handler` | ✅ | Object with `controller`, `method`, `arguments` |
| `handler.arguments` | ✅ | Array of strings: `'request:body'`, `'request:params'`, `'request:query'`, `'user'` |
| `middleware` | optional | Array of Express middleware functions |
| `permission` | optional | Permission string or `{ anyOf: [...] }` |
| `request` | optional | `{ body: ZodSchema }`, `{ params: ZodSchema }`, `{ query: ZodSchema }` or combinations |
| `response` | optional | Inline Zod schema for response validation |
| `cache` | optional | `{ ttl: number, prefix: string }` |
| `rateLimit` | optional | Rate limiting config |

#### ⚠️ `arguments` placement — inside `handler`, NEVER at route level

`apiSchema.js` reads arguments via `handler.arguments`. Placing `arguments` at the route
level causes `undefined` because `arguments` is a JavaScript reserved identifier in certain
contexts and gets silently dropped during destructuring.

```js
// ✅ CORRECT — arguments inside handler
{
  path:    '/foo',
  verb:    'POST',
  handler: { controller: FooController, method: 'create', arguments: ['request:body'] },
}

// ❌ WRONG — arguments at route level (will be undefined)
{
  path:      '/foo',
  verb:      'POST',
  handler:   { controller: FooController, method: 'create' },
  arguments: ['request:body'],   // ← BROKEN: apiSchema.js cannot read this
}
```

#### ⚠️ Response schemas must be inline Zod — no shared schema files

Never import response schemas from a shared file. Always write inline:

```js
// ✅ CORRECT — inline Zod
response: z.object({ success: z.boolean(), data: z.array(z.any()) }),

// ❌ WRONG — shared import
import { DataArrayResponse } from '../../../../base/responseSchemas.js'
response: DataArrayResponse,
```

#### `<feature>Controller.js`
✅ Receive injected arguments (body, params, query, user)  
✅ Return `this.respondOk()` / `this.respondCreated()` / `this.respondNoContent()`  
❌ **No data transformation or computation**  
❌ **No UUID generation**  
❌ **No `new Date()`**  
❌ **No business logic**  
❌ **No DB access**  

#### `<feature>Service.js`
✅ UUID generation via `FeatureService.generateUUID()` (inherited from `BaseService`)  
✅ Timestamps: `new Date().toISOString()`  
✅ Data assembly and transformation  
✅ Business rules and validation beyond Zod  
✅ Call repository methods by name  
✅ Orchestrate multiple repository calls  
❌ No `QueryHelper` usage  
❌ No `findAll` / `findOne` / `run` / `runQuery` calls  
❌ No direct DB connection access  

#### `<feature>Repository.js`
✅ Use `new QueryHelper(this.tables.TABLE_NAME)` for every query  
✅ Get all table names from `this.tables` (set by `BaseRepository` from `context.connection.tables`)  
✅ Call `this.runQuery(text, values, handleResult)` as the only execution primitive  
❌ **Never import table constants from `table.js` directly** — always use `this.tables`  
❌ **Never hardcode table name strings** — use `this.tables.XXX`  
❌ **No computation, no UUID generation, no timestamps**  
❌ **No `if`/`for` logic beyond query building**  
❌ **No `returning('*')`**  
❌ **No raw SQL strings**  

---

## 4. UUID Generation

```js
// ✅ Only correct usage
const id = FamilyService.generateUUID()   // returns uuidv4().toUpperCase()

// ❌ All of these are forbidden everywhere
crypto.randomUUID()
uuidv4()
require('uuid').v4()
```

`generateUUID()` is a static method on `BaseService`. Call it as `FeatureService.generateUUID()`
inside that feature's service class. It always returns a **v4 UUID in UPPERCASE**.

---

## 5. Constructor Pattern

```js
// Api — no constructor, just consts + ApiSchema export

// Controller
constructor(context) {
  super(context)
  this.featureService = new FeatureService(context)   // creates its own service
}

// Service
constructor(context) {
  super(context)
  this.featureRepository = new FeatureRepository(context)  // creates its own repo
}

// Repository
constructor(context) {
  super(context)
}
```

### Repository Table Access

- `this.tables` — set automatically by `BaseRepository` from `context.connection.tables`
- Each service's `api.js` assigns `connection.tables = TABLE_CONSTANTS` after creating the connection
- Every query uses `new QueryHelper(this.tables.TABLE_NAME)` to get the table name

```js
// Every query explicitly names its table via this.tables
const { text, values } = new QueryHelper(this.tables.USERS).select('*').where('id', '=', id).toParam()
return await this.runQuery(text, values, true)

// Insert
const { text, values } = new QueryHelper(this.tables.USERS).insert(fields).toParam()
await this.runQuery(text, values, false)
```

- **Never** import table constants from `table.js` in a repository — use `this.tables`
- **Never** pass a service or repository as a constructor argument
- **Never** store `context` again — `super(context)` already sets `this.context`
- **Never** use `this.ctx` — always `this.context`

---

## 6. Error Handling

- Throw `ApplicationError` subclasses — never raw `new Error('...')` in feature code
- Use the structured logger: `this.log.info(...)`, `this.log.warn(...)`, `this.log.error(...)`
- Never swallow errors silently — always log or re-throw
- Redis and external calls must always be wrapped in `try/catch` and fail-open

```js
// ✅ correct
throw ApplicationError.notFound('Family not found')
throw ApplicationError.badRequest('Invalid status value')
throw ApplicationError.forbidden('Insufficient permissions')

// ❌ wrong
throw new Error('Family not found')
```

---

## 7. Async / Await

- Every method that touches the DB, Redis, or any external service must be `async`
- Always `await` — never return a raw Promise from a repository or service method
- Never mix `.then()` chains and `await` in the same function

```js
// ✅ correct
async findById(id) {
  const { text, values } = new QueryHelper(this.tables.USERS).select('*').where('id', '=', id).toParam()
  return await this.runQuery(text, values, true)
}

// ❌ wrong
findById(id) {
  return this.findOne(new QueryHelper(this.tables.USERS).select('*').where('id', '=', id))  // missing async
}
```

---

## 8. Imports

- Always use `.js` extension in import paths (required for ESM)
- Group imports in this order, separated by blank lines:
  1. Node built-ins (`node:path`, `node:crypto`)
  2. Third-party packages (`zod`, `uuid`)
  3. Base layer (`../../../../base/...`)
  4. Feature-local (`./familyService.js`)

```js
// ✅ correct import order
import { z }                from 'zod'

import { BaseController }   from '../../../../base/baseController.js'
import { requireAuth }      from '../../../../base/middleware/requireAuth.js'

import { FamilyService }    from './familyService.js'
```

---

## 9. Formatting

All code must match the ESLint config in `backend/.eslintrc.js`.

**Run `npm run eslint` from `backend/` to auto-fix all fixable issues across the entire project.**

Key rules:

| Rule | Value |
|---|---|
| Indentation | 2 spaces — no tabs |
| Quotes | Single quotes `'` |
| Semicolons | None (ASI) |
| Max line length | 120 characters |
| Trailing comma | Multiline objects/arrays only |
| `===` / `!==` | Always (never `==`) |
| `const` / `let` | Always — never `var` |
| Unused variables | Forbidden — prefix with `_` to intentionally ignore |
| Brace style | `1tbs` — opening brace on the same line as the statement |
| camelCase | Convention by code review — ESLint does **not** enforce or rename variables |

---

## 10. Comments

- JSDoc on all class methods in `base/` layer
- Single-line `//` comments for inline explanation
- No `/* block */` comments in feature code
- No commented-out dead code — delete it

---

## 11. Testing

- Test files live alongside source: `<feature>/<feature>.test.js`
- One `describe` block per class
- One `it`/`test` block per behaviour
- Mock the repository in service tests — never hit the real DB in unit tests
- Use `vitest` (already configured in each service)

---

## 12. Linting

ESLint is configured at `backend/.eslintrc.js` and installed at the `backend/` root.

### Commands (run from `backend/` directory)

| Command | What it does |
|---|---|
| `npm run eslint` | Auto-fix all ESLint issues across the entire project |
| `npm run lint` | Report issues without changing files |
| `npm run lint:fix` | Same as `npm run eslint` |

### What `--fix` auto-corrects

- **Semicolons** — removes any accidental semicolons (project uses ASI / no semicolons)
- **Quotes** — converts double quotes to single quotes
- **Indentation** — enforces 2-space indent
- **Trailing whitespace** — removes trailing spaces
- **Trailing commas** — adds trailing commas to multiline objects/arrays
- **Object/array spacing** — enforces `{ key: val }` and `[a, b]`

### What `--fix` does NOT auto-correct (manual fix required)

- `no-unused-vars` — remove or `_`-prefix unused variables
- `no-console` — replace `console.log` with `this.log.info`
- `consistent-return` — ensure all code paths return (or none do)
- Architecture guards (`no-restricted-syntax`) — use approved patterns

### Safety guarantee

ESLint will **never rename variables**. The `camelcase` rule is turned `off` —
naming conventions (camelCase for JS, snake_case for DB columns) are enforced
by code review, not by the linter. Running `npm run eslint` is always safe.

### When to run

- **Before every commit** — run `npm run eslint` from `backend/`
- **After creating any new Api file** — ensures key alignment is correct
- **After AI-generated code** — agents may not pad keys consistently

---

## Quick Reference Card

```
LAYER          RECEIVES                   DOES                        MUST NOT DO
──────────────────────────────────────────────────────────────────────────────────
Api            (nothing)                  Routes, schemas, auth       Logic, DB
Controller     Injected HTTP args         Call 1 service method       Transform data, UUID, DB
Service        Raw HTTP data              Logic, UUID, timestamps     DB queries
Repository     Complete payload           DB read/write               Logic, UUID, timestamps
```
