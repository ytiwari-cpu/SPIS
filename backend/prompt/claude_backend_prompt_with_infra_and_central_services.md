# Claude Prompt — Backend API Standardization, Redis Caching, Throttling, Validation Conventions

You are a senior backend engineer working on our Node/Express backend. The codebase is partially refactored but still inconsistent and failing in places. Your task is to **clean up, standardize, and fix** the backend architecture and core middleware so it is scalable, professional, and consistent across modules **without breaking any working features**.

You must implement incrementally and verify after each change. Do not skip testing. Do not assume anything. Do not rename any DB tables/columns.

---

## Services in scope

All 4 services must be treated equally:
- `family-service` (port 3001)
- `iam-service` (port 3003)
- `email-service` (port 3005)
- `programme-service` (port 3004 / 3007)

No service is exempt from any requirement in this prompt.

---

## Non-negotiables

1. **Permission-based only** authorization. No role-based checks anywhere.
2. **Each module must have exactly these files** (no missing layers):
   - `<feature>Api`
   - `<feature>Controller`
   - `<feature>Service`
   - `<feature>Repository`
3. **No `routes/` folder** inside any module/feature. All routes must be in `featureApi` only.
4. **Validation must be inline in the Api file** (no separate schema variables or validator files):
   - Do not write: `const enrollCitizenSchema = ...` then reference it.
   - Instead write the Zod schema directly inside the endpoint config object.
5. **Use proper REST conventions**:
   - If the API fetches/updates a resource by ID, ID must come from `params` not request body.
   - Use correct verbs (GET for fetch, POST for create, PATCH/PUT for update, DELETE for delete).
6. **Professional code formatting**:
   - No "single-line sentence-like" endpoint definitions.
   - Consistent indentation, spacing, and line breaks across all Api files.
7. **Permission system — AND + OR semantics, both supported**:
   - Use a single key: `permission` (replaces `permissionsAnyOf` / `permissionsAllOf`).
   - Three supported forms:
     - `permission: "family.view"` → requires exactly that one permission
     - `permission: ["family.view", "family.edit"]` → requires ALL (AND)
     - `permission: { anyOf: ["admin.families.view", "citizen.family.view"] }` → requires at least ONE (OR)
   - Update `base/middleware/requirePermission.js` to handle all three forms.
   - Update `base/apiSchema.js` router builder to read only the `permission` field and auto-inject middleware.
   - Remove `permissionsAnyOf` and `permissionsAllOf` everywhere.
8. **Core-level rate limiting + throttling**:
   - Do NOT add rate limiter individually to every route.
   - Apply centrally in each service's `api.js` using `createRateLimiters` from `base/middleware/rateLimiter.js`.
9. **Redis caching layer**:
   - Implement `base/redisCache.js` as the **single shared** caching utility used by all services.
   - No per-service cache copies.
10. **Logger is always `this.logger` — never imported manually in any feature**:
    - `BaseController`, `BaseService`, `BaseRepository` each create `this.logger = createLogger(this.constructor.name)` in their constructors.
    - All feature classes extend these base classes and call `this.logger` directly — no `import { createLogger }` in any Controller/Service/Repository file.
    - The only place `createLogger` is imported is inside the 3 base classes themselves and in `api.js` / `index.ts`.
11. **DB connection flows through ApiContext — never imported directly in feature files**:
    - `BaseRepository` reads `this.connection = context.connection`. Repositories never import `supabase`, `pool`, or any db client directly.
    - The connection is a **singleton `pg.Pool` created once at service startup** in each service's `api.js` via `createConnection({ connectionString: process.env.DATABASE_URL, schema? })` (from `base/db/createConnection.js`). It is then passed into `ApiSchema.register()` options and forwarded to every `ApiContext` instance. It is **never** created per-request — one pool per service, shared across all requests.
12. **File upload is declarative — never import `multer` in feature files**:
    - Declare `file: { field: 'file' }` in the endpoint config. `ApiSchema` reads this and auto-injects the configured multer middleware from `base/middleware/upload.js`.
    - `base/middleware/upload.js` is the **only** place multer is configured.
13. **All errors must use `ApplicationError` — no raw `throw new Error()` in feature code**:
    - `base/applicationError.js` is the **single source of truth** for all error codes, status codes, and error shapes across all 4 services.
    - Never throw a raw `Error`, `BadRequestError`, or any per-service error class in a Controller, Service, or Repository. Always use the factory methods:
      - `throw ApplicationError.badRequest('Missing family_id')`
      - `throw ApplicationError.notFound('Family not found')`
      - `throw ApplicationError.validation('Invalid input', [{ field: 'name', message: 'Required' }])`
      - `throw ApplicationError.forbidden('SQL editor is disabled in production')`
      - `throw ApplicationError.conflict('National ID already exists')`
      - `throw ApplicationError.tooManyRequests('Slow down')`
      - `throw ApplicationError.internal('Unexpected failure')`
      - `throw ApplicationError.serviceUnavailable('DB unreachable')`
    - For non-standard codes: `throw ApplicationError.create(statusCode, { message, code, details })`
    - The centralized `errorHandler` middleware in `base/middleware/errorHandler.js` catches `ApplicationError` instances and serializes them. **Do NOT catch and re-wrap errors in controllers** — let them propagate to the error handler.
    - Scan all 4 services and replace any raw `throw new Error(...)` or per-service error class with the appropriate `ApplicationError` factory.
14. **QueryHelper (squel-based) must be used for all DB queries — no raw SQL strings in repositories**:
    - **Current state in repo**: `base/queryHelper.js` is pool-bound (`new QueryHelper(pool)`) with old API `.table().select().where(col, op, val).execute()`. `utils/queryHelper.js` is the squel-style builder with `squel.select().from().where('x = ?', v).build().toParam()`. Both exist but neither matches what the prompt requires below.
    - **What to build**: Replace `base/queryHelper.js` entirely with a new squel-style class where the constructor takes a table name (not a pool). Copy/merge the `utils/queryHelper.js` builder as the new `base/queryHelper.js`. The new class must have:
      - Constructor: `new QueryHelper('family')` — table name, no pool
      - `qh.select()` → starts SELECT builder, returns `this`
      - `qh.select().field('*')` — add fields
      - `qh.select().where('status = ?', 'active')` — WHERE with `?` placeholder (squel style)
      - `qh.select().order('created_at', false)` — ORDER BY (false = DESC)
      - `qh.select().limit(n)` / `qh.select().offset(n)` — LIMIT / OFFSET
      - `qh.insert({ col: val })` → INSERT builder
      - `qh.update().set('col', val).where('id = ?', id)` → UPDATE builder
      - `qh.delete().where('id = ?', id)` → DELETE builder
      - `qh.count()` → SELECT COUNT(*) builder
      - `QueryHelper.expr()` — static method returning a WHERE expression builder that chains `.and('col = ?', val)`
      - `qh.build()` → returns an object with a `toParam()` method where `toParam()` → `{ text: string, values: unknown[] }` (using `$1, $2, ...` PostgreSQL placeholders)
      - **⚠️ CRITICAL — the new `QueryHelper` class MUST NOT have a `.returning()` method.** The current `base/queryHelper.js` has a `.returning()` method and `RETURNING` clauses inside `_buildInsert()`, `_buildUpdate()`, and `_buildDelete()`. When you replace `base/queryHelper.js`, **delete the `.returning()` method entirely and remove all `RETURNING` output from `_buildInsert()`, `_buildUpdate()`, and `_buildDelete()`**. The new QueryHelper must never emit a `RETURNING` clause. If any existing call site uses `.returning()`, that is a bug — fix it by issuing a separate SELECT after the write.
    - **BaseRepository execution helpers** (call these in repositories, they execute the built query):
      - `this.findAll(qh)` → executes SELECT, returns `rows[]`
      - `this.findOne(qh)` → executes SELECT, returns `rows[0] ?? null`
      - `this.count(qh)` → executes SELECT count(*), returns number
      - `this.run(qh)` → executes INSERT/UPDATE/DELETE, returns `rowCount` (no rows returned, ever)
      - `this.paginate(dataQh, countQh, { page, pageSize })` → executes data query + count query, returns `{ rows, total, page, pageSize }`
    - **No RETURNING clause — ever.** INSERT and UPDATE never return the inserted/updated row. If the caller needs data after a write, do a separate SELECT after the write.
    - **No raw SQL strings.** Complex conditions use `QueryHelper.expr()`: `QueryHelper.expr().and('status = ?', 'active').and('region = ?', region)`
    - **Delete `utils/queryHelper.js`** after the new `base/queryHelper.js` is in place — no feature file should import from `utils/`.
    - **Scan all 4 services for `supabase.from(...)`, `pool.query(...)`, or any template-literal SQL strings. Convert every one to QueryHelper.** No exceptions.
15. **Soft delete — use existing `status` columns, never hard-delete real records, never add `deleted_at`**:
    - *Soft delete = marking a record as inactive/archived instead of permanently removing it with `DELETE`. The row stays in the DB so audit history is preserved. Hard delete = the row is gone forever and cannot be recovered. SPIS always soft-deletes business records.*
    - The DB tables do NOT have a `deleted_at` column and you must NOT add one. Each table already has its own soft-delete mechanism:
      - `family.family`: `status VARCHAR(20)` — active records have `status = 'active'`. Filter: `.where('status', '!=', 'archived')` or `.where('status', '=', 'active')` as appropriate.
      - `family.family_member`: no status column — deletion is tracked in `family.family_history` as `change_type = 'ARCHIVED'`. Never hard-delete a member row.
      - `programme.programme_master`: `active_flag BOOLEAN` + `status VARCHAR(20) CHECK (status IN ('DRAFT', 'ACTIVE', 'INACTIVE'))`. Filter active programmes: `.where('active_flag', '=', true)`.
      - `programme.programme_citizens`: `status VARCHAR(20) CHECK (status IN ('Active', 'Suspended', 'Exited', 'Pending'))`. Active enrollments: `.where('status', '=', 'Active')`.
      - `family.documents`: `status VARCHAR(20) CHECK (status IN ('UPLOADED', 'PENDING', 'VERIFIED', 'REJECTED'))`. No soft delete — status transitions cover lifecycle.
    - Never run a raw `DELETE` on any of the above tables. For deactivation, `UPDATE ... SET status = 'archived'` (or equivalent valid status value).
    - Hard deletes are only acceptable on junction/log tables: `role_permissions`, `user_permissions`, `rate_limits`, `bounce_feedback` (where TTL/archival handles retention).
16. **Standard pagination response format — all list endpoints must use this exact shape**:
    - All paginated list endpoints must return:
    ```json
    { "success": true, "data": [], "meta": { "page": 1, "pageSize": 20, "total": 145, "totalPages": 8, "hasNext": true, "hasPrev": false } }
    ```
    - `QueryHelper.paginate({ page, pageSize })` returns `{ rows, total, page, pageSize }`. Compute `totalPages = Math.ceil(total / pageSize)`, `hasNext = page < totalPages`, `hasPrev = page > 1` in the service layer.
    - Never return a raw array as the top-level response for list endpoints.
17. **Uniform API response envelope — every response uses exactly one of these four shapes, no exceptions**:
    ```js
    // GET — single resource fetch (ALWAYS an array, even for one record):
    { success: true, data: [{ ...resource }] }
    // GET — paginated list (array with pagination metadata):
    { success: true, data: [...], meta: { page, pageSize, total, totalPages, hasNext, hasPrev } }
    // POST / PATCH / PUT / DELETE — success message only, no resource data ever:
    { success: true, message: 'Family created successfully' }
    // Error — always emitted by errorHandler, never by a controller directly:
    { success: false, error: { code: 'UPPER_SNAKE_CASE', message: 'Human-readable description' } }
    ```
    - **All GET responses return an array** — even single-resource fetches (`GET /family/:id`) return `data: [{ ...resource }]`, not `data: { ...resource }`. The frontend always receives an array and never has to branch on cardinality. Repositories use `findAll()` for all endpoint GET responses — `findAll()` always returns `rows[]`.
    - **Write responses (POST/PATCH/PUT/DELETE) contain only a `message` field — no `data` field at all**. Never return the inserted/updated row in the response. If the client needs the updated record it issues a GET separately. This prevents over-fetching and response shape drift between create and read paths.
    - `message` is a short human-readable sentence describing what happened: `'Family registered successfully'`, `'Member archived'`, `'Programme updated'`.
    - `errorHandler` in `base/middleware/errorHandler.js` is the **only** place errors are serialized to HTTP.
    - **`BaseController` exposes `respondOk(data, meta = null)` as the primary response method** — it builds the standard result shape and delegates to `respondJson(result, 200)`. Additional helpers: `respondNotFound(result)`, `respondError(result, errorCode)`, `respondJson(result, statusCode)`, `sendResponse(result, statusCode)`. All controllers inherit these and never call `res.json` directly:
      - `this.respondOk(rows)` → `{ success: true, data: rows }` — `rows` must be an array from `findAll()`
      - `this.respondOk('Family created successfully')` → `{ success: true, message: '...' }` — pass a string for write responses
      - `this.respondOk(rows, meta)` → `{ success: true, data: rows, meta }` — pass `meta` for paginated responses
      - Endpoint configs **should** declare `request:` and `response:` Zod schemas inline (optional but recommended). When declared, `apiSchema.js` runs `validate.js` before the controller for the request, and `respondJson` validates the response via `req.responseSchema`. When omitted, both stages are skipped with no error. See Part G.
    - Scan all 4 services for any inconsistent shapes (`{ status: 'ok' }`, `{ result: ... }`, raw arrays, responses that return the full inserted/updated row) and replace with the standard envelope.
18. **SQL identifier sanitization — never concatenate raw user input into column/table names**:
    - Parameterized queries (`$1, $2...`) protect values but **cannot protect column names or ORDER BY identifiers** — pg does not support `$1` as a column name placeholder.
    - Add a `sanitizeIdentifier(raw)` utility to `base/queryHelper.js`:
      ```js
      // Strips everything except letters, digits, underscores, dots (schema.table.column)
      // This allows any real column name to pass through (since DB columns only ever use [a-zA-Z0-9_.]),
      // but completely neutralizes SQL injection attempts that rely on special chars like ', ;, --, (, ), UNION, etc.
      export function sanitizeIdentifier(raw) {
        if (typeof raw !== 'string' || raw.length === 0) return null
        const clean = raw.replace(/[^a-zA-Z0-9_.]/g, '')
        return clean.length > 0 ? clean : null
      }
      ```
    - **Rule**: Any time a sort column, order direction, or field name originates from user input (query params, request body), it MUST be passed through `sanitizeIdentifier()` before being given to `orderBy()`, `groupBy()`, or `select()`. The repository is responsible for this call:
      ```js
      // In a repository list() method:
      import { QueryHelper, sanitizeIdentifier } from '../../../../../base/queryHelper.js'

      const safeCol = sanitizeIdentifier(params.sortBy) ?? 'created_at'   // fallback to safe default
      const safeDir = params.order?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC' // only 2 valid values
      qh.table('family').select('*').orderBy(safeCol, safeDir)
      ```
    - The `sanitizeIdentifier` approach is preferred over a hardcoded allowlist because the column set grows over time. `sanitizeIdentifier` strips any injection payload without needing updates as new columns are added to the schema.
    - Apply the same pattern wherever a dynamic field name is used: `groupBy(sanitizeIdentifier(field))`, `select(sanitizeIdentifier(fields).join(', '))`.
    - Wire `sanitizeIdentifier` into `queryHelper.js`'s own `orderBy()` and `groupBy()` methods as a safety net:
      ```js
      orderBy(column, direction = 'ASC') {
        const col = sanitizeIdentifier(column)
        if (!col) throw new Error(`QueryHelper.orderBy: invalid column name "${column}"`)
        const dir = direction.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'
        this._orderClauses.push(`${col} ${dir}`)
        return this
      }
      groupBy(columns) {
        // columns may be comma-separated: 'status, parish'
        const safe = columns.split(',').map(c => sanitizeIdentifier(c.trim())).filter(Boolean).join(', ')
        if (!safe) throw new Error(`QueryHelper.groupBy: no valid column names in "${columns}"`)
        this._groupBy = safe
        return this
      }
      ```
19. **Input sanitization — trim and strip dangerous content inside `QueryHelper`, not in Api schemas**:
    - **Sanitization lives in `QueryHelper`, not in individual Zod schemas or Api files.** This is the single chokepoint for all DB writes — if sanitization is enforced here, it cannot be forgotten by any developer in any feature.\
    - **Trim whitespace** — `QueryHelper._sanitizeValue()` is called automatically on every string value passed to `insert()` and `update()` before the parameterized query is built:
      ```js
      // Add to QueryHelper — called internally, never by feature code:
      _sanitizeValue(value) {
        if (typeof value !== 'string') return value   // numbers, booleans, null, Date — pass through untouched
        return value.trim()                           // strip leading/trailing whitespace from every string
      }
      ```
      Call `_sanitizeValue` on each value inside `_buildInsert()` and `_buildUpdate()` before pushing to `this._params`:
      ```js
      // _buildInsert — apply before params.push:
      const values = Object.values(this._insertData).map(v => this._sanitizeValue(v))

      // _buildUpdate — apply per entry:
      setClauses.push(`${key} = $${this._params.length}`)
      this._params.push(this._sanitizeValue(val))
      ```
    - **Strip HTML from string values** — extend `_sanitizeValue()` to escape HTML entities in string values so no raw `<script>`, `<img onerror=...>`, or HTML markup ever reaches the database:
      ```js
      import { escape } from 'html-escaper'   // npm install html-escaper — tiny, zero deps

      _sanitizeValue(value) {
        if (typeof value !== 'string') return value
        return escape(value.trim())   // trim first, then escape < > & " '
      }
      ```
      Add `html-escaper` to `base/package.json`. All 4 services inherit it automatically.
    - **What `escape()` does**: converts `<` → `&lt;`, `>` → `&gt;`, `&` → `&amp;`, `"` → `&quot;`, `'` → `&#39;`. This neutralizes every XSS vector in stored text. It does NOT alter normal prose — names, addresses, notes look identical when rendered in a non-HTML context.
    - **Fields exempt from HTML escaping**: `QueryHelper` cannot know whether a field is a UUID, enum, or free text — it applies `escape()` to ALL strings uniformly. This is safe: escaping a UUID like `550e8400-e29b-41d4-a716` produces the same string (no special chars). Escaping an enum like `active` also produces `active`. The only visible effect is on strings that actually contain `<`, `>`, `&`, which should never appear in codes or IDs.
    - **Email normalization** — emails must be lowercased before storage to prevent `User@Email.com` and `user@email.com` being treated as two different accounts. This is done in the **service layer** (not QueryHelper, since QueryHelper cannot know which column is an email):
      ```js
      // In loginService / workerRegisterService / any service that stores an email:
      const email = params.email.trim().toLowerCase()
      await this.userRepository.create({ ...params, email })
      ```
      Document this rule in `base/baseService.js` as a JSDoc comment so all service authors see it.
20. **Never expose sensitive DB fields in API responses — strip in the Service layer**:
    - Repositories return raw DB rows. Sensitive columns (`password_hash`, `national_id_hash`, `token_hash`, `otp_secret`, `pin_hash`, `secret_key`) must **never** reach the HTTP response.
    - **Controllers are thin** — they call the Service, receive the result, and call `this.respondOk()`. Controllers never project or transform data. All field-selection logic lives in the Service.
    - **Services own projection** — every Service method that returns data must explicitly pick the safe fields before returning to the Controller. Because all GET responses return arrays (`findAll()` always returns `rows[]`), the service maps over the result array:
      ```js
      // BAD — Service returns raw rows, sensitive fields leak through Controller:
      async getUser(params) {
        const rows = await this.userRepository.findUsers({ userId: params.userId })
        return rows   // ← password_hash, national_id_hash etc. will reach the response
      }

      // GOOD — Service uses findAll(), projects safe fields, returns projected array:
      async getUser(params) {
        // Repositories always use findAll() — never findById() (it doesn't exist in BaseRepository)
        const rows = await this.userRepository.findUsers({ userId: params.userId })
        if (rows.length === 0) throw ApplicationError.notFound('User not found')
        // Map over the array — never return raw rows
        return rows.map(row => ({
          user_id:    row.user_id,
          email:      row.email,
          status:     row.status,
          created_at: row.created_at,
          // password_hash, national_id_hash etc. intentionally omitted
        }))
      }
      ```
      The Controller then simply does:
      ```js
      // Controller — always thin. this.respondOk() for all responses:

      // READ — using handler.arguments: ['request:params']
      // endpoint: handler: { controller: UserController, method: 'getUser', arguments: ['request:params'] }
      async getUser(params) {
        const users = await this.userService.getUser(params)
        this.respondOk(users)   // ← array from service
      }

      // WRITE — using handler.arguments: ['request:params', 'request:body']
      // endpoint: handler: { controller: UserController, method: 'updateUser', arguments: ['request:params', 'request:body'] }
      async updateUser(params, body) {
        await this.userService.updateUser(params, body)
        this.respondOk('User updated successfully')   // ← string → { success, message }
      }

      // PAGINATED — using handler.arguments: ['request:query']
      // endpoint: handler: { controller: UserController, method: 'listUsers', arguments: ['request:query'] }
      async listUsers(query) {
        const { rows, total, page, pageSize } = await this.userService.listUsers(query)
        this.respondOk(rows, { total, page, pageSize, totalPages: Math.ceil(total / pageSize), hasNext: page * pageSize < total, hasPrev: page > 1 })
      }

      // Without arguments — access via this.context when not declared in handler:
      async logout() {
        const token = this.context.request.headers.authorization
        await this.authService.revoke(token)
        this.respondOk('Logged out successfully')
      }
      ```
      > ⚠️ **`findById()` does not exist in `BaseRepository`.** Do not call `this.userRepository.findById()`. Use `this.findAll(qh)` with a WHERE clause (`where('user_id = ?', id)`). The service checks `rows.length === 0` and throws `notFound`. This guarantees the response is always an array, consistent with Rule 17.
    - **Scan all 4 services** — any Service method that returns a raw repository row (`return row`, `return rows`) without projecting must be refactored to return an explicit safe shape.
    - Add a JSDoc comment `/** ⚠️ PROJECT FIELDS HERE — never return raw repo rows. Omit all sensitive columns. */` above `BaseService` to remind future service authors.
    - Sensitive column names that must **never** appear in any HTTP response body: `password_hash`, `national_id_hash`, `token_hash`, `otp_secret`, `pin_hash`, `secret_key`, `private_key`, `encryption_key`.
21. **Startup validation — crash fast on missing required env vars**:
    - Each service's `index.ts` must validate all required environment variables at boot time, **before** the Express server starts listening. A service that starts with `JWT_SECRET=undefined` will silently sign broken tokens; a service with `DATABASE_URL=undefined` will crash on first request instead of at startup.
    - Create `base/validateEnv.js` — a shared validator:
      ```js
      // base/validateEnv.js
      export function validateEnv(required) {
        const missing = required.filter(key => !process.env[key])
        if (missing.length > 0) {
          console.error(`[startup] Missing required environment variables: ${missing.join(', ')}`)
          process.exit(1)  // hard crash — better than a running service that silently misbehaves
        }
      }
      ```
    - Call it as the **first line** of each service's `index.ts`, before any import that reads `process.env`:
      ```ts
      // index.ts — first lines:
      import { validateEnv } from '../../base/validateEnv.js'
      validateEnv([
        'DATABASE_URL', 'JWT_SECRET', 'REDIS_URL', 'CORS_ORIGIN', 'NODE_ENV',
        // add service-specific required vars:
        // iam-service: 'JWT_EXPIRES_IN_SECONDS', 'MFA_ENCRYPTION_KEY', 'WORKER_REGISTRATION_SECRET'
        // family/programme/email: 'IAM_INTERNAL_URL', 'SERVICE_AUTH_KEY', 'CENTRAL_AUDIT_DATABASE_URL'
        // email: 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SERVICE_AUTH_KEY'
      ])
      // ... rest of imports and server setup
      ```
    - Optional vars (with safe defaults) do NOT need to be in this list.

---

## Target architecture (final state)

```
backend/
  base/
    apiContext.js
    apiSchema.js
    applicationError.js
    baseController.js       <- provides this.logger (auto, no manual import needed)
    baseService.js          <- provides this.logger
    baseRepository.js       <- provides this.logger + this.connection + this.qh() + circuit breaker
    logger.js
    queryHelper.js
    redisCache.js           <- NEW (shared by all services)
    table.js
    circuitBreaker.js       <- NEW (H5, used internally by BaseRepository)
    auth/
      signToken.js          <- NEW (M, centralized JWT signing)
      mfaCipher.js           <- NEW (N11, AES-256-GCM encrypt/decrypt for TOTP secrets)
    db/
      createConnection.js   <- NEW (wraps Supabase client → pg-compatible { query() } interface)
    middleware/
      serviceAuth.js         <- NEW (N13, inter-service API key auth)
      cacheHeaders.js       <- NEW (H1)
      errorHandler.js
      loadShedder.js        <- NEW (H6)
      rateLimiter.js
      requestId.js
      requireAuth.js
      requirePermission.js
      throttle.js
      upload.js             <- NEW (centralized multer config, used by ApiSchema)
      validate.js
      waf.js                <- NEW (H2)

  family-service/src/
    api.js
    common/
      auditLogService.js  <- business-logic audit log service (NOT middleware)
    lib/
      pool.js             <- pg-compatible Supabase RPC pool (for QueryHelper in common/)
      supabase.js         <- schema-scoped Supabase client (for feature repositories)
    modules/
      features/
        registration/         <- NEW (migrated from routes/registration.routes.ts)
        registrationApi.js
        registrationController.js
        registrationService.js
        registrationRepository.js
      upload/               <- NEW (migrated from routes/upload.routes.ts)
        uploadApi.js
        uploadController.js
        uploadService.js
        uploadRepository.js
      sql-editor/           <- NEW (migrated from routes/dev.routes.ts, DEV only)
        sqlEditorApi.js
        sqlEditorController.js
        sqlEditorService.js
        sqlEditorRepository.js
      family/
      member/
      address/
      document/
      citizens/
      auth/
    # routes/ folder is DELETED after all 3 migrations are verified

  iam-service/src/
    api.js
    common/
      auditLogService.js    <- business-logic audit log service (NOT middleware)
    features/
      keycloakLogin/
        keycloakLoginApi.js
        keycloakLoginController.js
        keycloakLoginService.js     <- ensure exists
        keycloakLoginRepository.js  <- ensure exists
      login/
        loginApi.js                 <- rename from api.js
        loginController.js
        loginService.js
        loginRepository.js
      # all other features renamed to <featureName>Api.js pattern
    # middleware/rateLimiter.ts DELETED (duplicate of base)

  programme-service/src/
    api.js
    common/
      auditLogService.js  <- business-logic audit log service (NOT middleware)
    lib/
      pool.js             <- pg-compatible Supabase RPC pool (for QueryHelper in common/)
      supabase.js         <- schema-scoped Supabase client (for feature repositories)
    modules/
      features/
        audit/
        auditApi.js
        auditController.js
        auditService.js             <- ensure exists (currently missing)
        auditRepository.js
      customField/
        customFieldApi.js
        customFieldController.js
        customFieldService.js       <- ensure exists (currently missing)
        customFieldRepository.js    <- ensure exists (currently missing)
    services/
      ruleEngine.ts       <- keep as shared domain utility (NOT a feature)
      customFieldManager.ts
      variableCatalog.ts
    # These shared services are NOT converted to 4-layer features.
    # Feature services (engine, customField, variable) import them as utilities.

  email-service/src/
    api.js
    common/
      auditLogService.js  <- business-logic audit log service (NOT middleware)
    modules/
      features/
        email/              <- verify correct 4-layer structure
        health/             <- verify exists
    services/
      rateLimiter.ts      <- DELETED (duplicate of base)
      templateRenderer.ts <- keep (email-specific utility)
```

---

## Part A — Endpoint config standard (Api files)

All endpoints must follow this structure (formatting matters):

```js
const { z } = require("zod");

const createSomething = {
  path: "/something/:id",
  verb: "PATCH",

  // permission: string | string[] (AND) | { anyOf: string[] } (OR)
  permission: { anyOf: ["something.view", "admin.something.view"] },

  // inline Zod schemas only — no external schema variables, no separate schema files
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
    body: z.object({
      subject_type: z.enum(["Individual", "Family"]),
      subject_id: z.string().uuid(),
      active_from: z.string().optional(),
      active_till: z.string().optional(),
    }),
    query: z.object({
      includeArchived: z.coerce.boolean().optional(),
    }).optional(),
  },

  // cache config — optional, only for safe GET endpoints
  cache: {
    enabled: true,
    ttlSeconds: 60,
    key: (ctx) => `something:${ctx.request.params.id}:${ctx.user.sub}`,
  },

  // file upload config — declarative, for multipart/form-data endpoints only
  // ApiSchema reads this and auto-injects multer from base/middleware/upload.js
  // Do NOT import multer in any Api file
  file: {
    field: 'file',     // multipart form field name
    maxSizeMb: 10,     // max file size (default: 10)
    // mimeTypes: ['application/pdf', 'image/jpeg', ...] — optional, defaults to common doc/image types
  },

  // response schema — optional but recommended. Inline Zod schema (no separate files).
  // apiSchema.js stores this on req.responseSchema; respondJson() runs safeParse before sending.
  // Omit to skip response validation entirely.
  response: z.object({
    success: z.boolean(),
    data: z.any(),
  }),

  handler: {
    controller: SomethingController,
    method: "updateSomething",
    // arguments — optional. Pass slices of the request directly as positional args to the method.
    // Supported tokens: 'request:body', 'request:params', 'request:query', 'user'
    // When omitted, the method is called with no arguments (use this.context.request.* inside).
    arguments: ['request:body'],
  },
};
```

### Rules
- Do not put large validation schemas in separate files or variables.
- If no body is needed, do not include `body` in validation.
- If route has an `id`, it must be in params and validated there.
- The `handler` object takes `controller`, `method`, and optionally `arguments`.
  `arguments` is an array of tokens (`'request:body'`, `'request:params'`, `'request:query'`, `'user'`)
  that `ApiSchema` resolves and passes as positional arguments to the controller method.
  When `arguments` is omitted, the method is called with no arguments — use `this.context.request.*` inside.
- Do NOT import `multer` in any Api file. Use `file: { field: '...' }` in the endpoint config instead.
  `ApiSchema` auto-injects the configured multer middleware from `base/middleware/upload.js`.
- Do NOT import `createLogger` in any Controller, Service, or Repository file.
  Use `this.logger` — it is provided automatically by the base class.
- Ensure spacing and line breaks are consistent in every Api file.

---

## Part B — Permission middleware update (AND + OR semantics)

### Required changes

Replace `permissionsAnyOf` and `permissionsAllOf` everywhere with `permission`.

New `permission` field forms:
- `permission: "x"` → requires permission `x`
- `permission: ["x", "y"]` → requires BOTH (AND)
- `permission: { anyOf: ["x", "y"] }` → requires at least ONE (OR)

Update `base/middleware/requirePermission.js`:

```js
export function requirePermission(config) {
  const { permission } = config

  return (req, res, next) => {
    if (!req.user) return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    })

    const userPerms = req.user.permissions || []

    // String: single required permission
    if (typeof permission === 'string') {
      if (!userPerms.includes(permission)) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: `Requires permission: ${permission}` },
        })
      }
      return next()
    }

    // Array: AND semantics — all must be present
    if (Array.isArray(permission)) {
      const missing = permission.filter(p => !userPerms.includes(p))
      if (missing.length > 0) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: `Missing permissions: ${missing.join(', ')}` },
        })
      }
      return next()
    }

    // Object { anyOf }: OR semantics — at least one must be present
    if (permission && typeof permission === 'object' && Array.isArray(permission.anyOf)) {
      const hasAny = permission.anyOf.some(p => userPerms.includes(p))
      if (!hasAny) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: `Requires one of: ${permission.anyOf.join(', ')}` },
        })
      }
      return next()
    }

    next()
  }
}
```

Also update `base/apiSchema.js` to read only `permission` (remove references to `permissionsAnyOf` / `permissionsAllOf`).

Also remove any role-name-based bypass (e.g. `if (roles.includes('SuperAdmin')) return next()`) from `requireAuth.js` and any other middleware. Permission checks are the only access gate — no role-name shortcuts anywhere in the codebase.

### Migration
- Scan all endpoint Api files across all 4 services — including IAM files currently named `api.js` (not yet renamed to `*Api.js`). Do not skip them because they do not match the `*Api.js` glob.
- Replace `permissionsAnyOf: [...]` with `permission: { anyOf: [...] }`.
- Replace `permissionsAllOf: [...]` with `permission: [...]`.
- Verify 401/403/200 behavior on at least 5 endpoints.

---

## Part C — Redis caching layer (centralized, shared across all services)

### Requirements

1. Implement `base/redisCache.js` (caching policy documented in file header):

```js
/**
 * base/redisCache.js — Centralized Redis cache utility
 *
 * CACHING POLICY:
 *
 * WHAT IS CACHED:
 *   - Only safe idempotent GET responses.
 *   - Never POST/PATCH/PUT/DELETE responses.
 *   - Never private user data without user-scoped keys.
 *
 * KEY STRATEGY:
 *   Format: <service>:<resource>:<id-or-filter-hash>:<user-sub>
 *   Example: "family:family:uuid-123:user-sub-456"
 *   - Always include user sub to prevent cross-user data leaks.
 *   - For list endpoints with query params, hash the query object into the key.
 *
 * TTL STRATEGY:
 *   - List endpoints:            60s
 *   - Detail endpoints:         120s
 *   - Config/metadata endpoints: 300s
 *
 * INVALIDATION:
 *   - On write (POST/PATCH/DELETE), delete keys matching the affected resource prefix.
 *   - Use delByPattern('family:family:uuid-123:*') to clear all user-scoped views.
 *   - Invalidation happens inside the Service layer, after a successful write.
 *   - Do NOT invalidate from Controller.
 */

export function createRedisCache(redisClient, logger) {
  return {
    async get(key) { ... },
    async set(key, value, ttlSeconds) { ... },
    async del(key) { ... },
    async delByPattern(pattern) { ... },  // uses Redis SCAN
  }
}
```

2. Implement **cache middleware** auto-injected by `apiSchema.js` when `cache.enabled = true`:
   - Cache HIT: return cached response, set `X-Cache: HIT` header.
   - Cache MISS: pass to controller, cache the response, set `X-Cache: MISS` header.

3. Services receive the cache instance via constructor injection.

4. Invalidation happens inside the Service layer:
   ```js
   // In FamilyService.update():
   await this.cache.delByPattern(`family:family:${uuid}:*`)
   ```

### Redis degradation — fail-open, never crash

All Redis-dependent features must degrade gracefully when Redis is unavailable. A Redis outage must NEVER result in a 500 or take down API request handling.

Implement a `safeRedis` wrapper inside `base/redisCache.js` — wrap every Redis call in try/catch and return a safe fallback:

```js
// All Redis ops in createRedisCache() must use this pattern:
async get(key) {
  try   { return JSON.parse(await this.client.get(key)) }
  catch (err) { this.logger.warn('Redis GET failed — MISS fallback', { key, err: err.message }); return null }
},
async set(key, value, ttlSeconds) {
  try   { await this.client.setex(key, ttlSeconds, JSON.stringify(value)) }
  catch (err) { this.logger.warn('Redis SET failed — cache write skipped', { key, err: err.message }) }
},
async del(key) {
  try   { await this.client.del(key) }
  catch (err) { this.logger.warn('Redis DEL failed — stale cache possible', { key, err: err.message }) }
},
```

**Per-feature behaviour when Redis is down** (all fail-open):
- **Cache** → treat every request as MISS, serve from DB. Never return 500.
- **Rate limiter** → log warning, allow the request. A Redis outage should not block all traffic.
- **Token revocation check** → log warning, allow token through. Short TTL (≤15 min) limits exposure.
- **Load shedder** → uses in-memory counter, unaffected by Redis.

Configure the Redis client in each service's `api.js` with reconnect and fail-fast settings:

```js
import Redis from 'ioredis'

const redisClient = new Redis(process.env.REDIS_URL, {
  retryStrategy:       (times) => Math.min(times * 200, 5000),  // exponential backoff, cap 5s
  maxRetriesPerRequest: 1,       // fail fast per command — don't queue during outage
  enableOfflineQueue:   false,   // reject commands immediately when disconnected
  lazyConnect:          true,    // don't block service startup if Redis is slow
})
redisClient.on('error', (err) => logger.error('Redis error', { err: err.message }))
```

### Verification
- Show at least one endpoint with `X-Cache: HIT` and one with `X-Cache: MISS`.
- Simulate Redis down (stop Redis container) — confirm API requests still return 200, not 500.
- Confirm rate limiter allows requests when Redis is down (check logs for the warning).

---

## Part D — Rate limiting and throttling (core-level, not per endpoint)

### Requirements

Rate limiting utilities exist in `base/middleware/rateLimiter.js` and `base/middleware/throttle.js` but are NOT wired in any service's `api.js`. Wire them now.

First, extend `base/middleware/rateLimiter.js` by adding `write` and `read` buckets inside `createRateLimiters` (keep all existing buckets unchanged — do not remove or rename any):

```js
// Inside createRateLimiters(), add alongside existing buckets:
write: rateLimit({ prefix: 'write', maxRequests: 100, windowSec: 60, redisClient, logger }),
read:  rateLimit({ prefix: 'read',  maxRequests: 500, windowSec: 60, redisClient, logger }),
```

All rate limiter configuration lives exclusively in `base/middleware/rateLimiter.js`. Services only consume — never configure — rate limiters.

Then wire centrally in each service's `api.js`:

```js
import { createRateLimiters } from '../../base/middleware/rateLimiter.js'

const rateLimiters = createRateLimiters(redisClient, logger)

// Auth endpoints — very strict (applied before other route middleware)
app.use('/api/v1/auth', rateLimiters.loginAttempt)

// Write endpoints (POST/PATCH/PUT/DELETE) — moderate
app.use('/api/v1', (req, res, next) => {
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) return rateLimiters.write(req, res, next)
  next()
})

// Read endpoints (GET) — generous
app.use('/api/v1', (req, res, next) => {
  if (req.method === 'GET') return rateLimiters.read(req, res, next)
  next()
})
```

Also fix `code: 429` (numeric) in `base/middleware/rateLimiter.js` → `code: 'RATE_LIMITED'` to match string code convention.

Delete duplicates:
- `iam-service/src/middleware/rateLimiter.ts` — delete, use base version
- `email-service/src/services/rateLimiter.ts` — delete, use base version

Deliver: proof that 429 triggers with correct `Retry-After` and `X-RateLimit-*` headers.

---

## Part E — Migrate routes/ folder in family-service (3 files → 3 new modules)

The `family-service/src/routes/` folder contains 3 files that must each become proper 4-layer modules.
After each migration is verified, delete the source file. Delete the `routes/` folder when all 3 are done.

**`family-service/src/services/` — domain utilities used by the routes being migrated:**
- `uploadService.ts` → convert to `uploadService.js` in place (same folder); used by the upload repository as a utility.
- `historyService.ts` → keep as-is in `src/services/`; imported directly by `registrationService.js`.
- `eventService.ts` → keep as-is; shared domain utility.
- `outboxBridge.ts` → keep as-is; shared domain utility.

Do NOT move or delete these files. Feature services import them as needed. They are not features and do not get a 4-layer structure.

### E1 — registration.routes.ts → registration module

Create `family-service/src/modules/features/registration/` with 4 layers.

Routes to migrate (all at base path `/api/v1/registration`):
- `GET  /family/:familyUuid` — get family for editing
- `PUT  /family/:familyUuid` — update family
- `PUT  /family/:familyUuid/address` — update permanent address
- `PUT  /family/:familyUuid/members/:memberUuid` — update a member
- `POST /family/:familyUuid/save-edits` — bulk save edits with history
- `GET  /check-national-id/:nationalId` — check if national ID exists
- `POST /family` — create family (Step 1)
- `POST /family/:familyUuid/address` — create permanent address (Step 2)
- `POST /family/:familyUuid/documents` — upload family documents (Step 3)
- `GET  /family/:familyUuid/account-info` — account info placeholder (Step 4)
- `POST /family/:familyUuid/members` — create member (Step 5)
- `POST /member/:memberUuid/address` — create member address (Step 6)
- `POST /member/:memberUuid/documents` — upload member documents (Step 7)
- `GET  /member/:memberUuid/account-info` — account info placeholder (Step 8)
- `GET  /family/:familyUuid/review` — review before submit (Step 9)
- `POST /family/:familyUuid/save-draft` — save draft
- `POST /family/:familyUuid/submit` — submit registration
- `GET  /family/:familyUuid/progress` — registration progress
- `POST /family/:familyUuid/members/add` — add member post-registration
- `PATCH /family/:familyUuid/members/:memberUuid/status` — update member status
- `DELETE /family/:familyUuid/members/:memberUuid` — soft-delete member
- `GET  /family/:familyUuid/members/:memberUuid/history` — member transfer history
- `POST /family/:familyUuid/mailing-address` — create mailing address
- `GET  /family/:familyUuid/mailing-address` — get mailing address
- `PUT  /family/:familyUuid/mailing-address` — update mailing address
- `POST /family/:familyUuid/house-services` — create house services
- `GET  /family/:familyUuid/house-services` — get house services
- `PUT  /family/:familyUuid/house-services` — update house services

Permissions:
- Read endpoints: `permission: { anyOf: ['ADMIN.FAMILIES.VIEW', 'CITIZEN.FAMILY.VIEW'] }`
- Write endpoints: `permission: { anyOf: ['ADMIN.FAMILIES.EDIT', 'CITIZEN.FAMILY.EDIT'] }`

Verify all ~28 endpoints work after migration. Then delete `registration.routes.ts`.

### E2 — upload.routes.ts → upload module

Create `family-service/src/modules/features/upload/` with 4 layers.

Routes to migrate (all at base path `/api/v1/upload`):
- `POST /family/:familyId/documents` — upload family document file (multipart)
- `POST /member/:memberId/documents` — upload member document file (multipart)
- `GET  /documents/:documentId/url` — get signed URL for a document
- `DELETE /:ownerType/:ownerId/documents/:documentId` — delete document (polymorphic: FAMILY | MEMBER)
- `DELETE /documents/:documentId` — delete document by ID

**Multer integration — declarative `file:` field (do NOT import multer in any Api file):**

First, implement `base/middleware/upload.js` — the single place multer is configured:

```js
// base/middleware/upload.js
import multer from 'multer'

const DEFAULT_MIME_TYPES = [
  'application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

// Magic-byte signatures for allowed types — checks first bytes of the actual file content,
// not just the MIME header (which can be spoofed by renaming a .exe to .pdf)
const MAGIC_BYTES = {
  'application/pdf':  [0x25, 0x50, 0x44, 0x46],         // %PDF
  'image/jpeg':       [0xFF, 0xD8, 0xFF],                // JFIF / EXIF
  'image/png':        [0x89, 0x50, 0x4E, 0x47],          // \x89PNG
  'image/gif':        [0x47, 0x49, 0x46],                // GIF
  'image/webp':       [0x52, 0x49, 0x46, 0x46],          // RIFF (WebP container)
}

function matchesMagicBytes(buffer, mimeType) {
  const magic = MAGIC_BYTES[mimeType]
  if (!magic) return true  // for types without a known signature (docx etc.), trust MIME check
  return magic.every((byte, i) => buffer[i] === byte)
}

// Sanitize filename — strip path traversal sequences and dangerous chars.
// Keeps only alphanumerics, dots, underscores, hyphens.
function sanitizeFilename(filename) {
  return filename
    .replace(/\.\.\/|\.\.\\/g, '')         // strip ../ and ..\ path traversal
    .replace(/[^a-zA-Z0-9._\-]/g, '_')    // replace all other non-safe chars with _
    .slice(0, 255)                         // cap filename length
}

export function createUploadMiddleware({ field = 'file', maxSizeMb = 10, mimeTypes } = {}) {
  const allowed = mimeTypes || DEFAULT_MIME_TYPES
  return multer({
    storage: multer.memoryStorage(),  // buffer in memory — max 10 MB; see H4 for multi-replica note
    limits: { fileSize: maxSizeMb * 1024 * 1024, files: 1 },  // 1 file per request max
    fileFilter: (_req, file, cb) => {
      // 1. Sanitize filename before it touches any file system path
      file.originalname = sanitizeFilename(file.originalname)
      // 2. Reject if declared MIME type is not in the allowlist
      if (!allowed.includes(file.mimetype)) return cb(null, false)
      // Magic byte check runs post-upload in the controller (buffer is needed):
      //   if (!matchesMagicBytes(req.file.buffer, req.file.mimetype))
      //     throw ApplicationError.badRequest('File content does not match declared type')
      cb(null, true)
    },
  }).single(field)
}

// Export matchesMagicBytes so controllers can call it after receiving req.file.buffer:
export { matchesMagicBytes }
```

Then `base/apiSchema.js` auto-injects it when the endpoint config has a `file` field:

```js
// Inside ApiSchema.register() — add to the middleware chain build logic:
if (route.file) {
  chain.push(createUploadMiddleware(route.file))  // injected before controller, after auth
}
```

> ⚠️ **Multer error handling — update `base/middleware/errorHandler.js`**: Multer throws `MulterError` instances (not `ApplicationError`) when the file size limit is exceeded or the wrong field name is used. The centralized `errorHandler.js` must handle these:
> ```js
> import multer from 'multer'
>
> // In errorHandler.js, BEFORE the ApplicationError check:
> if (err instanceof multer.MulterError) {
>   if (err.code === 'LIMIT_FILE_SIZE') {
>     return res.status(413).json({ success: false, error: { code: 'FILE_TOO_LARGE', message: 'File exceeds the maximum allowed size' } })
>   }
>   return res.status(400).json({ success: false, error: { code: 'UPLOAD_ERROR', message: err.message } })
> }
> ```
> Without this, an oversized file upload returns a generic 500 instead of a proper 413.

Upload Api files use only the declarative `file:` field — no multer import:

```js
// uploadApi.js — no multer import needed
const uploadFamilyDocument = {
  path: '/family/:familyId/documents',
  verb: 'POST',
  file: { field: 'file', maxSizeMb: 50 },  // ApiSchema auto-injects multer
  permission: { anyOf: ['ADMIN.FAMILIES.EDIT', 'CITIZEN.FAMILY.EDIT'] },
  request: {
    params: z.object({ familyId: z.string().uuid() }),
  },
  handler: { controller: UploadController, method: 'uploadFamilyDocument' },
}
```

The controller accesses the uploaded file via `context.request.file`. The repository handles all Supabase Storage calls (upload, delete, signed URL).

`uploadService.ts` stays in `family-service/src/services/` — convert it to `uploadService.js` in place. The upload repository imports it as a utility.

Permission: `permission: { anyOf: ['ADMIN.FAMILIES.EDIT', 'CITIZEN.FAMILY.EDIT'] }` (all routes)

Verify all 5 upload endpoints work. Then delete `upload.routes.ts`.

### E3 — dev.routes.ts → sql-editor module (DEV only)

Create `family-service/src/modules/features/sql-editor/` with 4 layers.

Routes to create:
- `POST /sql` — execute SQL (SELECT only)
- `GET  /schema` — list table accessibility
- `GET  /health` — DB connection test
- `GET  /table/:tableName` — inspect table data with pagination
- `POST /seed` — insert sample data
- `DELETE /clear` — delete all data (requires `{ confirm: "DELETE_ALL_DATA" }`)

Production guard: enforce at the **service layer**. The service's first action in every method:
```js
if (process.env.NODE_ENV === 'production') {
  throw ApplicationError.forbidden('SQL editor is disabled in production')
}
```

Permission: `permission: "admin.dev.sql"` (all endpoints require this).

Verify all 6 endpoints work in development. Then delete `dev.routes.ts`.
Update `family-service/src/api.js` to mount all 3 new modules and remove the old `devRouter`, `registrationRouter`, `uploadRouter` imports:
- Mount `registrationApi` at `/api/v1/registration`
- Mount `uploadApi` at `/api/v1/upload`
- Mount `sqlEditorApi` at `/api/v1/dev` (preserves backward compatibility with existing dev tooling)

---

## Part F — Module completeness (all services)

### F1 — Naming convention (IAM service)

Rename all `api.js` files to `<featureName>Api.js`:
- `login/api.js` → `login/loginApi.js`
- `mfa/api.js` → `mfa/mfaApi.js`
- `invite/api.js` → `invite/inviteApi.js`
- `passwordReset/api.js` → `passwordReset/passwordResetApi.js`
- `workerRegister/api.js` → `workerRegister/workerRegisterApi.js`
- `otpLogin/api.js` → `otpLogin/otpLoginApi.js`
- `admin/api.js` → `admin/adminApi.js`

Update imports in `iam-service/src/api.js`. Name instances as `<featureName>Controller`, etc.

### F2 — Missing layers

Create these missing files:

| Service | Feature | Create |
|---|---|---|
| programme-service | audit | `auditService.js` |
| programme-service | customField | `customFieldService.js`, `customFieldRepository.js` |
| iam-service | keycloakLogin | `keycloakLoginService.js`, `keycloakLoginRepository.js` |
| iam-service | health | `healthService.js`, `healthRepository.js` |

### F3 — programme-service shared domain utilities

Keep `programme-service/src/services/ruleEngine.ts`, `customFieldManager.ts`, `variableCatalog.ts` as shared domain utilities — they are NOT independent features and do NOT get Api/Controller/Repository wrappers.
Feature services (engineService, customFieldService, variableService) import them directly.

**However, these utilities have critical issues that must be fixed in-place:**

**F3a — ruleEngine.ts: fix N+1 batch evaluation (see N14)**

The `evaluateAllSubjects()` function loops through up to 1000 families and calls `evaluateSubject()` sequentially for each one. Inside `evaluateSubject`, `fetchSubjectData()` makes 3–5 Supabase REST calls per family, and `evaluateGroupRule()` makes 2 additional calls per group rule. For 1000 families × 3 group rules = **5000+ sequential HTTP round-trips** — this is the single biggest performance bottleneck in the system.

Fix this per N14 below — pre-fetch all data in batch, evaluate in memory.

**F3b — customFieldManager.ts: fix ALTER TABLE injection (see N15)**

The `createCustomField()` function interpolates `target_table` and `fieldName` directly into an `ALTER TABLE` SQL string. Even though `fieldName` is derived from `display_name` via regex, the `target_table` is user input that goes straight into SQL. Fix per N15 below — whitelist target tables, validate types strictly.

### F4 — email-service

- Verify `email-service/src/modules/features/email/` has correct 4-layer structure.
- Verify `email-service/src/modules/features/health/` exists and is correct.
- Delete duplicate `email-service/src/services/rateLimiter.ts`.
- **Add inter-service auth** (see N13) — all email endpoints (except `/health`) must require a `X-Service-Key` header. This prevents any network caller from triggering email sends.

### F5 — Layer rules (strict)

- **Controller**: extracts request data from `ApiContext`, calls Service methods, returns response. No DB access. Uses `this.logger` (provided by `BaseController`).
- **Service**: business logic only. No Supabase client calls. No HTTP response handling. Uses `this.logger` (provided by `BaseService`).
- **Repository**: builds and executes DB queries only. Returns raw data. Uses `this.logger` (provided by `BaseRepository`). Accesses the DB via `this.qh()` (QueryHelper) or `this.query()` / `this.queryOne()` / `this.execute()` helpers. Never imports `supabase`, `pool`, or any db client directly.

**Logger rule**: Base classes create a named logger instance in their constructor: `this.logger = createLogger(this.constructor.name)`. All feature classes inherit this and call `this.logger.info(...)` etc. directly. No feature file ever imports `createLogger`.

**Connection rule**: `BaseRepository` reads `this.connection = context.connection`. The connection is the `pg.Pool` created once at service startup by `createConnection({ connectionString: process.env.DATABASE_URL, schema? })` in `api.js` — it is NOT imported in feature files.

Update `BaseController`, `BaseService`, and `BaseRepository` to add logger initialization if not already present.

---

## Part G — Request and response validation with Zod

> **When does validation actually happen?**
>
> | Stage | When | What validates | Key: `request:` or `response:` |
> |---|---|---|---|
> | Request | BEFORE controller runs | `apiSchema.js` sets `req.requestSchema` then pushes `validate()` — `validate.js` reads `req.requestSchema` and calls `safeParse` on params/body/query | `request:` |
> | Response | INSIDE `respondJson`, before bytes leave the socket | `respondJson` reads `req.responseSchema` (stored by `apiSchema.js`) and calls `safeParse` when present — same pattern, same error shape | `response:` |
>
> Both optional but recommended. When declared, both use `safeParse` and return the same `VALIDATION_ERROR` shape. When omitted, the stage is skipped with no error.

`apiSchema.js` sets `req.requestSchema` and `req.responseSchema` as the first middleware in every chain. `validate()` reads `req.requestSchema`; `respondJson` reads `req.responseSchema`. Both use `safeParse`, both skip when null. No monkey-patching, no `res.json` override.

**Two-stage validation — both owned by `apiSchema.js`:**

1. **Request validation** (BEFORE controller): `apiSchema.js` delegates to `base/middleware/validate.js`. Invalid input → `400` immediately with a structured error listing every field failure.

2. **Response validation** (INSIDE `respondJson`): `apiSchema.js` stores `route.response` on `req.responseSchema` before constructing `ApiContext`. When the controller calls `respondOk` → `respondJson`, the method reads `context.request.responseSchema` and calls `safeParse` if present — same pattern as `validate.js` on the request side. Skipped when `response:` is omitted.

**`base/middleware/validate.js` — how Zod actually validates the request:**
```js
// base/middleware/validate.js
import { ZodError } from 'zod'

/**
 * Middleware factory — validates req.params, req.body, req.query
 * against the Zod schemas declared in the endpoint's `request:` config.
 *
 * Each sub-schema (params / body / query) is optional — only declared
 * schemas are validated. Undeclared ones pass through untouched.
 *
 * On failure: 400 with { success: false, error: { code: 'VALIDATION_ERROR', fields: [...] } }
 * On success: req.params / req.body / req.query are replaced with the
 *             Zod-parsed (and coerced) values so controllers always see clean data.
 */
export function validate(schema) {
  return (req, res, next) => {
    const errors = []

    if (schema.params) {
      const result = schema.params.safeParse(req.params)
      if (!result.success) {
        errors.push(...result.error.issues.map(i => ({ field: `params.${i.path.join('.')}`, message: i.message })))
      } else {
        req.params = result.data   // replace with coerced values
      }
    }

    if (schema.body) {
      const result = schema.body.safeParse(req.body)
      if (!result.success) {
        errors.push(...result.error.issues.map(i => ({ field: `body.${i.path.join('.')}`, message: i.message })))
      } else {
        req.body = result.data
      }
    }

    if (schema.query) {
      const result = schema.query.safeParse(req.query)
      if (!result.success) {
        errors.push(...result.error.issues.map(i => ({ field: `query.${i.path.join('.')}`, message: i.message })))
      } else {
        req.query = result.data
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', fields: errors },
      })
    }

    next()
  }
}
```

`apiSchema.js` injects it into the middleware chain when `request:` is declared:
```js
// Inside ApiSchema.register() — middleware chain build:
if (route.request) {
  // req.requestSchema already set — validate() reads it and skips when null
  // but we still only push it when needed for clarity
  chain.push(validate())   // validate.js: safeParse on params/body/query
}
```

**Example — what the controller sees after validation passes:**
```js
// Endpoint config:
request: {
  params: z.object({ familyId: z.string().uuid() }),
  body: z.object({ household_size: z.number().int().min(1).max(20) }),
}

// In controller — req.params and req.body are already validated and coerced:
async create(context) {
  const { familyId } = context.request.params   // guaranteed UUID string
  const { household_size } = context.request.body  // guaranteed integer 1–20
  // No manual checks needed — if we reach here, the data is valid
  await this.familyService.create(familyId, household_size)
  this.respondOk('Family created successfully')
}
```

**Example — what a validation failure looks like:**
```json
// POST /api/v1/families with body { "household_size": "not-a-number" }
// → 400:
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "fields": [
      { "field": "body.household_size", "message": "Expected number, received string" }
    ]
  }
}
```

**`apiSchema.js` — wiring of request and response validation:**
```js
// Per-request: store optional response schema on req, then build context:
req.responseSchema = route.response ?? null          // null when response: is omitted
const context = new ApiContext(req, connection)      // 2 args

// Request validation — optional: only pushed when request: is declared:
if (route.request) {
  chain.push(validate())   // validate.js: reads req.requestSchema, skips when null
}

// ... (auth, cache middleware run here) ...
// Resolve handler.arguments before invoking:
// Supported tokens: 'request:body' → ctx.request.body, 'request:params' → ctx.request.params,
//                   'request:query' → ctx.request.query, 'user' → ctx.user
const args = resolveArgs(handler.arguments, context)  // [] when arguments omitted
await ctrl[handler.method](...args)
// When controller calls this.respondOk() → this.respondJson() → safeParse fires if req.responseSchema is set
```

**`BaseController` — response methods (all delegate to `respondJson`):**
```js
// Builds standard success envelope then delegates to respondJson:
respondOk(data, meta = null) {
  let result
  if (meta != null) {
    result = { success: true, data, meta }       // paginated list
  } else if (typeof data === 'string') {
    result = { success: true, message: data }    // write operation (string → message)
  } else {
    result = { success: true, data }             // read (object or array)
  }
  this.respondJson(result, 200)
}

// 404 helper:
respondNotFound(result = {}) {
  this.respondJson(result, 404)
}

// Error helper (tracks/logs 500s):
respondError(result = {}, errorCode = 500) {
  if (errorCode === 500) {
    // track/log server error here (Tracker.trackTrace or equivalent)
  }
  this.respondJson(result, errorCode)
}

// Core JSON sender — validates response shape (if schema declared) then sends:
respondJson(result = {}, statusCode = 200) {
  const schema = this.context.request.responseSchema  // set by apiSchema.js, null when omitted
  if (schema) {
    const check = schema.safeParse(result)
    if (!check.success) {
      this.logger.error('Response validation failed', { errors: check.error.issues })
      if (process.env.NODE_ENV === 'production') {
        return this.context.response.status(500).json({
          success: false,
          error: { code: 'RESPONSE_VALIDATION_ERROR', message: 'Internal server error' },
        })
      }
      return this.context.response.status(500).json({
        success: false,
        error: { code: 'RESPONSE_VALIDATION_ERROR', message: 'Response shape mismatch', fields: check.error.issues },
      })
    }
  }
  this.context.response.status(statusCode).json(result)
}

// Raw (non-JSON) sender — no response validation:
sendResponse(result = {}, statusCode = 200) {
  this.context.response.status(statusCode).send(result)
}
```

> `respondJson` is the single exit point for all JSON responses. It reads `context.request.responseSchema` (stored on `req` by `apiSchema.js`) and validates with `safeParse` if present — the same pattern `validate.js` uses on the request side. No monkey-patching, no hidden overrides. When `response:` is omitted from the endpoint config, validation is skipped.

**Inline endpoint config — `request:` and `response:` are optional but recommended:**
```js
const getFamily = {
  path: '/:id',
  verb: 'GET',
  permission: { anyOf: ['ADMIN.FAMILIES.VIEW', 'CITIZEN.FAMILY.VIEW'] },
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  response: z.object({                  // REQUIRED — owned by apiSchema.js, not by controller
    success: z.boolean(),
    data: z.array(z.object({
      uuid:           z.string().uuid(),
      family_id:      z.string(),
      household_size: z.number(),
    })),
  }),
  handler: { controller: FamilyController, method: 'get' },
}

// Write endpoint — message shape:
const createFamily = {
  path: '/',
  verb: 'POST',
  permission: { anyOf: ['ADMIN.FAMILIES.EDIT', 'CITIZEN.FAMILY.EDIT'] },
  request: {
    body: z.object({ household_size: z.number().int().min(1) }),
  },
  response: z.object({                  // REQUIRED on write endpoints too
    success: z.boolean(),
    message: z.string(),
  }),
  handler: { controller: FamilyController, method: 'create' },
}
```

### Verification
- Remove `response:` from one endpoint config — confirm server refuses to start with a clear error.
- Add a deliberate response mismatch (wrong field name in service projection) — confirm `RESPONSE_VALIDATION_ERROR` in dev, generic 500 in prod.
- Fix the mismatch and confirm 200.

---

## Part H — Production traffic hardening (application and Docker-Compose level)

We have no cloud environment yet. Implement everything at the application and Docker-Compose level in a vendor-neutral way.

### H1) Cache-Control headers

- Implement a `setCacheHeaders(policy)` utility in `base/middleware/`:
  - `policy: 'no-store'` → `Cache-Control: no-store, no-cache` (private/user data)
  - `policy: 'public'` → `Cache-Control: public, max-age=60, s-maxage=300` (safe endpoints)
  - `policy: 'immutable'` → `Cache-Control: public, max-age=31536000, immutable` (static assets)
- Add `Vary: Authorization` on all authenticated endpoints.
- Apply via endpoint config field `cachePolicy: 'no-store' | 'public' | 'immutable'`.
- `base/apiSchema.js` injects this header middleware automatically.

### H2) WAF + Bot protection (application level)

Implement `base/middleware/waf.js` that:
- Blocks requests with suspicious `User-Agent` values (known scanners: sqlmap, nikto, masscan, zgrab, dirbuster, nmap, etc.)
- Rejects POST/PATCH/PUT requests whose `Content-Type` header is neither `application/json` nor `multipart/form-data`. Implementation:
  ```js
  if (['POST', 'PATCH', 'PUT'].includes(req.method)) {
    const ct = req.headers['content-type'] || ''
    if (!ct.startsWith('application/json') && !ct.startsWith('multipart/form-data')) {
      return res.status(415).json({ code: 'BLOCKED', message: 'Request blocked' })
    }
  }
  ```
  > **Why only POST/PATCH/PUT?** GET requests have no body and no `Content-Type` header — they pass through untouched. Query parameters on GET requests (e.g. `?page=1&status=active`) are validated downstream by Zod in the endpoint's `query` schema. DELETE is also excluded intentionally — soft-deletes in this API don't send a body (they're status-flag updates), and the `express.json` 1mb guard covers the rare case where a DELETE carries a confirm payload. `application/x-www-form-urlencoded` is intentionally blocked — this is a JSON + multipart-only API; form-encoded POSTs are never valid here.
- Rejects oversized query strings (> 2000 chars)
- **Rejects requests whose query string contains raw SQL injection patterns** — scan `req.url` (after the `?`) for the following patterns and reject any match with `403`:
  ```js
  const SQL_INJECT_RE = /('\s*(or|and|union|select|insert|update|delete|drop|truncate|exec|execute|declare)\s)|(--)|(;\/\*)|(\/\*.*?\*\/)|\bxp_|\bexec\b/i
  if (SQL_INJECT_RE.test(req.url)) return res.status(403).json({ code: 'BLOCKED', message: 'Request blocked' })
  ```
- **Rejects requests where any query-string value contains null bytes** (`%00`) — these are used to bypass string-length checks and can corrupt logs:
  ```js
  const hasNullByte = Object.values(req.query).some(v => typeof v === 'string' && v.includes('\x00'))
  if (hasNullByte) return res.status(400).json({ code: 'INVALID_INPUT', message: 'Invalid characters in request' })
  ```
- Returns `403` with `{ code: 'BLOCKED', message: 'Request blocked' }` — no detail about why (prevents enumeration)

Apply globally in each service's `api.js` before all routes.

### H3) Health endpoints + graceful shutdown

Standardize the `/health` response shape across all 4 services:

```json
{
  "status": "ok",
  "service": "family-service",
  "version": "1.0.0",
  "uptime": 123.45,
  "db": "ok",
  "redis": "ok"
}
```

The project has no root-level `docker-compose.yml` yet. Create one at the project root that:
1. Covers all 4 services (family, iam, email, programme), Redis, and PostgreSQL.
2. Does NOT replace or conflict with the existing Keycloak setup at `common/infra/docker/docker-compose.keycloak.yml` — reference it using Docker Compose `include:` so Keycloak continues working exactly as before.
3. Keeps all existing service names, port numbers, and network names identical — do not change anything that is already working.
4. Is additive only. All existing `start-*.sh` scripts and workflows must continue to work unchanged.

Add `healthcheck` entries for all 4 services:
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 15s
```

Implement graceful shutdown in each service's `index.ts`:
```ts
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received — shutting down gracefully')
  server.close(async () => {
    await pool.end()        // close DB pool
    await redis.quit()      // close Redis connection
    process.exit(0)
  })
  // Force exit after 10s if in-flight requests don't finish
  setTimeout(() => process.exit(1), 10_000)
})
```

### H4) Horizontal scaling

Ensure all services are horizontally scalable:
- No in-memory session state (already JWT + Redis — verify)
- Rate limiter counters in Redis (already done — verify)
- Background workers: use named queues, one worker instance per queue

Create two files:

**`backend/docker-compose.scale.yml`** (Docker Compose override — run with `docker compose -f docker-compose.yml -f docker-compose.scale.yml up`):

```yaml
# docker-compose.scale.yml
# Scale override: run 3 replicas of each service behind an Nginx load balancer.
# Usage: docker compose -f docker-compose.yml -f docker-compose.scale.yml up --scale family-service=3 --scale iam-service=3 --scale programme-service=3 --scale email-service=3

services:
  nginx:
    image: nginx:1.25-alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx/nginx.scale.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - family-service
      - iam-service
      - programme-service
      - email-service
    networks:
      - spis-network

  family-service:
    ports: []          # remove direct port exposure when behind Nginx
    deploy:
      replicas: 3
      restart_policy:
        condition: on-failure

  iam-service:
    ports: []
    deploy:
      replicas: 3
      restart_policy:
        condition: on-failure

  programme-service:
    ports: []
    deploy:
      replicas: 3
      restart_policy:
        condition: on-failure

  email-service:
    ports: []
    deploy:
      replicas: 3
      restart_policy:
        condition: on-failure
```

**`backend/nginx/nginx.scale.conf`**:

```nginx
worker_processes auto;
events { worker_connections 2048; }

http {
  # ── Rate limiting zone (shared memory, keyed by real client IP) ──────────────
  limit_req_zone $http_x_forwarded_for zone=api:10m rate=100r/s;
  limit_req_zone $http_x_forwarded_for zone=auth:10m rate=10r/s;

  # ── Upstream blocks — Docker DNS resolves each service name to all replicas ──
  # least_conn distributes to the replica with fewest active connections.
  # keepalive reuses TCP connections to upstreams (avoids per-request handshakes).

  upstream family {
    least_conn;
    server family-service:3001;
    keepalive 32;
  }
  upstream iam {
    least_conn;
    server iam-service:3003;
    keepalive 16;
  }
  upstream programme {
    least_conn;
    server programme-service:3004;
    keepalive 16;
  }
  upstream email {
    least_conn;
    server email-service:3005;
    keepalive 8;
  }

  server {
    listen 80;
    client_max_body_size 15m;

    # ── Security headers ─────────────────────────────────────────────────────
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy no-referrer always;
    add_header X-XSS-Protection "1; mode=block" always;

    # ── Proxy defaults (applied to all location blocks) ──────────────────────
    proxy_http_version 1.1;                          # required for keepalive upstreams
    proxy_set_header Connection "";
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;  # real client IP for app rate limiter
    proxy_set_header X-Forwarded-Proto $scheme;

    # ── Family service routes ─────────────────────────────────────────────────
    location /api/v1/families     { limit_req zone=api  burst=50 nodelay; proxy_pass http://family; }
    location /api/v1/members      { limit_req zone=api  burst=50 nodelay; proxy_pass http://family; }
    location /api/v1/addresses    { limit_req zone=api  burst=50 nodelay; proxy_pass http://family; }
    location /api/v1/documents    { limit_req zone=api  burst=30 nodelay; proxy_pass http://family; }
    location /api/v1/citizens     { limit_req zone=api  burst=50 nodelay; proxy_pass http://family; }
    location /api/v1/registration { limit_req zone=api  burst=20 nodelay; proxy_pass http://family; }
    location /api/v1/upload       { limit_req zone=api  burst=10 nodelay; proxy_pass http://family; }

    # ── IAM service routes ───────────────────────────────────────────────────
    location /api/v1/auth         { limit_req zone=auth burst=5  nodelay; proxy_pass http://iam; }
    location /api/v1/users        { limit_req zone=api  burst=30 nodelay; proxy_pass http://iam; }
    location /api/v1/invite       { limit_req zone=api  burst=10 nodelay; proxy_pass http://iam; }
    location /api/v1/mfa          { limit_req zone=api  burst=10 nodelay; proxy_pass http://iam; }
    location /iam/                { limit_req zone=api  burst=30 nodelay; proxy_pass http://iam; }

    # ── Programme service routes ─────────────────────────────────────────────
    location /api/v1/programmes   { limit_req zone=api  burst=50 nodelay; proxy_pass http://programme; }
    location /api/v1/engine       { limit_req zone=api  burst=30 nodelay; proxy_pass http://programme; }
    location /api/v1/audit        { limit_req zone=api  burst=30 nodelay; proxy_pass http://programme; }

    # ── Email service routes ─────────────────────────────────────────────────
    location /api/v1/email        { limit_req zone=api  burst=20 nodelay; proxy_pass http://email; }

    # ── Health endpoints (per service, no rate limit) ────────────────────────
    location = /health/family     { proxy_pass http://family/health; }
    location = /health/iam        { proxy_pass http://iam/health; }
    location = /health/programme  { proxy_pass http://programme/health; }
    location = /health/email      { proxy_pass http://email/health; }
    location = /health            { proxy_pass http://family/health; }  # default
  }
}
```

**Key design decisions in this config:**
- `$http_x_forwarded_for` used as rate-limit key so limits apply to real clients, not Nginx itself
- `proxy_http_version 1.1` + `Connection ""` + `keepalive 32` — reuses TCP connections to upstream replicas (avoids per-request TCP handshake overhead)
- `least_conn` — sends new request to the replica with the fewest active connections (better than round-robin under variable request duration)
- Per-service `/health/*` routes — each service's health endpoint is reachable through Nginx individually for monitoring tools
- Auth routes get their own stricter `auth` zone (10 req/s vs 100 req/s for API zone)

**Verify horizontal scalability:**
- Confirm no `Map`, `Set`, or local variable used as session/rate-limit store in any service (`api.js` or middleware)
- Rate limiters must use Redis (already enforced by `base/middleware/rateLimiter.js` — verify `redisClient` is passed)
- Start 2+ replicas with `docker compose up --scale family-service=2` and confirm requests round-robin correctly with `curl -s http://localhost/health` multiple times


### H5) Circuit breakers

Implement `base/circuitBreaker.js` using the `opossum` npm package. **First add it to `base/package.json` and install** — run `npm install opossum` inside the `base/` directory before creating `circuitBreaker.js`:
```json
// base/package.json — add to dependencies:
"opossum": "^8.0.0"
```
- Timeout: 3s
- Error threshold: 50%
- Reset timeout: 30s
- Fallback for reads: return `null` (caller handles it)
- Fallback for writes: throw `503 SERVICE_UNAVAILABLE`

Logger is sourced from the base logger (same as all other base utilities — no logger parameter needed):

```js
import CircuitBreaker from 'opossum'
import { createLogger } from './logger.js'

const log = createLogger('circuit-breaker')

export function createCircuitBreaker(fn, options = {}) {
  const breaker = new CircuitBreaker(fn, {
    timeout: 3000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
    ...options,
  })
  breaker.fallback(() => null)
  breaker.on('open',     () => log.error('Circuit breaker OPEN',     { fn: fn.name }))
  breaker.on('close',    () => log.info('Circuit breaker CLOSED',    { fn: fn.name }))
  breaker.on('halfOpen', () => log.warn('Circuit breaker HALF-OPEN', { fn: fn.name }))
  return breaker
}
```

**Centralize at `BaseRepository` level** — all DB calls across all services are auto-protected with no per-repository wiring:

```js
// In BaseRepository constructor (base/baseRepository.js):
import { createCircuitBreaker } from './circuitBreaker.js'
import { QueryHelper }          from './queryHelper.js'
import { createLogger }         from './logger.js'

export class BaseRepository {
  constructor(context) {
    this.context    = context
    this.connection = context.connection  // pg-compatible: { query(sql, params) → { rows, rowCount } }
    this.logger     = createLogger(this.constructor.name)
    // All DB calls go through this breaker — no individual repo needs to know about it
    this._breaker = createCircuitBreaker(
      async (queryFn) => queryFn(),
      { name: this.constructor.name }
    )
  }

  // QueryHelper factory — returns a fluent SQL builder for the given table.
  // QueryHelper is a builder only (no connection inside it) — pass the result to
  // this.findAll() / this.findOne() / this.run() / this.count() for execution.
  // Must match L6 spec: new QueryHelper(table), NOT new QueryHelper(this.connection).
  qh(table) { return new QueryHelper(table) }

  // Raw SQL helpers (all protected by circuit breaker)
  async query(sql, params = []) {
    return this._breaker.fire(() => this.connection.query(sql, params)).then(r => r.rows)
  }
  async queryOne(sql, params = []) {
    return this.query(sql, params).then(rows => rows[0] ?? null)
  }
  // Write operation — if breaker is open, throw 503 immediately (never silently swallow a write failure)
  async execute(sql, params = []) {
    if (this._breaker.opened) throw ApplicationError.serviceUnavailable('Database temporarily unreachable')
    return this._breaker.fire(() => this.connection.query(sql, params)).then(r => r.rowCount)
  }

  // Transaction helper (circuit breaker wraps the whole transaction)
  async transaction(callback) {
    return this._breaker.fire(async () => {
      await this.connection.query('BEGIN')
      try {
        const result = await callback()
        await this.connection.query('COMMIT')
        return result
      } catch (err) {
        await this.connection.query('ROLLBACK')
        throw err
      }
    })
  }
}
```

All repository methods that extend `BaseRepository` use `this.qh()`, `this.query()`, `this.queryOne()`, or `this.execute()` — the circuit breaker fires for every DB call automatically.

**External HTTP clients** (Keycloak auth server, email provider): Wrap at the service layer using `createCircuitBreaker` directly, since these calls live in Service files, not repositories.

### H6) Load shedding

Implement `base/middleware/loadShedder.js`:
- Tracks in-flight request count using an atomic in-memory counter (or Redis INCR/DECR)
- If in-flight > `MAX_INFLIGHT` (default 200, configurable via env `MAX_INFLIGHT_REQUESTS`):
  - Return `503` with `{ code: 'SERVICE_OVERLOADED', message: 'Server is under heavy load, retry shortly' }`
  - Set `Retry-After: 5` header
- Never shed `/health` endpoints
- Decrement counter on response finish (use `res.on('finish', ...)`)

Apply globally in each service's `api.js` after `requestId` middleware.

### H8) Request timeout middleware

Implement `base/middleware/requestTimeout.js`:
- Hard timeout of **30 seconds** on every HTTP request (configurable via `REQUEST_TIMEOUT_MS` env var)
- If the request is still open after the timeout, send `503 { code: 'REQUEST_TIMEOUT', message: 'Request timed out' }` and close the socket
- Never apply to `/health` endpoints (they have their own 10s timeout in Docker healthcheck)

```js
// base/middleware/requestTimeout.js
export function requestTimeout(ms = 30_000) {
  return (req, res, next) => {
    if (req.path === '/health') return next()
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(503).json({ success: false, error: { code: 'REQUEST_TIMEOUT', message: 'Request timed out' } })
      }
    }, ms)
    res.on('finish', () => clearTimeout(timer))
    res.on('close',  () => clearTimeout(timer))
    next()
  }
}
```

Apply globally in each service's `api.js` as the **fourth** middleware (after `helmet`, `requestId`, `compression`, before `loadShedder`). The full middleware order is documented in Part K.

### H9) Response compression

Install `compression` in all 4 services and in `base/package.json`:

```bash
npm install compression
```

Wire in each service's `api.js` as the **third** middleware (after `helmet`, `requestId`, before `requestTimeout` and `loadShedder`):

```js
import compression from 'compression'

app.use(compression({
  level:     6,       // zlib level 1–9; 6 is the optimal speed/size trade-off
  threshold: 1024,    // only compress responses > 1 KB (tiny responses cost more to compress than send raw)
  filter: (req, res) => {
    if (req.headers.accept === 'text/event-stream') return false  // never compress SSE
    return compression.filter(req, res)
  },
}))
```

This cuts JSON list responses by **60–80%** (e.g. a 50 KB family list becomes ~10 KB). No application code changes — gzip is negotiated automatically via `Accept-Encoding: gzip`.

**Verify**: `curl -H 'Accept-Encoding: gzip' --compressed -sv http://localhost:3001/api/v1/families` — confirm `Content-Encoding: gzip` in response headers.

### H7) Verification checklist (mandatory)

Provide evidence for each item:
- Cache-Control headers on 3 different endpoint types (no-store, public, immutable)
- WAF blocks a request with User-Agent `sqlmap/1.0`
- `/health` returns correct shape for all 4 services
- Graceful shutdown: SIGTERM causes in-flight requests to complete before process exits
- Circuit breaker trips when DB call throws repeatedly (simulate by throwing from repository)
- Load shedder returns 503 when threshold is exceeded (use `ab -n 500 -c 300` or similar)
- Request timeout: slow endpoint (mocked with `setTimeout(60000)`) returns 503 after 30s

---

## Part I — Centralized services only (no duplicates)

### Rules

1. Single source of truth — all shared utilities live in `/base`.
2. No re-implementation — remove duplicates, replace imports.
3. Verify before deleting — confirm all imports updated, service starts, endpoints work.

### Known duplicates to remove

| Duplicate file | Replace with |
|---|---|
| `iam-service/src/middleware/rateLimiter.ts` | `base/middleware/rateLimiter.js` |
| `email-service/src/services/rateLimiter.ts` | `base/middleware/rateLimiter.js` |

---

## Part J — Fix tsconfig.json errors (all services)

### Root cause

All service `tsconfig.json` files set `rootDir: "./src"` but their `include: ["src/**/*"]` also picks up the `.js` files in `../../base/` (because TypeScript follows imports). TypeScript then tries to emit `.js` output for base files into the service's `dist/`, but those `.js` files already exist as source, causing:

```
Cannot write file '...base/applicationError.js' because it would overwrite input file.
```

### Fix — apply to all 4 services

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "allowJs": true,
    "checkJs": false,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": false,       // <- REMOVE declaration output (not needed for services)
    "declarationMap": false,    // <- REMOVE
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": [
    "node_modules",
    "dist",
    "../../base/**"             // <- ADD: prevents base .js files from being treated as TS input
  ]
}
```

Apply to:
- `iam-service/tsconfig.json`
- `family-service/tsconfig.json`
- `programme-service/tsconfig.json`
- `email-service/tsconfig.json`

### Fix engineService.js TypeScript error

`programme-service/src/modules/features/engine/engineService.js` has:
```
Declaration emit requires private name 'EvaluationResult' from ruleEngine.
```

This error is caused by `declaration: true` in tsconfig. Removing `declaration: true` (above) will resolve it.
Verify the error is gone after tsconfig fix. No code change needed in `engineService.js`.

### Fix registration.routes.ts TypeScript errors

`registration.routes.ts` has implicit `any` type errors on lambda parameters (`m`, `d`).
Do NOT fix these manually — they will be gone once the file is migrated to the `registration` module (Part E1) and replaced with JavaScript.

---

## Part K — Infrastructure documentation

After completing Phase 8, create `backend/docs/INFRASTRUCTURE.md`. This file is the **single reference** for how all infrastructure features work in this project. It must document:

### For each of the 6 features below, document:
- **What it is** (one sentence)
- **Where it lives** (file path)
- **How it is wired** (centralized in `api.js`? in `BaseRepository`? in `apiSchema.js`?)
- **How it works** (brief flow — what happens when the feature activates)
- **How to configure it** (env vars or config values)
- **How to verify it** (the curl/test command that proves it works)

### Features to document:

| Feature | Where implemented | Wiring point |
|---|---|---|
| **WAF / Bot protection** | `base/middleware/waf.js` | Globally in each `api.js` before all routes |
| **Rate limiting** | `base/middleware/rateLimiter.js` | Globally in each `api.js` — auth/write/read tiers |
| **Circuit breaker** | `base/circuitBreaker.js` | Auto in `BaseRepository.execute()` + manual for HTTP clients |
| **Load shedding** | `base/middleware/loadShedder.js` | Globally in each `api.js` after `requestId` |
| **Redis cache** | `base/redisCache.js` | Auto-injected by `ApiSchema` when endpoint declares `cache:` |
| **Horizontal scaling** | `docker-compose.scale.yml` | Docker Compose replica config + Nginx LB |

Also create a **`.env.example`** file in each service directory documenting every environment variable the service needs. Required variables (must be set, no default fallback):

| Variable | Services | Description |
|---|---|---|
| `SUPABASE_URL` | all | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | all | Service role key (never the anon key) |
| `JWT_SECRET` | iam, family, programme, email | Shared HMAC secret for token signing/verification |
| `JWT_EXPIRES_IN_SECONDS` | iam | Max 900 (15 min) |
| `JWT_REFRESH_EXPIRES_IN_SECONDS` | iam | Max 604800 (7 days) |
| `REDIS_URL` | all | e.g. `redis://redis:6379` |
| `CORS_ORIGIN` | all | Frontend origin — never `*` in production |
| `NODE_ENV` | all | `development` \| `production` |
| `PORT` | each service | 3001 / 3003 / 3004 / 3005 |
| `MAX_INFLIGHT_REQUESTS` | all | Default 200 |
| `REQUEST_TIMEOUT_MS` | all | Default 30000 |
| `IAM_INTERNAL_URL` | family, programme, email | e.g. `http://iam-service:3003` |
| `CENTRAL_AUDIT_DATABASE_URL` | family, programme, email | IAM DB pooler URL (port 6543) — used by auditLog middleware to write central audit rows to IAM DB |
| `KEYCLOAK_URL` | iam | Only if Keycloak sync is enabled |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | email | Mailer credentials |

Also include a **Middleware execution order** section showing the exact order middleware runs per request:

```
Request in
  0. helmet             (npm: helmet)                       — security response headers (first, always)
  1. requestId          (base/middleware/requestId.js)      — attach X-Request-Id
  2. compression        (npm: compression)                  — gzip responses > 1 KB
  3. requestTimeout     (base/middleware/requestTimeout.js) — kill hung requests after 30s
  4. loadShedder        (base/middleware/loadShedder.js)    — reject if in-flight > MAX_INFLIGHT
  5. waf                (base/middleware/waf.js)             — reject bad agents/SQL patterns/null bytes
  6. rateLimiter        (applied in api.js per tier)         — reject if rate exceeded
  7. requireAuth        (base/middleware/requireAuth.js)     — validate JWT + Redis revocation check
  8. requirePermission  (auto by ApiSchema)                  — check permission field
  9. cacheHeaders       (auto by ApiSchema per cachePolicy)  — set Cache-Control + Vary headers
  10. cacheMiddleware   (auto by ApiSchema if cache.enabled) — return HIT if cached
  11. multerUpload      (auto by ApiSchema if file: present) — parse multipart; magic-bytes check in controller
  12. validate          (auto by ApiSchema if request:)     — Zod request schema (body/params/query)
  13. controller        — extract context → call service → this.respondOk() (always validates response)
  14. cache store       (auto by ApiSchema on MISS)          — store result in Redis
Response out
  (circuit breaker wraps every this.run() / this.findAll() call inside step 13)
  (auditLog middleware fires on response finish — non-blocking)
```

---

## Part L — Database layer consolidation

Replace the existing `base/baseDbRepository.js` with a single `base/baseRepository.js` that has logger, connection, QueryHelper, and circuit breaker built in. Ensure the DB connection flows through `ApiContext` rather than being imported per-repository. All 4 services must share one `createConnection` factory.

### Why this is needed

Currently:
- `family-service` repositories import `supabase` directly from `lib/supabase.js` — not testable, not injectable
- `iam-service` repositories import `pool` directly from `db/pool.ts` — same problem
- `base/baseDbRepository.js` exists but repositories bypass it or pass the pool as a constructor arg rather than getting it from context
- `context.connection` does not exist — repositories bypass context entirely for DB access

### L1 — Create `base/db/createConnection.js`

Create a shared pg-compatible connection factory that all 4 services use. Replace the current Supabase-RPC-based `pool.ts` in `iam-service` with this. **No custom SQL functions are defined or required — connect directly to the database using the standard pg connection string Supabase provides.**

Each Supabase project exposes a **connection pooler URL** (port 6543, IPv4-accessible) found in the Supabase dashboard under *Project Settings → Database → Connection string → URI* (select the Pooler/PgBouncer mode). Set this as `DATABASE_URL` in each service's `.env`.

> ⚠️ **`search_path` for family and programme** — because their tables live in the `family` / `programme` schema (not `public`), set `options=-csearch_path=family,public` in the pooler URL **or** let the pool emit `SET search_path` on every new connection (shown below). IAM and email use the `public` schema and need no changes.

```js
// base/db/createConnection.js
import pg from 'pg'

/**
 * Creates a standard pg.Pool connected to the given Supabase project.
 * Use the Supabase pooler connection string (port 6543, IPv4) from the dashboard.
 *
 * @param {object} options
 * @param {string} options.connectionString - DATABASE_URL from env (pooler URL, port 6543)
 * @param {string} [options.schema]         - For family / programme services: 'family' | 'programme'
 *                                             Leave undefined for IAM and email (public schema).
 * @returns {{ query(text, values?): Promise<{ rows, rowCount }>, end(): Promise<void> }}
 */
export function createConnection({ connectionString, schema } = {}) {
  const pool = new pg.Pool({
    connectionString,
    // ── Connection pool sizing ─────────────────────────────────────────────
    // Supabase free tier: 15 total connections across ALL services.
    // Supabase Pro / paid: 200+. Adjust max per service to fit within your plan:
    //   e.g. 4 services × 3 replicas × max=10 = 120 connections (needs paid plan)
    //   for free tier: max=3 (4 services × 1 replica × 3 = 12, leaves 3 for migrations)
    max:                     parseInt(process.env.DB_POOL_MAX || '10', 10),
    idleTimeoutMillis:       30_000,   // release idle clients after 30s
    connectionTimeoutMillis:  5_000,   // fail fast if pool is exhausted — don't queue forever
    // ── Query safety limits ────────────────────────────────────────────────
    // Kills runaway or unindexed queries before they starve the connection pool.
    // pg passes these as session-level SET commands on each new connection.
    options: '--statement_timeout=10000 --lock_timeout=5000',
  })

  // For services whose tables live in a non-public schema, set search_path on every
  // new connection so bare table names resolve correctly without a schema prefix.
  if (schema) {
    pool.on('connect', (client) => {
      client.query(`SET search_path = ${schema}, public`)
    })
  }

  pool.on('error', (err) => {
    console.error('[createConnection] idle client error', err.message)
  })

  return {
    async query(text, values = []) {
      const result = await pool.query(text, values)
      return { rows: result.rows, rowCount: result.rowCount ?? result.rows.length }
    },
    async end() { await pool.end() },
  }
}
```

**`pg` must be in `base/package.json`** — `createConnection.js` imports `pg`. Before creating it, add `pg` to `base/package.json`:
```json
"dependencies": {
  "pg": "^8.18.0"
}
```
All 4 services already have `pg` in their own `package.json`, so no service-level change is needed.

**Environment variables** — each service must have `DATABASE_URL` pointing to its own Supabase project's pooler URL:

```
# iam-service
DATABASE_URL=postgresql://postgres.wrxrstmncezssrscrkxs:[password]@aws-0-[region].pooler.supabase.com:6543/postgres

# family-service  (schema = 'family')
DATABASE_URL=postgresql://postgres.xdupcfxxcbltjmdgzzhf:[password]@aws-0-[region].pooler.supabase.com:6543/postgres

# programme-service  (schema = 'programme')
DATABASE_URL=postgresql://postgres.fwtcccwgijfcngtuawlx:[password]@aws-0-[region].pooler.supabase.com:6543/postgres

# email-service
DATABASE_URL=postgresql://postgres.qlehzgxxhbbiniouwgta:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

**Migrate `iam-service/src/db/pool.ts`** — replace its entire implementation with `createConnection` from above. The exported `pool` object keeps the same interface (`{ query, end }`), so no repository changes are needed in that file.

```ts
// iam-service/src/db/pool.ts  (after migration)
import { createConnection } from '../../../base/db/createConnection.js'

export const pool = createConnection({
  connectionString: process.env.DATABASE_URL!,
  // IAM uses public schema — no schema override needed
})
```

### L2 — Create `base/baseRepository.js` (see H5 code block — already specified there)

The class specification with circuit breaker integration is already written in Part H, H5.
Create `base/baseRepository.js` from that exact spec. Delete `base/baseDbRepository.js` once all services are migrated.

### L3 — Update `base/apiContext.js`

Simplify to 2 params: `(request, connection)`. Express sets `req.res` internally so `response` is not needed. Logger needs no service name or child logger — `createLogger()` with no arguments. Both schemas (`req.requestSchema`, `req.responseSchema`) are set by `apiSchema.js` before context is constructed.

```js
// AFTER (2 params only):
constructor(request, connection) {
  this.request    = request
  this.response   = request.res                       // Express sets req.res
  this.user       = request.user
  this.requestId  = request.requestId || request.headers?.['x-request-id'] || crypto.randomUUID()
  this.connection = connection
  this.logger     = createLogger()
}
```

> `context.request` and `context.response` are the canonical names. `req.responseSchema` (optional, set by `apiSchema.js`) is read directly from `context.request.responseSchema` inside `respondJson`. `context.connection` is read by `BaseRepository`.

**`BaseController` response methods** — full implementation is in Part G. Summary:
- `respondOk(data, meta)` → builds result shape → `respondJson(result, 200)`
- `respondNotFound(result)` → `respondJson(result, 404)`
- `respondError(result, errorCode)` → `respondJson(result, errorCode)`
- `respondJson(result, statusCode)` → `safeParse` against `context.request.responseSchema` (when set) → `context.response.status(statusCode).json(result)`
- `sendResponse(result, statusCode)` → `context.response.status(statusCode).send(result)`

### L4 — Update `base/apiSchema.js`

Clean constructor `({ name, url, endpoints = [] })`. `register(app, options)` — no `basePath` param (url is set in constructor). Attach both schemas to `req` as the first middleware in every chain. `validate()` takes no args — reads `req.requestSchema`, skips when null. Symmetric with `respondJson` which reads `req.responseSchema`:

```js
// BEFORE:
register(app, basePath, options = {}) {
  const { logger, redisClient } = options
  // ...
  const ctx = new ApiContext(req, res, logger)
}

// AFTER:
constructor({ name, url, endpoints = [] } = {}) {
  this.name   = name ?? null
  this.url    = url?.trim() ?? ''
  this.routes = endpoints
}

register(app, options = {}) {
  const { redisClient, connection } = options

  // Attach both schemas to req as first middleware in chain:
  chain.push((req, _res, next) => {
    req.requestSchema  = request  ?? null
    req.responseSchema = response ?? null
    next()
  })

  // ... (rate limit, auth, permission middleware) ...

  // Request validation — reads req.requestSchema, skips when null (symmetric with respondJson):
  chain.push(validate())

  // Controller — respondJson reads req.responseSchema, skips when null:
  await controller[handler](context)
}
```

### L5 — Update each service's `api.js`

Each `api.js` must create a connection singleton at module load time and pass it to every `ApiSchema.register()` call.

**All 4 services** — use `createConnection` with `DATABASE_URL` from env. Pass `schema` for family and programme:
```js
import { createConnection } from '../../base/db/createConnection.js'

// family-service api.js:
const connection = createConnection({ connectionString: process.env.DATABASE_URL, schema: 'family' })

// programme-service api.js:
const connection = createConnection({ connectionString: process.env.DATABASE_URL, schema: 'programme' })

// iam-service api.js:
const connection = createConnection({ connectionString: process.env.DATABASE_URL })

// email-service api.js:
const connection = createConnection({ connectionString: process.env.DATABASE_URL })

// All ApiSchema.register() calls now include connection:
FamilyApi.register(app, { redisClient, connection })
```

**Delete the old per-service pool files once all services are verified**:
- Delete `iam-service/src/db/pool.ts` — remove Supabase RPC wrapper, use `createConnection` instead
- Delete `email-service/src/db/pool.ts` — same
- `family-service/src/lib/supabase.ts` — keep only for `testConnection()` (used in healthcheck); repos must stop importing it
- `programme-service/src/lib/supabase.ts` — same as family

> ⚠️ **`iam-service/src/db/repository.ts`** is a 700-line monolith with every DB function called directly via `pool.query()` with raw SQL and `RETURNING *`. It must be fully rewritten: split into feature repositories (`loginRepository.js`, `mfaRepository.js`, etc.) each extending `BaseRepository`, using `QueryHelper`, with no RETURNING. Do this as part of L6 for IAM.

### L6 — Migrate all repositories to extend `BaseRepository`

> **Table naming — use bare table names, no schema prefix**:
> The exec_* RPC functions in each DB are configured with `SET search_path` (see L1 pre-flight), so bare table names automatically resolve to the right schema. Never write `family.family` or `programme.programme_master` as a table name in QueryHelper calls.
>
> | Service | Schema resolved | Example `this.qh().table(...)` calls |
> |---|---|---|
> | family-service | `family` | `'family'`, `'family_member'`, `'address'`, `'documents'`, `'account_details'`, `'house_services'`, `'family_history'`, `'family_event_outbox'`, `'biometric_metadata'`, `'identity_match'` |
> | programme-service | `programme` | `'programme_master'`, `'programme_citizens'`, `'programme_config'`, `'programme_history'`, `'programme_rules'`, `'conditionality_compliance'`, `'programme_manager_link'` |
> | iam-service | `public` | `'users'`, `'audit_logs'`, `'roles'`, `'permissions'`, `'user_roles'`, `'role_permissions'` |
> | email-service | `public` | `'email_requests'`, `'email_providers'`, `'template_versions'`, `'rate_limits'` |

**`BaseRepository` must provide these execution helpers** (implement them in `base/baseRepository.js`):

```js
export class BaseRepository {
  constructor(context) {
    this.context    = context
    this.connection = context.connection
    this.logger     = createLogger(this.constructor.name)
    this._breaker   = createCircuitBreaker(async (fn) => fn(), { name: this.constructor.name })
  }

  // Factory: create a QueryHelper for the given table
  qh(table) { return new QueryHelper(table) }

  // SELECT — return all matching rows
  async findAll(qh) {
    const { text, values } = qh.build().toParam()
    return this._breaker.fire(() => this.connection.query(text, values)).then(r => r.rows)
  }

  // SELECT — return first row or null
  async findOne(qh) {
    const rows = await this.findAll(qh)
    return rows[0] ?? null
  }

  // SELECT count(*) — return integer
  async count(qh) {
    const rows = await this.findAll(qh)
    return parseInt(rows[0]?.Count ?? rows[0]?.count ?? '0', 10)
  }

  // INSERT / UPDATE / DELETE — returns rowCount, never returns row data
  async run(qh) {
    if (this._breaker.opened) throw ApplicationError.serviceUnavailable('Database temporarily unreachable')
    const { text, values } = qh.build().toParam()
    return this._breaker.fire(() => this.connection.query(text, values)).then(r => r.rowCount)
  }

  // Paginated SELECT — returns { rows, total, page, pageSize }
  async paginate(dataQh, countQh, { page = 1, pageSize = 20 } = {}) {
    const [rows, total] = await Promise.all([this.findAll(dataQh), this.count(countQh)])
    return { rows, total, page, pageSize }
  }

  // Transaction helper — circuit breaker wraps the whole transaction
  async transaction(callback) {
    return this._breaker.fire(async () => {
      await this.connection.query('BEGIN')
      try {
        const result = await callback()
        await this.connection.query('COMMIT')
        return result
      } catch (err) {
        await this.connection.query('ROLLBACK')
        throw err
      }
    })
  }
}
```

**QueryHelper squel usage patterns** (use these in all repository methods):

```js
// SELECT all rows
const qh = this.qh('family').select().field('*').where('status = ?', 'active')
const families = await this.findAll(qh)

// SELECT single row by ID
const qh = this.qh('family').select().field('*').where('family_id = ?', id)
const family = await this.findOne(qh)

// SELECT with sorting and pagination (pass both data query and count query)
const dataQh  = this.qh('family').select().field('*')
  .where('status = ?', 'active').order('created_at', false)   // false = DESC
  .limit(pageSize).offset((page - 1) * pageSize)
const countQh = this.qh('family').count().where('status = ?', 'active')
const result  = await this.paginate(dataQh, countQh, { page, pageSize })

// INSERT (no data returned — no RETURNING)
// If you need the generated ID, generate it BEFORE insert (use crypto.randomUUID())
const familyId = crypto.randomUUID()
const qh = this.qh('family').insert({ family_id: familyId, name: data.name, status: 'active' })
await this.run(qh)
// Then SELECT to get the full record if needed:
const inserted = await this.findOne(this.qh('family').select().field('*').where('family_id = ?', familyId))

// UPDATE (no data returned)
const qh = this.qh('family').update().set('status', 'archived').where('family_id = ?', id)
await this.run(qh)

// DELETE (only on junction/log tables)
const qh = this.qh('role_permissions').delete().where('role_id = ?', roleId)
await this.run(qh)

// Complex WHERE using QueryHelper.expr()
const expr = QueryHelper.expr().and('status = ?', 'active').and('region = ?', region)
const qh   = this.qh('family').select().field('*').where(expr)
```

> ⚠️ **Service layer: no-RETURNING create pattern** — When creating a record that another record depends on (e.g. create address → use its ID to create family), generate the IDs in the service **before** the insert using `crypto.randomUUID()`, pass them into the insert payload, and use the pre-generated IDs downstream. Never rely on a DB-generated ID returned by INSERT.

**All repository files across all 4 services must:**
1. Extend `BaseRepository` (from `base/baseRepository.js`)
2. Accept only `context` in their constructor: `constructor(context) { super(context) }`
3. Use `this.findAll()`, `this.findOne()`, `this.count()`, `this.run()`, `this.paginate()` for all DB calls via `this.qh(table)`
4. **Delete** any direct import of `supabase`, `pool`, or any db client
5. **Never use RETURNING** — if data is needed after a write, issue a separate SELECT
6. Convert Supabase JS client calls:
   - `supabase.from('t').select('*').eq('id', id)` → `this.findOne(this.qh('t').select().field('*').where('id = ?', id))`
   - `supabase.from('t').insert(data)` → `this.run(this.qh('t').insert(data))`
   - `supabase.from('t').update(data).eq('id', id)` → `this.run(this.qh('t').update().set(...).where('id = ?', id))`
   - `supabase.from('t').delete().eq('id', id)` → `this.run(this.qh('t').delete().where('id = ?', id))`

> ⚠️ **`family-service` specific — current `FamilyRepository` takes NO constructor args.** It must be updated to `constructor(context) { super(context) }`. All other family repos (MemberRepository, AddressRepository, etc.) are the same.

> ⚠️ **`family-service` specific — `FamilyService` is a plain class (no extends).** It must extend `BaseService`: `class FamilyService extends BaseService { constructor(ctx, familyRepository) { super(ctx); this.familyRepository = familyRepository } }`. The same applies to all other family/programme services — name the property after the feature (e.g. `this.memberRepository`, `this.addressRepository`).

> ⚠️ **`iam-service` specific — `LoginRepository` and others call functions from `db/repository.ts` which uses `pool` directly.** When you rewrite those repositories, you are also rewriting the underlying `db/repository.ts` functions. Do NOT keep calling `db/repository.ts` functions from the new repositories — replace them inline with `QueryHelper` calls.

**Controller wiring** — controllers must pass context to the repository:
```js
// BEFORE (family-service FamilyController):
const repo = new FamilyRepository()            // no context, no connection
this.service = new FamilyService(repo)

// AFTER:
const repo = new FamilyRepository(ctx)         // context carries connection
this.service = new FamilyService(ctx, repo)    // service also gets context for its logger
```

### L7 — Verify

After completing L1–L6:
- All 4 services start cleanly
- At least 3 read endpoints return correct data (connection flows correctly)
- At least 1 write endpoint inserts/updates correctly
- `context.connection` is never `undefined` when a repository method runs
- No repository file contains `import { supabase }` or `import { pool }` or any direct db import

---

## Part M — Centralize JWT signing + permissions embedded in token

### Current state (already working — do not break)

The IAM service already embeds `permissions` in the JWT payload at login time:
```js
// iam-service/src/features/login/loginService.js — already does this:
const accessToken = await new SignJWT({
  sub:         user.user_id,
  email:       user.email,
  // national_id omitted — ⚠️ PII, never in JWT payload (see N7)
  roles,
  permissions,   // ← full permission array already in token
  registry_id: user.registry_id || undefined,
}).setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
  .setExpirationTime(now + config.jwt.expiresInSeconds)
  .sign(secret)
```

`requireAuth.js` already reads `payload.permissions` and sets `req.user.permissions = payload.permissions || []`. This is the correct approach — permissions are validated once at the token verification step, zero DB queries per request.

### What is missing: a shared `signToken` utility

The problem is that token signing logic is **duplicated** across:
- `iam-service/src/features/login/loginService.js`
- `iam-service/src/features/otpLogin/otpLoginService.js`
- `iam-service/src/services/keycloakLogin.ts`
- `iam-service/src/services/login.ts` (legacy)
- `iam-service/src/services/otpLogin.ts` (legacy)

Create **`base/auth/signToken.js`** — a single shared token factory used by all IAM login flows:

```js
// base/auth/signToken.js
import { SignJWT } from 'jose'

/**
 * Sign a SPIS access token with permissions embedded in the payload.
 *
 * @param {{ userId, email, roles, permissions, registryId? }} claims — do NOT include nationalId; it is PII and must never be in a JWT payload (see N7)
 * @param {{ secret: string, expiresInSeconds: number, issuer: string, audience: string }} config
 * @returns {Promise<string>} signed JWT
 */
export async function signToken(claims, config) {
  const secret = new TextEncoder().encode(config.secret)
  const now    = Math.floor(Date.now() / 1000)

  // ⚠️ national_id is NOT included in the JWT payload. JWTs are only signed, not encrypted —
  // the payload is base64url-encoded and readable by anyone who holds the token.
  // national_id is the most sensitive PII in the system and must never travel in a JWT.
  // Use user_id (sub) + registry_id for all identity lookups; fetch national_id from the DB
  // only when explicitly required by a permissioned endpoint.
  return new SignJWT({
    sub:         claims.userId,
    email:       claims.email,
    // national_id intentionally omitted — PII, never put in JWT payload
    roles:       claims.roles        || [],
    permissions: claims.permissions  || [],   // ← embedded — zero DB queries per request
    registry_id: claims.registryId   || undefined,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(now)
    .setExpirationTime(now + config.expiresInSeconds)
    .setIssuer(config.issuer)
    .setAudience(config.audience)
    .sign(secret)
}
```

Update all IAM login services to import and call `signToken()` instead of duplicating the `new SignJWT(...)` block. No behaviour changes — same payload, same algorithm, same claims.

### Token permission staleness

Embedding permissions in the token means a user's permissions changes (role reassignment, permission revocation) do NOT take effect until the current token expires.

Acceptable trade-off for this project (current token TTL is short — verify and enforce ≤ 15 minutes via `config.jwt.expiresInSeconds`). If a permission must be revoked immediately, the admin can invalidate the user's token by changing their record in a Redis blocklist:

```js
// In requireAuth.js — add after JWT verification:
const isRevoked = await redisClient.get(`token:revoked:${payload.sub}`)
if (isRevoked) return res.status(401).json({ success: false, error: { code: 'TOKEN_REVOKED', message: 'Token has been revoked' } })
```

Add `revokeToken(userId)` to the IAM admin service (sets `token:revoked:<userId>` in Redis with TTL matching max token lifetime). This gives immediate revocation when needed without querying permissions per-request.

### Also fix: SuperAdmin bypass in `requirePermissions`

`base/middleware/requireAuth.js` has a `requirePermissions` helper that still has:
```js
if (userRoles.includes('SuperAdmin')) return next()
```
This violates non-negotiable rule 1 (permission-based only, no role checks). Remove this bypass. SuperAdmin access is handled by assigning all permissions to that role at the DB level — the token will already carry those permissions.

---

## Part N — Security hardening gaps

The following security items are not covered by Parts A–M and must be addressed:

### N1 — Never log sensitive fields

Add a `redactLog` utility in `base/logger.js` or as a logger option that strips sensitive fields before any log statement:
```js
// Fields that must NEVER appear in logs:
const REDACTED_FIELDS = ['password', 'national_id', 'token', 'access_token', 'authorization',
  'otp', 'pin', 'secret', 'credit_card', 'cvv', 'ssn']
```
Apply globally via a `pino` `redact` option (if using pino) or a wrapper in `createLogger`. No feature file should ever call `this.logger.info({ password })` etc.

### N2 — CORS locked down

All service `api.js` files use `cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000' })`. Verify:
- `CORS_ORIGIN` is set in production env — never falls back to `*`
- `credentials: true` is set (required for Cookie/Bearer flow)
- Preflight `OPTIONS` is handled (Express `cors()` does this automatically — confirm)

### N3 — Helmet — install and wire in all api.js files

`helmet` is **not currently installed in any service**. Install it now — it sets 12 security response headers in one call. This matters even behind Nginx, because internal calls between services, health checkers, and direct local dev hits all bypass Nginx and would otherwise be unprotected.

```bash
# Run inside each service directory:
npm install helmet
```

Also add `helmet` to `base/package.json` dependencies.

Wire as the **very first** middleware in each service's `api.js`, before everything else including `requestId`:

```js
import helmet from 'helmet'

// api.js — first middleware registered:
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:    ["'none'"],   // API-only: block all embedded content
      frameAncestors:["'none'"],   // X-Frame-Options: DENY equivalent
    },
  },
  hsts: {
    maxAge:            31536000,   // 1 year
    includeSubDomains: true,
    preload:           true,
  },
  referrerPolicy:           { policy: 'no-referrer' },
  crossOriginEmbedderPolicy: false,  // not needed for API-only services
}))
```

After wiring, confirm these headers appear on every API response:
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-Permitted-Cross-Domain-Policies: none`
- `Referrer-Policy: no-referrer`

### N4 — Input length limits

Zod validation in endpoint configs must include `.max()` on all string fields to prevent oversized payloads reaching the service layer. Review all endpoint schemas — any `z.string()` without `.max()` is a gap.

**Special case — password fields and bcrypt truncation**: bcrypt silently truncates input at **72 bytes**. A password of 73+ characters hashes identically to its first 72 characters, creating invisible password collisions (two different passwords that are "equal" under bcrypt). Prevent this by adding `.max(72)` to every `password` / `newPassword` / `confirmPassword` Zod field:
```js
// In every endpoint that accepts a password:
password:    z.string().min(8).max(72),
newPassword: z.string().min(8).max(72),
```
Apply to: `loginApi`, `passwordResetApi`, `workerRegisterApi`, `otpLoginApi`, and any other endpoint that handles a raw password string.

**Body size limit — `express.json` must use `1mb` in every service**: `family-service` currently sets `express.json({ limit: '10mb' })`. A 10 MB JSON payload is a trivial application-level DoS — it consumes server memory before any validation runs. JSON bodies must be limited to `1mb` across all 4 services. File upload payloads go through `multer` (which has its own configurable `fileSize` limit in `base/middleware/upload.js`) and never pass through `express.json`, so reducing the JSON limit does not affect uploads:
```js
// In every service api.js — uniform across all 4:
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))
```

### N5 — Business-logic audit log (service-level, not middleware)

**Architecture:**
Each service owns its own `AuditLogService` class in `common/auditLogService.js`. Controllers and
services invoke it **explicitly** after significant actions — no automatic HTTP-layer sniffing.

**Design rules:**
- `AuditLogService` is instantiated with `this.context` (to access the logger)
- Uses `QueryHelper` exclusively — no raw SQL, no Supabase `.from()`
- ALWAYS fail-silent — audit failures must **never** propagate to the request caller
- UUIDs are UUIDv4, generated by the app, stored as **UPPERCASE** strings
- Each service writes to its **own** database table (not a shared central table)

**Table name convention — `AUDIT_LOG` in every service object in `table.js`:**
| Constant | Value | Note |
|---|---|---|
| `FAMILY.AUDIT_LOG` | `'family.audit_logs'` | Schema-qualified — pool has no schema override |
| `IAM.AUDIT_LOG` | `'audit_logs'` | Public schema — plain name |
| `EMAIL.AUDIT_LOG` | `'audit_logs'` | Public schema — plain name |
| `PROGRAMME.AUDIT_LOG` | `'programme.audit_logs'` | Schema-qualified — pool has no schema override |

Family and programme pools connect to the public schema (no `db.schema` override), so they **must** use schema-qualified table names in SQL. IAM and Email are already in the public schema so plain names work.

**Table schema (identical across all 4 services):**
- `id VARCHAR(36) PK` — UUIDv4 uppercase, app-generated
- `user_id VARCHAR(36)` — UUID of the acting user
- `created_at TIMESTAMPTZ DEFAULT NOW()` — date + time (no separate date column needed)
- `created_by VARCHAR(255)` — username / display name of the actor
- `logs TEXT` — human-readable action description

**`AuditLogService` — single pattern for all 4 services (QueryHelper + pool):**
```js
import { v4 as uuidv4 } from 'uuid'
import { QueryHelper }  from '../../../base/queryHelper.js'
import { FAMILY }       from '../../../base/table.js'   // IAM | EMAIL | PROGRAMME per service
import { pool }         from '../lib/pool.js'           // or '../db/pool.js' for iam/email

export class AuditLogService {
  constructor(context) {
    this.logger = context.logger
  }

  async record({ userId, createdBy, action }) {
    try {
      const uuid = uuidv4().toUpperCase()
      await new QueryHelper(pool)
        .table(FAMILY.AUDIT_LOG)   // schema-qualified for family/programme; plain for iam/email
        .insert({ uuid, user_id: userId, created_by: createdBy, logs: action })
        .executeCount()
    } catch (err) {
      this.logger.error('Audit log write failed', { table: FAMILY.AUDIT_LOG, error: err.message })
      // never rethrow — audit failures are silent to callers
    }
  }
}
```

> **pool.js location per service:**
> - family-service: `src/lib/pool.js` (Supabase RPC wrapper for family Supabase project)
> - programme-service: `src/lib/pool.js` (Supabase RPC wrapper for programme Supabase project)
> - iam-service: `src/db/pool.js` (pre-existing Supabase RPC wrapper)
> - email-service: `src/db/pool.js` (pre-existing Supabase RPC wrapper)

**Usage pattern (in any controller or service method):**
```js
import { AuditLogService } from '../../common/auditLogService.js'  // adjust relative path as needed

// Inside a controller method, after the main action succeeds:
const audit = new AuditLogService(this.context)
await audit.record({
  userId:    this.context.user.sub,
  createdBy: this.context.user.username ?? this.context.user.email,
  action:    `User '${actor}' changed permission for '${role}' from '${old}' to '${next}'`,
})
```

**Action description format** — always written as a human-readable sentence:
> `"User '<username>' <verb> <resource> '<name>' [from '<old>' to '<new>']"`

Examples:
- `"User 'admin@example.com' created family 'Santos Family'"`
- `"User 'admin@example.com' changed permission for role 'case-worker' from 'READ_ONLY' to 'FULL_ACCESS'"`
- `"User 'system' sent password reset email to 'user@example.com'"`

**File locations:**
- `family-service/src/common/auditLogService.js`
- `iam-service/src/common/auditLogService.js`
- `email-service/src/common/auditLogService.js`
- `programme-service/src/common/auditLogService.js`

> ⚠️ **No middleware** — do NOT add `auditMiddleware` to `api.js`. `AuditLogService` is called
> explicitly by feature code only. There is no global HTTP-layer audit capture.

### N6 — Account lockout after repeated failed login attempts

IP-level rate limiting alone does not protect against distributed brute-force (many IPs attacking one account). Implement per-account lockout in the IAM login flow:

> ⚠️ **Dependency injection**: `loginService.js`, `otpLoginService.js`, and `passwordResetService.js` do not currently receive a `redisClient`. Update each service constructor to accept `redisClient` as a second argument alongside `repo`:
> ```js
> // In IAM api.js — when wiring loginController:
> const loginRepo    = new LoginRepository(ctx)
> const loginService = new LoginService(ctx, loginRepo, redisClient)  // ← pass redisClient
> // LoginService constructor:
> constructor(ctx, loginRepository, redisClient) { super(ctx); this.loginRepository = loginRepository; this.redis = redisClient }
> // Then inside the service use this.loginRepository and this.redis
> ```
> Apply the same pattern to `otpLoginService.js` and `passwordResetService.js`.

**Redis-backed failure counter** — no DB migration needed:
```js
// In loginService.js — after a failed password check:
const failKey = `login:fail:${email}`
const fails   = await redisClient.incr(failKey)       // atomic increment
if (fails === 1) await redisClient.expire(failKey, 900) // 15-min rolling window

if (fails >= 5) {
  // Lock the account — set a lock key with 15-min TTL
  await redisClient.setex(`login:locked:${email}`, 900, '1')
  throw ApplicationError.tooManyRequests('Account temporarily locked due to repeated failed login attempts')
}
```

**Check lock before attempting password verification** — at the top of the login service method:
```js
const isLocked = await redisClient.get(`login:locked:${email}`)
if (isLocked) throw ApplicationError.tooManyRequests('Account temporarily locked — try again in 15 minutes')
```

**Reset counter on successful login**:
```js
// After successful login:
await redisClient.del(`login:fail:${email}`)
await redisClient.del(`login:locked:${email}`)
```

**Lockout policy**:
- Threshold: 5 consecutive failures
- Lock duration: 15 minutes (900s TTL)
- Lock resets automatically via TTL — no admin action needed for temporary locks
- Counter resets on success — only consecutive failures matter
- Apply the same pattern to OTP login and password reset (they are also brute-force targets)

**Redis degradation**: if Redis is down, skip the lockout check (fail-open) and log a warning. Never let a Redis outage block all logins.

### N7 — Remove `national_id` from JWT payload — it is PII in a base64-readable token

JWTs are **signed but not encrypted**. The payload is base64url-encoded — anyone who holds the token (browser devtools, proxy logs, leaked client storage) can decode the national ID without the signing secret.

The current `loginService.js` embeds `national_id: nationalId` in the JWT. **Remove it.**

```js
// WRONG — national_id in JWT payload is readable by anyone:
new SignJWT({ sub: user.user_id, email: user.email, national_id: nationalId, ... })

// CORRECT — national_id is never in the JWT:
new SignJWT({ sub: user.user_id, email: user.email, registry_id: user.registry_id, ... })
// national_id is only fetched from the DB by permissioned endpoints that explicitly need it
```

**Action required**:
- Remove `national_id` from `signToken()` in `base/auth/signToken.js`
- Remove `national_id` from all existing direct `new SignJWT(...)` calls in IAM login flows
- Remove `national_id` from `req.user` in `requireAuth.js` — if any endpoint reads `req.user.national_id`, it must instead fetch it from the DB with a permissioned repo call
- Run `grep -r 'national_id' base/auth/ iam-service/src/features/` to confirm no JWT builder includes it

### N8 — Hardcoded `WORKER_REGISTRATION_KEY` + SuperAdmin self-registration

Two critical issues exist in `iam-service/src/features/workerRegister/workerRegisterService.js`:

**Issue 1 — Secret key hardcoded in source code:**
```js
// CURRENT (BAD) — anyone with repo access can self-register:
const WORKER_REGISTRATION_KEY = "j'F-7cU&uRM&_0dJ`x0..."  // hardcoded!
```
Move to an environment variable:
```js
// CORRECT:
const WORKER_REGISTRATION_KEY = process.env.WORKER_REGISTRATION_SECRET
if (!WORKER_REGISTRATION_KEY) throw new Error('WORKER_REGISTRATION_SECRET env var not set')
```
Add `WORKER_REGISTRATION_SECRET` to `iam-service/.env.example` as a required variable. Add it to the Phase 0.25 startup validation list.

**Issue 2 — `SuperAdmin` is a self-registrable role:**
```js
// CURRENT (BAD) — anyone with the key can make themselves SuperAdmin:
const VALID_ROLES = ['Admin', 'CaseWorker', 'SuperAdmin', 'ProgrammeManager']
```
SuperAdmin must never be self-registrable. Remove it:
```js
// CORRECT:
const VALID_ROLES = ['Admin', 'CaseWorker', 'ProgrammeManager']
// SuperAdmin accounts are created only via the create_superadmin.sql script by the DBA.
```
SuperAdmin creation is already handled by `create_superadmin.sql` — no code path should allow self-service SuperAdmin registration.

### N9 — Timing attack on login user lookup (national ID enumeration)

In `loginService.js`, when the user is not found the code throws immediately without running bcrypt:
```js
// CURRENT (BAD) — response comes back in ~1ms when user not found, ~100ms when found:
const user = await this.loginRepository.findByNationalIdHash(nationalIdHash)
if (!user) throw ApplicationError.unauthorized('Invalid credentials')  // ← returns instantly
// ... bcrypt.compare runs only when user exists (~100ms)
```
An attacker measuring response time can determine which national IDs are registered — even without a valid password.

Fix: always run a dummy bcrypt comparison when the user is not found, so response time is constant regardless of whether the account exists:
```js
// CORRECT — constant time regardless of user existence:
const DUMMY_HASH = '$2b$12$invalidhashthatisjustpaddingXXXXXXXXXXXXXXXXXXXXXXXXXX'
const user = await this.loginRepository.findByNationalIdHash(nationalIdHash)
if (!user) {
  await bcrypt.compare(password, DUMMY_HASH)  // ← always ~100ms, prevents timing enumeration
  throw ApplicationError.unauthorized('Invalid credentials')
}
```
Apply the same pattern in `otpLoginService.js` and `passwordResetService.js` wherever a user lookup gates further processing.

### N10 — National ID in Morgan logs via URL path parameter

The endpoint `GET /api/v1/registration/check-national-id/:nationalId` puts the national ID directly in the URL path. `morgan('combined')` logs every request URL verbatim — the national ID appears in stdout and any log aggregator.

**Fix — replace morgan with structured pino-http logging** (pino is already used for app logs):
```js
// INSTEAD of morgan in api.js:
import pinoHttp from 'pino-http'
import { createLogger } from '../../base/logger.js'

const log = createLogger('iam-service')  // or family-service etc.
app.use(pinoHttp({
  logger: log,
  // Redact sensitive path segments and headers from logs:
  serializers: {
    req(req) {
      return {
        method:    req.method,
        // Replace national ID segments with a placeholder to avoid logging PII:
        url:       req.url.replace(/\/check-national-id\/[^/]+/, '/check-national-id/[REDACTED]'),
        requestId: req.id,
      }
    },
    res(res) { return { statusCode: res.statusCode } },
  },
  // Never log health checks — high volume, no value:
  autoLogging: { ignore: (req) => req.url?.includes('/health') },
}))
```

Install `pino-http`:
```bash
npm install pino-http
```
Add to `base/package.json`. Remove `morgan` from all 4 service `package.json` files. Apply the same pino-http config (with its own service-specific URL redaction patterns) in all 4 services.

### N11 — Encrypt TOTP secret at rest (AES-256-GCM)

The `otp_secret` column in the `users` table and the `secret` column in `mfa_factors` currently store the TOTP hex secret as **plaintext**. Anyone with DB read access (SQL injection, leaked backup, compromised Supabase dashboard) can extract every user's TOTP secret, generate valid 6-digit codes, and bypass MFA entirely.

**What changes**: an encrypt/decrypt layer is added around storage and retrieval of the TOTP secret. The TOTP code generation and verification logic is **completely unchanged** — the same 6-digit codes, same `OTPAuth.TOTP.validate()`, same window. We simply encrypt before writing to DB and decrypt after reading from DB.

**What does NOT change**:
- The OTP matching/verification logic (unchanged — `OTPAuth.Secret.fromHex(rawSecret)` still receives the original hex secret)
- The QR code provisioning URI (uses the original hex secret before encryption)
- Email OTP (already uses SHA-256 one-way hashing — no change needed)
- The database columns (still `TEXT` — just hold encrypted text instead of plaintext)
- User-facing behavior (authenticator apps keep working, existing enrolled TOTP keeps working)

Create `base/auth/mfaCipher.js`:

```js
// base/auth/mfaCipher.js
import crypto from 'crypto'

const ALGORITHM  = 'aes-256-gcm'
const IV_LENGTH  = 16    // 128-bit IV
const TAG_LENGTH = 16    // 128-bit auth tag

/**
 * Get the 32-byte AES key from env.
 * MFA_ENCRYPTION_KEY must be a 64-character hex string.
 * Generate once with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
function getKey() {
  const hex = process.env.MFA_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error('MFA_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)')
  }
  return Buffer.from(hex, 'hex')
}

/**
 * Encrypt a TOTP hex secret for storage.
 * Output format: "iv:ciphertext:authTag" (all base64url-encoded)
 */
export function encryptSecret(plaintext) {
  const key    = getKey()
  const iv     = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(plaintext, 'utf8', 'base64url')
  encrypted += cipher.final('base64url')
  const tag = cipher.getAuthTag().toString('base64url')
  return `${iv.toString('base64url')}:${encrypted}:${tag}`
}

/**
 * Decrypt a TOTP secret from storage.
 * Input format: "iv:ciphertext:authTag" (all base64url-encoded)
 */
export function decryptSecret(stored) {
  const key = getKey()
  const [ivB64, ciphertextB64, tagB64] = stored.split(':')
  const iv  = Buffer.from(ivB64, 'base64url')
  const tag = Buffer.from(tagB64, 'base64url')
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  let decrypted = decipher.update(ciphertextB64, 'base64url', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

/**
 * Detect whether a stored value is already encrypted.
 * Plaintext TOTP secrets are hex strings ([0-9a-f]+) — they NEVER contain ':'.
 * Encrypted values are always in "iv:ciphertext:tag" format with exactly 2 ':' separators.
 */
export function isEncrypted(value) {
  if (!value || typeof value !== 'string') return false
  return value.includes(':') && value.split(':').length === 3
}
```

**Update MFA service — encrypt before storing:**

```js
import { encryptSecret, decryptSecret, isEncrypted } from '../../../../base/auth/mfaCipher.js'

// In enrollTotp() — encrypt the hex secret before storing:
const hexSecret = generateTotpSecret()                       // original plaintext hex
const encryptedSecret = encryptSecret(hexSecret)              // encrypted for DB storage
await this.mfaRepository.createFactor({ userId, factorType: 'totp', secret: encryptedSecret, status: 'pending' })
// QR code still uses the original hexSecret — it is what the authenticator app scans:
const totp = new OTPAuth.TOTP({ ...config, secret: OTPAuth.Secret.fromHex(hexSecret) })

// In verifyTotpEnrollment() — decrypt before verifying:
let rawSecret = pendingTotp.secret
if (isEncrypted(rawSecret)) {
  rawSecret = decryptSecret(rawSecret)            // decrypt to original hex
} else {
  // Transparent upgrade: existing plaintext secret → encrypt and update in-place
  const encrypted = encryptSecret(rawSecret)
  await this.mfaRepository.updateFactorSecret(pendingTotp.id, encrypted)
  // rawSecret stays as the original plaintext hex for this verification
}
const totp = new OTPAuth.TOTP({ ...totpConfig, secret: OTPAuth.Secret.fromHex(rawSecret) })
const delta = totp.validate({ token: code, window: 1 })       // ← UNCHANGED verification logic

// In updateUserMfa() — encrypt the secret:
await this.mfaRepository.updateUserMfa(userId, true, encryptSecret(secret))
```

**Update login TOTP verification** — wherever `user.otp_secret` is read for TOTP verification during login:

```js
// In loginService.js / otpLoginService.js — when verifying TOTP during MFA step:
import { encryptSecret, decryptSecret, isEncrypted } from '../../../../base/auth/mfaCipher.js'

let rawSecret = user.otp_secret
if (rawSecret && isEncrypted(rawSecret)) {
  rawSecret = decryptSecret(rawSecret)
} else if (rawSecret) {
  // Transparent upgrade: encrypt plaintext secret on first login after deployment
  const encrypted = encryptSecret(rawSecret)
  await this.mfaRepository.updateOtpSecret(userId, encrypted)
  // rawSecret stays as original plaintext for this verification
}
// Use rawSecret for TOTP validation — EXACTLY the same as before:
const totp = new OTPAuth.TOTP({ ...config, secret: OTPAuth.Secret.fromHex(rawSecret) })
const delta = totp.validate({ token: code, window: 1 })
```

**Transparent migration strategy** — no bulk data migration needed:
- On every TOTP read (login or enrollment verification), check `isEncrypted(stored_value)`
- If plaintext (no `:` characters — hex strings never have `:`), encrypt it and update the DB row in-place
- All new writes are encrypted from the start
- After one login cycle per MFA user, all secrets will be encrypted
- The `isEncrypted()` check can be removed in a future release once all users have logged in at least once

**New env var** — add to IAM service `.env` and `.env.example`:
```
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
MFA_ENCRYPTION_KEY=<64-character-hex-string>
```
Add `MFA_ENCRYPTION_KEY` to the IAM service's `validateEnv()` list (Rule 21).

**Verification:**
- Enroll TOTP → check DB: `mfa_factors.secret` contains `iv:ciphertext:tag` format (not raw hex)
- Verify TOTP with authenticator app code → succeeds (decrypt works, OTP validation unchanged)
- Existing user with plaintext secret logs in → secret auto-encrypted in DB on read, login succeeds
- Without `MFA_ENCRYPTION_KEY` env var → service crashes at startup (validateEnv)

### N12 — Cryptographically random invite tokens (replace predictable user_id)

The invite link currently uses the `user_id` UUID directly:
```js
// CURRENT (BAD) — user_id is predictable and enumerable:
const inviteLink = `${config.corsOrigin}/auth/setup?token=${user.user_id}`
```
Anyone who knows or guesses a `user_id` can craft the invite link and access the account setup page. UUIDs are not secret — they appear in logs, URLs, API responses.

**Fix — use a cryptographically random opaque token:**

```js
import crypto from 'crypto'

// In inviteService.createInvitedAccount():

// 1. Generate a random invite token (48 bytes = 384 bits of entropy)
const rawInviteToken = crypto.randomBytes(48).toString('base64url')

// 2. Hash it for storage (same pattern as OTP — never store raw tokens in DB)
const inviteTokenHash = crypto.createHash('sha256').update(rawInviteToken).digest('hex')

// 3. Calculate expiry (invite links expire in 7 days)
const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

// 4. Store the HASH in otp_tokens
await this.inviteRepository.createOtpToken({
  userId:      user.user_id,
  otpHash:     inviteTokenHash,      // store the hash, not the raw token
  purpose:     'invite',
  expiresAt,
  maxAttempts: 1,                    // invite link is single-use
})

// 4. Send the RAW token in the invite link (only the recipient has it)
const inviteLink = `${config.corsOrigin}/auth/setup?token=${rawInviteToken}`
```

**On the account setup page** — when the user clicks the link:
```js
// In the endpoint that handles /auth/setup?token=xxx:
const rawToken = ctx.request.query.token
if (!rawToken) throw ApplicationError.badRequest('Missing token')
const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
const record = await this.inviteRepository.getOtpTokenByHash(tokenHash, 'invite')
if (!record) throw ApplicationError.unauthorized('Invalid or expired invite link')
if (new Date(record.expires_at) < new Date()) {
  throw ApplicationError.unauthorized('Invite link has expired')
}
if (record.used_at) {
  throw ApplicationError.unauthorized('Invite link has already been used')
}
// Valid — proceed with account setup, then mark token as used:
await this.inviteRepository.markOtpUsed(record.id)  // sets used_at = NOW() on the otp_tokens row
```

**Repository change** — add these two methods to `InviteRepository` (and `OtpRepository` if they share it):
- `getOtpTokenByHash(hash, purpose)` — SELECT by `otp_hash = $1 AND purpose = $2`
- `markOtpUsed(id)` — UPDATE `otp_tokens` SET `used_at = NOW()` WHERE `id = $1`

> ⚠️ **`otp_tokens` schema assumption**: This fix assumes the table has at minimum: `id`, `user_id`, `otp_hash`, `purpose`, `expires_at`, `used_at`, `max_attempts` columns. If `used_at` does not exist, add it: `ALTER TABLE otp_tokens ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ;` — run this in the IAM Supabase project SQL editor before implementing N12.

**No other DB migration needed** — the `otp_tokens` table already has an `otp_hash` column. We store the invite token hash there instead of the old email OTP hash. The `purpose = 'invite'` distinguishes it.

### N13 — Inter-service authentication for email-service

The email-service endpoints (`POST /email/otp`, `POST /email/invite`, `POST /email/notify`) have **zero authentication**. Any network caller — including external attackers if the port is exposed — can trigger email sends. This is intended for inter-service calls but has no guard.

**Fix — shared service API key:**

Create `base/middleware/serviceAuth.js`:

```js
// base/middleware/serviceAuth.js
import crypto from 'crypto'
import { ApplicationError } from '../applicationError.js'

/**
 * Middleware that validates a shared API key in the X-Service-Key header.
 * Used for inter-service endpoints (email, webhooks) that don't use user JWTs.
 *
 * Uses crypto.timingSafeEqual() to prevent timing attacks that could reveal
 * the key length or value through response-time measurement.
 */
export function requireServiceAuth() {
  const key = process.env.SERVICE_AUTH_KEY
  if (!key) throw new Error('SERVICE_AUTH_KEY env var not set')
  const keyBuf = Buffer.from(key)   // pre-compute once at startup

  return (req, res, next) => {
    const provided = req.headers['x-service-key']
    // timingSafeEqual requires same-length buffers — length mismatch is rejected first.
    // Both checks together prevent timing attacks: unequal lengths fail without comparison,
    // equal-length comparisons always take the same time regardless of content.
    const providedBuf = provided ? Buffer.from(provided) : null
    const valid = providedBuf &&
      providedBuf.length === keyBuf.length &&
      crypto.timingSafeEqual(providedBuf, keyBuf)
    if (!valid) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid or missing service key' },
      })
    }
    next()
  }
}
```

**Wire in email-service `api.js`:**
```js
import { requireServiceAuth } from '../../base/middleware/serviceAuth.js'

// Apply to all email endpoints (except /health):
app.use('/api/v1/email', requireServiceAuth())
```

**Update all callers** — IAM, family, and programme services must send the key when calling email-service:
```js
// In iam-service/src/lib/emailClient.ts and any other service that calls email-service:
const response = await axios.post(`${EMAIL_SERVICE_URL}/api/v1/email/otp`, payload, {
  headers: { 'X-Service-Key': process.env.SERVICE_AUTH_KEY },
})
```

**New env var** — add to ALL 4 services' `.env` and `.env.example`:
```
SERVICE_AUTH_KEY=<generate-a-random-64-char-hex-string>
```
The same key is shared across all services. Add to `validateEnv()` for email-service (required) and other services that call email endpoints.

### N14 — Rule engine batch evaluation optimization (fix N+1 query)

The `evaluateAllSubjects()` function in `ruleEngine.ts` has a catastrophic N+1 query problem: it loops through up to 1000 families sequentially, each calling `evaluateSubject()` which calls `fetchSubjectData()` (3–5 DB queries) and `evaluateGroupRule()` (2 DB queries per group rule). Total: **5000+ sequential HTTP round-trips to Supabase REST API.**

**Fix — pre-fetch all data in batch, evaluate in memory:**

Rewrite `evaluateAllSubjects()` (keep `evaluateSubject()` unchanged for single-subject evaluation):

> ⚠️ **After Phase 0.5 (L6 migration), `ruleEngine.ts` must NOT import or use Supabase clients.** Update `evaluateAllSubjects()` to accept a second `connections: { programme: Connection, family: Connection }` parameter (the `Connection` type from `base/db/createConnection.js`). The `engineService.js` passes these from its context. In programme-service `api.js`, create `const familyConnection = createConnection({ connectionString: process.env.FAMILY_DATABASE_URL, schema: 'family' })` alongside the programme connection, and add `FAMILY_DATABASE_URL` to programme-service `.env` and `validateEnv()`. Inside `evaluateAllSubjects()`, replace every `supabase.from('t').select('*').eq('k', v)` call with `await connections.programme.query('SELECT * FROM t WHERE k = $1', [v]).then(r => r.rows)` (use `connections.family.query(...)` for the family DB tables). The Supabase-style calls in the code sample below illustrate the data shape only — convert them all to pg queries during Phase 3.

```ts
/**
 * Batch evaluate all eligible families for a programme.
 * Pre-fetches ALL data in 5 queries (not 5000), then evaluates in memory.
 * @param connections - After L6: { programme: Connection, family: Connection } passed from engineService
 */
export async function evaluateAllSubjects(programmeId: string): Promise<EvaluationResult[]> {
  if (!familySupabase) throw new Error('Family database not configured')

  // 1. Pre-fetch programme rules ONCE (not per family)
  const { data: rules } = await supabase
    .from('programme_rules').select('*').eq('programme_id', programmeId)
  if (!rules || rules.length === 0) return []

  // 2. Pre-fetch ALL group definitions and group rules ONCE
  const groupRuleIds = rules.filter(r => r.rule_group_id).map(r => r.rule_group_id)
  let groupsMap: Record<string, any> = {}
  let groupRulesMap: Record<string, any[]> = {}

  if (groupRuleIds.length > 0) {
    const { data: groups } = await supabase
      .from('rule_group').select('*').in('rule_group_id', groupRuleIds)
    groupsMap = Object.fromEntries((groups || []).map(g => [g.rule_group_id, g]))

    const { data: groupRules } = await supabase
      .from('rule_group_rules').select('*').in('rule_group_id', groupRuleIds)
    for (const gr of groupRules || []) {
      if (!groupRulesMap[gr.rule_group_id]) groupRulesMap[gr.rule_group_id] = []
      groupRulesMap[gr.rule_group_id].push(gr)
    }
  }

  // 3. Pre-fetch ALL active families + related data in bulk (4 queries, not 4000)
  const { data: families } = await familySupabase
    .from('family').select('*').eq('status', 'active').limit(1000)
  if (!families || families.length === 0) return []

  const familyUuids = families.map(f => f.uuid)

  const [membersResult, addressResult, houseResult] = await Promise.all([
    familySupabase.from('family_member').select('*')
      .in('family_uuid', familyUuids).eq('relationship_to_head', 'head'),
    familySupabase.from('address').select('*')
      .in('uuid', families.map(f => f.permanent_address_id).filter(Boolean)),
    familySupabase.from('house_services').select('*')
      .in('family_uuid', familyUuids),
  ])

  // 4. Index data by family UUID for O(1) lookup
  const membersByFamily = Object.fromEntries(
    (membersResult.data || []).map(m => [m.family_uuid, m]))
  const addressById = Object.fromEntries(
    (addressResult.data || []).map(a => [a.uuid, a]))
  const houseByFamily = Object.fromEntries(
    (houseResult.data || []).map(h => [h.family_uuid, h]))

  // 5. Evaluate each family IN MEMORY — zero additional DB queries
  const results: EvaluationResult[] = []
  for (const family of families) {
    try {
      const subjectData: Record<string, unknown> = {
        family: family,
        family_member: membersByFamily[family.uuid] || {},
        address: family.permanent_address_id
          ? (addressById[family.permanent_address_id] || {}) : {},
        house_services: houseByFamily[family.uuid] || {},
      }

      // Evaluate rules in memory using pre-fetched group data
      const result = evaluateSubjectInMemory(
        programmeId, family.uuid, 'Family', subjectData, rules, groupsMap, groupRulesMap)
      results.push(result)
    } catch (err) {
      console.error(`Error evaluating family ${family.uuid}:`, err)
    }
  }

  return results
}
```

**Add `evaluateSubjectInMemory()`** — same logic as `evaluateSubject()` but reads group data from the pre-fetched maps instead of querying the DB:

```ts
function evaluateSubjectInMemory(
  programmeId: string, subjectId: string, subjectType: string,
  subjectData: Record<string, unknown>,
  rules: ProgrammeRule[],
  groupsMap: Record<string, RuleGroup>,
  groupRulesMap: Record<string, RuleGroupRule[]>,
): EvaluationResult {
  const ruleResults: EvaluationResult['rule_results'] = []
  const groupScores: Record<string, number> = {}
  let totalScore = 0
  let allMandatoryPassed = true

  for (const rule of rules) {
    if (rule.rule_type === 'group' && rule.rule_group_id) {
      // Use pre-fetched group data — NO DB QUERY
      const group = groupsMap[rule.rule_group_id]
      const subRules = groupRulesMap[rule.rule_group_id] || []
      const groupResult = evaluateGroupRuleInMemory(rule, group, subRules, subjectData)
      // ... same scoring logic as evaluateSubject() ...
    } else if (rule.variable_code) {
      const result = evaluateVariableRule(rule, subjectData)
      // ... same scoring logic as evaluateSubject() ...
    }
  }

  return { subject_id: subjectId, subject_type: subjectType,
    eligible: allMandatoryPassed, calculated_score: totalScore,
    group_scores: groupScores, rule_results: ruleResults }
}
```

**Performance impact**: 5000+ sequential HTTP calls → **8 queries total** (rules + groups + group_rules + families + members + addresses + house_services + one-time setup). This is a **600x reduction** in DB round-trips.

**Keep `evaluateSubject()` unchanged** — it is still used for single-subject evaluation (e.g. when enrolling one citizen) and works fine for that use case.

### N15 — customFieldManager ALTER TABLE safety

The `createCustomField()` function in `customFieldManager.ts` builds an `ALTER TABLE` SQL string by interpolating `target_table` and `fieldName` directly. Even though `fieldName` is derived from the display name via regex, the `target_table` comes from user input and goes straight into SQL.

**Fix — whitelist target tables and validate column types:**

```ts
// Whitelist of tables that can have custom fields added.
// Never allow ALTER TABLE on system tables (users, audit_logs, etc.)
const ALLOWED_TARGET_TABLES = ['family', 'family_member', 'house_services', 'address']

// Existing PG_TYPE_MAP is the ONLY source of valid column types — already correct.
// Validate that the requested type exists in the map.

export async function createCustomField(input, createdBy?) {
  // VALIDATE target_table against whitelist
  if (!ALLOWED_TARGET_TABLES.includes(input.target_table)) {
    throw ApplicationError.badRequest(
      `Invalid target table: ${input.target_table}. Allowed: ${ALLOWED_TARGET_TABLES.join(', ')}`)
  }

  // VALIDATE data_type against the type map
  const pgType = PG_TYPE_MAP[input.data_type]
  if (!pgType) {
    throw ApplicationError.badRequest(
      `Invalid data type: ${input.data_type}. Allowed: ${Object.keys(PG_TYPE_MAP).join(', ')}`)
  }

  // Generate column name — existing regex is good, but add an extra sanitizeIdentifier check
  const fieldName = sanitizeIdentifier(
    `custom_${input.display_name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`
  )
  if (!fieldName) throw ApplicationError.badRequest('Display name produces an invalid column name')

  // ... rest of function unchanged ...
}
```

**Key principle**: the `target_table` is validated against a hardcoded whitelist (not `sanitizeIdentifier` alone — we want to restrict WHICH tables, not just clean the name). The `pgType` comes from our own map (never from user input). The `fieldName` is sanitized. These three checks together make the `ALTER TABLE` safe.

### N16 — Email worker durable retry (replace in-memory setTimeout)

The email worker uses `setTimeout()` to schedule retries:
```js
// CURRENT (BAD) — retry state is in-memory, lost on crash:
setTimeout(() => { publishEmailSend({ ...msg, attempt: attempt + 1 }) }, delayMs)
```
If the worker process crashes or restarts during the delay, pending retries are silently lost and emails are never delivered.

**Fix — DB-backed retry with periodic sweep:**

Instead of `setTimeout`, update the email request row in the database with a `retry_at` timestamp, and add a periodic sweep that re-publishes eligible retries:

```ts
// In handleFailure() — replace setTimeout:
async function handleFailure(msg: EmailSendMessage, error: string): Promise<void> {
  const { request_id, attempt } = msg
  const maxAttempts = config.maxSendAttempts
  const isFinal = attempt >= maxAttempts

  if (isFinal) {
    await updateEmailStatus(request_id, 'failed', { last_error: error })
    publishEmailFailed({ ... })
  } else {
    // Calculate when to retry (exponential backoff)
    const delayMs = config.retryBaseDelayMs * Math.pow(2, attempt - 1)
    const retryAt = new Date(Date.now() + delayMs).toISOString()

    // Store retry intent in DB — durable, survives crashes
    await updateEmailStatus(request_id, 'retry_pending', {
      last_error: error,
      retry_at: retryAt,           // ← new column (see migration below)
      attempt_count: attempt,      // ← new column
    })

    logger.warn('Email send failed, retry scheduled', {
      request_id, attempt, retryAt,
    })
    // NO setTimeout — the sweep loop picks it up
  }
}
```

**Add a sweep loop** that runs every 30 seconds in the worker process:

```ts
// In startWorker() — after consume():
// Create a worker DB connection + repository for the sweep loop.
// worker.ts must import createConnection from base/db/createConnection.js
// worker.ts must import EmailRepository from the email feature repository
import { createConnection } from '../../../../base/db/createConnection.js'
import { EmailRepository }  from '../email/emailRepository.js'   // adjust path to actual repo location

const workerConnection = createConnection({ connectionString: process.env.DATABASE_URL })
const emailRepo = new EmailRepository({ connection: workerConnection, logger })

setInterval(async () => {
  try {
    // Find all emails ready for retry
    const pendingRetries = await emailRepo.getRetryPendingEmails()  // WHERE status='retry_pending' AND retry_at <= NOW()
    for (const row of pendingRetries) {
      await updateEmailStatus(row.request_id, 'queued')   // Mark as re-queued
      publishEmailSend({
        request_id:    row.request_id,
        to_email:      row.to_email,
        template_code: row.template_code,
        variables:     row.variables,
        locale:        row.locale,
        attempt:       (row.attempt_count || 0) + 1,
      })
    }
    if (pendingRetries.length > 0) {
      logger.info('Retry sweep published pending emails', { count: pendingRetries.length })
    }
  } catch (err) {
    logger.error('Retry sweep error', { error: err.message })
  }
}, 30_000)  // every 30 seconds
```

**DB migration** — add two columns to `email_requests` (run in email-service Supabase project):
```sql
-- Run in: https://supabase.com/dashboard/project/qlehzgxxhbbiniouwgta/sql/new
ALTER TABLE email_requests ADD COLUMN IF NOT EXISTS retry_at TIMESTAMPTZ;
ALTER TABLE email_requests ADD COLUMN IF NOT EXISTS attempt_count INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_email_retry ON email_requests(status, retry_at) WHERE status = 'retry_pending';
```

**Repository helper** — add to `EmailRepository` class (extends `BaseRepository`):
```js
// In EmailRepository (extends BaseRepository):
async getRetryPendingEmails() {
  const qh = this.qh('email_requests').select()
    .field('request_id, to_email, template_code, variables, locale, attempt_count')
    .where('status = ?', 'retry_pending')
    .where('retry_at <= ?', new Date().toISOString())
    .limit(50)  // process in batches — avoids overwhelming the queue on restart
  return this.findAll(qh)
}
```

**Why this is better**: the retry state lives in the database. If the worker crashes, the sweep picks up pending retries on restart. No emails are lost.

### N17 — Fix throttle middleware double-decrement

`base/middleware/throttle.js` registers the `cleanup` function on **both** the `finish` and `close` events:
```js
// CURRENT (BUG) — cleanup runs twice per normal request:
res.on('finish', cleanup)
res.on('close', cleanup)
```
The `finish` event fires when the response is fully written. The `close` event fires when the underlying connection is closed — which happens **after** `finish` on every normal request. So the Redis counter is decremented twice per request, eventually going negative.

The `if (val < 0) await redisClient.set(key, 0)` guard catches the negative case but is a band-aid — the counter is still wrong between the two decrements, allowing one extra concurrent request through.

**Fix — use a `once` guard:**

```js
// Replace the cleanup registration with:
let cleaned = false
const cleanup = async () => {
  if (cleaned) return            // ← prevent double-decrement
  cleaned = true
  try {
    const val = await redisClient.decr(key)
    if (val < 0) await redisClient.set(key, 0, 'EX', ttlSec)
  } catch (err) {
    log.error('Throttle cleanup error', { error: err.message, key })
  }
}
res.on('finish', cleanup)
res.on('close', cleanup)    // still need both — close handles aborted requests that never finish
```

We keep both listeners because `close` is the only event that fires for aborted requests (client disconnects before response is sent). The `cleaned` flag ensures the counter is only decremented once regardless.

Also fix the error code to match string convention:
```js
// BEFORE:
error: { code: 429, message: ... }
// AFTER:
error: { code: 'THROTTLE_LIMIT', message: ... }
```

> ⚠️ **`throttle` is NOT a global middleware** — do NOT add it to the definitive api.js wiring order. `throttle` is a concurrency limiter applied **selectively per route path** for expensive, long-running operations (bulk imports, exports, file processing). The load shedder (H6, step 4 in the wiring order) handles the global in-flight cap. `throttle` handles per-resource concurrency for specific expensive routes:
> ```js
> // Apply throttle ONLY to routes that need it — NOT in the global chain:
> import { throttle } from '../../base/middleware/throttle.js'
>
> // In api.js, after the global middleware chain, before ApiSchema.register():
> app.use('/api/v1/engine/evaluate-all', throttle({
>   prefix:         'engine-eval',
>   maxConcurrent:  3,           // max 3 simultaneous batch evaluations
>   keyFn:          (req) => req.user?.sub || req.ip,
>   redisClient,
> }))
> ```
> The `throttle` fix in this section (cleaned guard, error code) is still required — just be clear that it plugs in per-route, not globally.

### N18 — Delete old IAM services/ folder + refactor event handlers

After Phase 3 creates `keycloakLoginService.js` and `keycloakLoginRepository.js` (F2), the old `iam-service/src/services/` folder still contains active code:

| File | Status | Action |
|---|---|---|
| `keycloakLogin.ts` | **Still actively used** by `keycloakLoginController` | Replace with new `keycloakLoginService.js`. Port all Keycloak auth logic. Use `signToken()` from `base/auth/signToken.js` instead of inline `new SignJWT()`. Remove `national_id` from JWT (N7). |
| `invite.ts` | **Still actively imported** by `eventHandlers.ts` | Replace import with new `InviteService` (already exists in features/invite/) |
| `login.ts` | Superseded by `features/login/loginService.js` | Delete |
| `otpLogin.ts` | Superseded by `features/otpLogin/otpLoginService.js` | Delete |
| `passwordReset.ts` | Superseded by `features/passwordReset/passwordResetService.js` | Delete |
| `mfa.ts` | Superseded by `features/mfa/mfaService.js` | Delete |
| `eventHandlers.ts` | **Active worker** — consumes RabbitMQ events | Refactor imports (see below) |

**Refactor `eventHandlers.ts`** — it is a standalone worker process (not an HTTP endpoint), so it cannot use the normal `ApiContext` flow. Create a minimal worker context:

```ts
// At the top of eventHandlers.ts:
import { createConnection } from '../../../base/db/createConnection.js'
import { createLogger }     from '../../../base/logger.js'          // required for createWorkerContext()

// Create a connection for the worker (same as api.js does for the HTTP server)
const workerConnection = createConnection({ connectionString: process.env.DATABASE_URL })

// Create a minimal context for repositories:
function createWorkerContext() {
  return { connection: workerConnection, logger: createLogger('iam-worker') }
}

// In handleCreateAuthAccount:
const ctx = createWorkerContext()
const repo = new InviteRepository(ctx)
const service = new InviteService(ctx, repo)   // ctx first — InviteService extends BaseService(ctx); passing only repo would set ctx = repo and break this.logger
await service.createInvitedAccount({ registryId, email, nationalIdHash })
```

> ⚠️ **`InviteService` constructor signature** — the current `iam-service/src/features/invite/inviteService.js` has `constructor(repo) { super(repo.context) }` (single arg). N18 calls it as `new InviteService(ctx, inviteRepository)` — a two-arg form. **Update the class constructor to `constructor(ctx, inviteRepository) { super(ctx); this.inviteRepository = inviteRepository }` before deleting the old services.** The `super(repo.context)` pattern breaks once repositories no longer expose a `.context` property directly. Also remove the manual `createLogger` import inside `inviteService.js` (line `import { createLogger } from '...'`) — `this.logger` is inherited from `BaseService` once the constructor passes `ctx` correctly.

**Delete these files after migration is verified:**
- `iam-service/src/services/login.ts`
- `iam-service/src/services/otpLogin.ts`
- `iam-service/src/services/passwordReset.ts`
- `iam-service/src/services/mfa.ts`
- `iam-service/src/services/invite.ts`
- `iam-service/src/services/keycloakLogin.ts`

Keep `eventHandlers.ts` but with updated imports.

---

## Part O — Refresh token lifecycle *(deferred — requires DB migration first)*

> ⚠️ **DO NOT IMPLEMENT until the DB migration is applied.** The `refresh_tokens` table does not exist in the IAM database yet. Implementing Part O without running the migration first will cause a table-not-found error on every login. Part O is specified here for planning purposes only — skip it in the ExecuteSet until the DBA confirms the migration is live.
>
> Migration file to create first: `common/iam/db/migrations/015_refresh_tokens.sql` (content specified below).

### Pre-requisite migration (`015_refresh_tokens.sql`)

Before implementing ANY code in Part O, apply this migration to the IAM Supabase project:

```sql
-- 015_refresh_tokens.sql
-- Run in: https://supabase.com/dashboard/project/wrxrstmncezssrscrkxs/sql/new
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip          TEXT,
  user_agent  TEXT
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
```

Once the migration is confirmed live, proceed with the implementation below.

### Token pair strategy

| Token | TTL | Storage | Purpose |
|---|---|---|---|
| Access token (JWT) | ≤15 min | Memory / Authorization header | Auth on every API request |
| Refresh token (opaque random string) | 7 days | httpOnly, Secure, SameSite=Strict cookie | Exchange for new access token |

### IAM service — new endpoints

**POST `/api/v1/auth/refresh`** — exchange a valid refresh token for a new access + refresh token pair:
```js
{
  method: 'POST',
  path:   '/refresh',
  // No requireAuth — refresh token IS the credential
  handler: async (context) => {
    const refreshToken = context.cookies['refresh_token']
    if (!refreshToken) throw ApplicationError.unauthorized('No refresh token')
    const result = await context.service.refresh(refreshToken)
    context.response.cookie('refresh_token', result.refreshToken, {
      httpOnly: true, secure: true, sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    })
    return { accessToken: result.accessToken }
  }
}
```

**POST `/api/v1/auth/logout`** — invalidate the refresh token and revoke the access token:
```js
{
  method: 'POST',
  path:   '/logout',
  handler: async (context) => {
    const refreshToken = context.cookies['refresh_token']
    await context.service.logout(refreshToken, context.user?.sub)
    context.response.clearCookie('refresh_token')
    return { success: true }
  }
}
```

### DB table — `refresh_tokens`

```sql
CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,   -- SHA-256 hash of raw token — never store raw
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip          TEXT,
  user_agent  TEXT
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
```

### `signToken.js` — update to return token pair

```js
// base/auth/signToken.js — extend to also generate refresh token
import crypto from 'crypto'

export async function signTokenPair(claims, config) {
  const accessToken  = await signToken(claims, config)
  const rawRefresh   = crypto.randomBytes(48).toString('base64url')   // 384-bit opaque token
  const tokenHash    = crypto.createHash('sha256').update(rawRefresh).digest('hex')
  const expiresAt    = new Date(Date.now() + config.refreshExpiresInSeconds * 1000)
  return { accessToken, refreshToken: rawRefresh, tokenHash, expiresAt }
}
```

### Refresh flow

1. Client calls `POST /auth/refresh` with the httpOnly cookie
2. IAM hashes the raw token → looks up `refresh_tokens` by `token_hash`
3. If not found / `revoked_at IS NOT NULL` / `expires_at < NOW()` → `401 INVALID_REFRESH_TOKEN`
4. If valid → generate new token pair → insert new refresh row → revoke old row (`revoked_at = NOW()`)
5. Return new access token in body; set new refresh token in httpOnly cookie

### Logout flow

1. Client calls `POST /auth/logout`
2. Set `revoked_at = NOW()` on the refresh token row
3. Set `token:revoked:<userId>` in Redis (immediate access token revocation — see Part M)
4. Clear cookie in response

### Add `cookie-parser` to IAM service

```bash
npm install cookie-parser @types/cookie-parser
```
```js
// iam-service/api.js — add before routes:
import cookieParser from 'cookie-parser'
app.use(cookieParser())
```

---

## ExecuteSet (do not skip any phase)

### ⚠️ Execution discipline — read before starting

**Checkpointing**: After completing EVERY phase, output a status line in this exact format before moving to the next:
```
✅ PHASE <N> COMPLETE — <one-sentence summary of what was done>
```
Do not proceed to the next phase until you have output this line. This makes it trivially clear where execution stopped if the session is interrupted.

**Idempotency — before creating or modifying any file**:
1. Check if the file already exists with `cat <path>` or equivalent read.
2. If it exists and already matches the intended content (e.g. the function/class is already there), skip it and note `SKIP — already done`.
3. If it exists but is stale/wrong, apply only the delta — never re-write the entire file from scratch when a partial update is all that is needed.
4. If a phase creates multiple files (e.g. L6 migrates 20 repositories), process them one at a time and print `✓ <filename>` after each one. Do not batch them silently.

**Resuming after interruption**: If you are given this prompt again mid-session, begin by reading the last `✅ PHASE X COMPLETE` line in the conversation to determine where execution stopped. Resume from the NEXT phase — do not re-run completed phases. If no completion line exists, start from Phase 0.

**Scope guard**: Every file edit must touch only what is specified for that phase. Do not refactor code from a future phase while working on an earlier one — it makes it impossible to resume cleanly.

**Verify before move**: Each phase ends with an explicit verification step. Do not output `✅ PHASE X COMPLETE` until the verification passes (service starts, endpoint returns expected response, grep confirms no stale pattern, etc.).

---

### Phase 0 — Baseline
- Start all 4 services and verify they load without crashes
- List all registered routes for each service

### Phase 0.1 — Refresh token lifecycle *(SKIP — Part O deferred, DB migration required first)*
- ⛔ Do NOT implement until `common/iam/db/migrations/015_refresh_tokens.sql` is applied to IAM Supabase project (`wrxrstmncezssrscrkxs`).
- The `refresh_tokens` table does not exist yet. Running this without the migration will crash on every login.
- Once migration is live, implement: `signTokenPair()`, `refreshApi`, `refreshService`, `refreshRepository`, httpOnly cookie on login, `POST /auth/logout`.
- See Part O for the pre-requisite migration SQL and full implementation spec. Verify: login → get cookie → `/auth/refresh` returns new access token → `/auth/logout` clears cookie

### Phase 0.25 — Auth hardening (Parts M + N)
- Create `base/auth/signToken.js` — centralized JWT signing utility
- **Remove `national_id` from JWT payload** (N7) — strip it from `signToken()` and all existing `new SignJWT(...)` calls; **also remove `req.user.national_id = payload.national_id` from `base/middleware/requireAuth.js`** (it is currently set on `req.user` during token verification — this line must be deleted). Any endpoint that previously read `req.user.national_id` must be updated to fetch it from the DB via a permissioned repo call instead.
- Update all IAM login services to use `signToken()` — remove duplicated `new SignJWT(...)` blocks
- Remove SuperAdmin role-bypass from `requireAuth.js` `requirePermissions` helper
- Add Redis token revocation check to `requireAuth.js`
- Add `revokeToken(userId)` to IAM admin service
- Verify `config.jwt.expiresInSeconds` ≤ 900 (15 minutes) in all services
- Add `redactLog` to logger — verify sensitive fields never appear in logs
- **Move `WORKER_REGISTRATION_KEY` to env var `WORKER_REGISTRATION_SECRET`** (N8) — remove hardcoded value from source
- **Remove `SuperAdmin` from `VALID_ROLES` in `workerRegisterService.js`** (N8) — SuperAdmin is DBA-created only
- **Fix timing attack on login** (N9) — add dummy `bcrypt.compare` when user not found in `loginService.js`, `otpLoginService.js`, `passwordResetService.js`
- **Replace `Object.assign(new Error(), {statusCode})` with `ApplicationError` in all IAM login files** — `loginService.js`, `otpLoginService.js`, `passwordResetService.js`, `mfaService.js`, and `workerRegisterService.js` currently throw `Object.assign(new Error(), { statusCode: 401 })` (or similar). The `errorHandler.js` in `base/middleware/errorHandler.js` only serializes `ApplicationError` instances with the standard `{ success: false, error: { code, message } }` envelope. Raw `Error` objects fall through as unformatted 500s. Replace every `throw Object.assign(new Error(msg), { statusCode: N })` with the appropriate `ApplicationError` factory: `throw ApplicationError.unauthorized(msg)`, `throw ApplicationError.badRequest(msg)`, etc.
- **Replace `morgan` with `pino-http`** (N10) — redact national ID path segments from logs; remove morgan from all 4 services
- **Wire `helmet()` with full custom config in all 4 service api.js files** (N3) — current state calls `helmet()` with no arguments (no CSP, no HSTS, no referrer policy). Replace with the config block documented in N3 (`contentSecurityPolicy`, `hsts`, `referrerPolicy`)
- Fix `express.json` body limit in `family-service`** (N4) — currently `10mb`, must be `1mb`. Apply `express.urlencoded({ limit: '1mb' })` too. File uploads go through multer separately and are not affected
- **Verify CORS_ORIGIN is set and not wildcard in all services** — update cors() call to include `credentials: true`
- Wire `auditLog` middleware in family-service and programme-service `api.js` — **in Phase 0.25 use the existing service pool/supabase client** for the `pool:` parameter (the `createConnection()` singleton does not exist until Phase 0.5/L5; the pool is replaced then). Requires `CENTRAL_AUDIT_DATABASE_URL` env var (IAM DB pooler URL) for the `centralPool:` parameter.
- Also add `write` and `read` buckets to `createRateLimiters()` in `base/middleware/rateLimiter.js` **now** — the wiring order below uses `rateLimiters.write` and `rateLimiters.read` immediately; Phase 6 only deletes duplicate per-service files, it does not re-wire:
  ```js
  write: rateLimit({ prefix: 'write', maxRequests: 100, windowSec: 60, redisClient, logger }),
  read:  rateLimit({ prefix: 'read',  maxRequests: 500, windowSec: 60, redisClient, logger }),
  ```
- Create **minimal stub** versions of three middlewares that the wiring order below imports but Phase 8 fully implements. Without these files, `import` in `api.js` throws `MODULE_NOT_FOUND`. Phase 8 replaces each stub with its full implementation:
  ```js
  // base/middleware/loadShedder.js  (STUB — Phase 8 H6 replaces with full in-flight counter)
  export function loadShedder() { return (_req, _res, next) => next() }

  // base/middleware/waf.js  (STUB — Phase 8 H2 replaces with full bot/SQL/null-byte checks)
  export function waf() { return (_req, _res, next) => next() }

  // base/middleware/requestTimeout.js  (STUB — Phase 8 H8 replaces with full 30s hard timeout)
  export function requestTimeout(_ms) { return (_req, _res, next) => next() }
  ```

> ⚠️ **Definitive `api.js` middleware wiring order** — when editing each service's `api.js` in Phase 0.25, ensure middleware is registered in EXACTLY this sequence (this overrides any ordering described in individual sections):
> ```js
> app.use(helmet({...}))                                          // 0 — security headers
> app.use(requestId())                                            // 1 — attach X-Request-Id
> app.use(compression({...}))                                    // 2 — gzip responses
> app.use(requestTimeout(parseInt(process.env.REQUEST_TIMEOUT_MS || '30000'))) // 3 — kill hung requests
> app.use(loadShedder())                                         // 4 — reject if overloaded
> app.use(waf())                                                 // 5 — block bad agents/SQL
> app.use('/api/v1/auth', rateLimiters.loginAttempt)             // 6a — auth rate limit
> app.use('/api/v1', (req, res, next) => {                       // 6b — write rate limit
>   if (['POST','PATCH','PUT','DELETE'].includes(req.method)) return rateLimiters.write(req, res, next)
>   next()
> })
> app.use('/api/v1', (req, res, next) => {                       // 6c — read rate limit
>   if (req.method === 'GET') return rateLimiters.read(req, res, next)
>   next()
> })
> app.use(pinoHttp({...}))                                       // 7 — structured request logs
> app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true })) // 8 — CORS
> app.use(express.json({ limit: '1mb' }))                        // 9 — parse JSON bodies
> app.use(express.urlencoded({ extended: true, limit: '1mb' }))  // 10 — parse form bodies
> app.use(auditMiddleware({...}))                                 // 11 — audit log (non-blocking)
> // then mount feature modules via ApiSchema.register()
> ```
> `requireAuth`, `requirePermission`, caching, multer, and Zod validation are injected per-route by `ApiSchema` — they do NOT go in the global middleware chain.

- Review all Zod schemas — add `.max()` to every `z.string()` field that lacks it; add `.max(72)` specifically to all password fields (N4 bcrypt truncation hazard)
- **Encrypt TOTP secrets at rest** (N11) — create `base/auth/mfaCipher.js`, update MFA service to encrypt before storing and decrypt before verifying, add transparent migration for existing plaintext secrets, add `MFA_ENCRYPTION_KEY` to IAM `.env` and `validateEnv()`
- **Replace predictable invite tokens** (N12) — generate `crypto.randomBytes(48)` instead of using `user_id` in invite links, store SHA-256 hash in `otp_tokens`, look up by hash on account setup
- **Add inter-service auth for email** (N13) — create `base/middleware/serviceAuth.js`, wire in email-service `api.js`, update IAM/family/programme email clients to send `X-Service-Key` header, add `SERVICE_AUTH_KEY` to all `.env` files
- **Fix throttle double-decrement** (N17) — add `cleaned` once-guard in `base/middleware/throttle.js`, fix error code `429` → `'THROTTLE_LIMIT'`
- **IMMEDIATE: Add `sanitizeIdentifier` guard to the EXISTING `base/queryHelper.js` `orderBy()` method in Phase 0.25** — the current file has `orderBy(column, direction)` that pushes `${column} ${direction}` with NO sanitization. If any existing repository passes a user-controlled sort column (e.g. from `?sortBy=...` query params) to `orderBy()` before Phase 0.5 replaces the file, SQL injection is possible right now. Add this guard to the CURRENT file immediately (it will be replaced in Phase 0.5 anyway, but closing the window now prevents exposure during the refactoring window):
  ```js
  // In the EXISTING base/queryHelper.js — patch the orderBy() method NOW:
  orderBy(column, direction = 'ASC') {
    // Sanitize identifier: strip everything except letters, digits, underscores, dots
    const col = typeof column === 'string' ? column.replace(/[^a-zA-Z0-9_.]/g, '') : null
    if (!col) throw new Error(`QueryHelper.orderBy: invalid column name "${column}"`)
    const dir = String(direction).toUpperCase() === 'ASC' ? 'ASC' : 'DESC'
    this._orderClauses.push(`${col} ${dir}`)
    return this
  }
  ```
  This same sanitization is already specified for the NEW `queryHelper.js` (Rule 18) — this just closes the window before Phase 0.5.

> ⚠️ **N11/N12 repository method sequencing**: The service-layer changes in Phase 0.25 (TOTP encryption, invite tokens) require new repository methods that do not exist yet — `updateFactorSecret(factorId, encryptedSecret)`, `updateOtpSecret(userId, encryptedSecret)`, `createOtpToken({...})`, `getOtpTokenByHash(hash, purpose)`, `markOtpUsed(id)`. Implement these methods **now**, using the current repository pattern (the same DB access style already used in `mfaRepository.js`, `inviteRepository.js`). Do not skip them — the service layer calls them immediately. They will be **fully rewritten** as `QueryHelper` calls in Phase 0.5 (L6) when all repositories are migrated to `BaseRepository`. This means you do the work in two passes: stub in Phase 0.25, refactor in Phase 0.5.

### Phase 0.5 — Database layer consolidation (Part L)
- **Pre-flight**: Before writing any repository code, confirm each service's `.env` has `DATABASE_URL` set to the Supabase pooler connection string (port 6543) for its project. For family-service and programme-service, pass `schema: 'family'` / `schema: 'programme'` to `createConnection` so `search_path` is set automatically on every connection — bare table names then work without any schema prefix.
- L1: Create `base/db/createConnection.js` — pg-compatible connection factory
- L2: Create `base/baseRepository.js` — single base class with circuit breaker (spec in H5)
- L3: Update `base/apiContext.js` — add `connection` property
- L4: Update `base/apiSchema.js` — extract and forward `connection` from options
- L5: Update each service's `api.js` — create connection singleton, pass to all `register()` calls
- L6: Migrate all repositories — extend `BaseRepository`, remove direct db imports, convert Supabase JS calls to QueryHelper SQL
- Delete `base/baseDbRepository.js`
- L7: Verify (all services start, reads and writes work, no repo imports db client directly)

### Phase 1 — Fix tsconfig errors (Part J)
- Fix all 4 tsconfig.json files
- Verify "overwrite input file" errors are gone
- Verify `engineService.js` error is resolved

### Phase 2 — Permission system refactor (Part B)
- Update `requirePermission.js` for all 3 forms
- Update `apiSchema.js` router builder
- Replace all `permissionsAnyOf` / `permissionsAllOf` with `permission` across all services
- Verify 401/403/200 on at least 5 endpoints

### Phase 3 — Module completeness (Part F)
- Rename IAM `api.js` files to `<feature>Api.js` (F1)
- Create missing layers (F2): auditService, customFieldService, customFieldRepository, keycloakLoginService, keycloakLoginRepository, healthService (IAM), healthRepository (IAM)
- **Port `keycloakLogin.ts` logic** into new `keycloakLoginService.js` — use `signToken()` from `base/auth/signToken.js`, remove `national_id` from JWT, use `ApplicationError` instead of `Object.assign(new Error(...))`
- Update `BaseController`, `BaseService`, `BaseRepository` to add `this.logger = createLogger(this.constructor.name)` in constructors (should already be set after Phase 0.5)
- **Delete old IAM services/** (N18) — delete `login.ts`, `otpLogin.ts`, `passwordReset.ts`, `mfa.ts`, `invite.ts`, `keycloakLogin.ts` from `iam-service/src/services/`. Refactor `eventHandlers.ts` to use new feature repositories with a minimal worker context (see N18)
- **Fix rule engine batch evaluation** (N14 / F3a) — rewrite `evaluateAllSubjects()` to pre-fetch all data in ~8 bulk queries, evaluate in memory. Keep `evaluateSubject()` unchanged for single-subject use
- **Fix customFieldManager safety** (N15 / F3b) — add `ALLOWED_TARGET_TABLES` whitelist, validate `data_type` against `PG_TYPE_MAP`, apply `sanitizeIdentifier()` to generated column name
- Verify all 4 services load after all changes

### Phase 4 — Migrate routes/ folder (Part E)

> ⚠️ **Pre-step**: Before starting E2 (upload module), implement `base/middleware/upload.js` as specified in Part E2 and Part H. The upload module endpoint config uses `file: { field: 'file' }` which requires `ApiSchema` to call `createUploadMiddleware()` from `base/middleware/upload.js`. Without this file, `ApiSchema.register()` will throw on any endpoint that declares `file:`. Create `upload.js` first, then proceed with E1, E2, E3.

- E1: registration.routes.ts → registration module (verify all ~28 endpoints)
- E2: upload.routes.ts → upload module (verify upload/delete/signed-URL)
- E3: dev.routes.ts → sql-editor module (verify sql/schema/table/seed/clear)
- Delete each source file after verification
- Delete `routes/` folder
- Update `api.js` to mount new modules

### Phase 5 — Redis cache layer (Part C)
- Implement `base/redisCache.js`
- Update `apiSchema.js` to inject cache middleware
- Enable caching on at least 3 GET endpoints across services
- Verify `X-Cache: HIT` and `X-Cache: MISS`

### Phase 6 — Rate limiting wired (Part D)
- Wire `createRateLimiters` in each service's `api.js`
- Fix `code: 429` → `code: 'RATE_LIMITED'`
- Delete duplicate rateLimiter files
- Verify 429 triggers with correct headers

### Phase 7 — Response validation (Part G)
- Add `response:` field enforcement to `apiSchema.js` — throw at registration if missing
- Add `response:` schemas to **every** endpoint across all 4 services (mandatory, not optional)
- Verify server fails to start if any endpoint is missing `response:`
- Verify `RESPONSE_VALIDATION_ERROR` is returned on deliberate mismatch

### Phase 8 — Traffic hardening (Part H) + email worker durability (N16)
- Implement `base/middleware/upload.js` (centralized multer factory) and wire into `ApiSchema`
- H1: Cache-Control headers
- H2: WAF middleware
- H3: Standardize /health, Docker healthchecks, graceful shutdown
- H4: Document docker-compose scale + Nginx config
- H5: Circuit breaker — already centralized in `BaseRepository` (Phase 0.5); verify it fires; wrap HTTP clients manually
- H6: Load shedder middleware
- H7: Verification checklist (including request timeout test)
- H8: Request timeout middleware — implement and wire in all 4 `api.js` files
- **N16: Email worker durable retry** — apply the `retry_at` / `attempt_count` migration to email DB, replace `setTimeout` with DB-backed retry state + 30s sweep loop in worker, verify: kill worker during retry delay → restart → pending emails are re-published
- Create `backend/docs/INFRASTRUCTURE.md` with middleware order + env vars table (Part K)

### Phase 9 — Duplicate cleanup (Part I)
- Remove duplicate rateLimiter files
- Verify all services start after cleanup

### Phase 10 — Final verification
- Start all 4 services
- Smoke test every endpoint group per service
- Verify DB writes for at least one create and one update per major feature
- Verify auth: 401 on missing token, 403 on missing permission, 200 on valid token
- Confirm no table/column names changed
- **N11 verify**: Enroll TOTP → check DB contains encrypted secret (has `:` separators) → verify OTP code succeeds → existing plaintext user logs in → secret auto-encrypted on read
- **N12 verify**: Create invite → check invite link uses opaque token (not UUID) → click link → account setup works → same link cannot be reused
- **N13 verify**: Call email endpoint without `X-Service-Key` → 401. With key → 200. IAM login sends OTP email successfully (key sent by emailClient)
- **N14 verify**: Call `evaluateAllSubjects` for a programme with 100+ families → completes in <5 seconds (not minutes) → check DB query count is <10 (not thousands)
- **N15 verify**: Create custom field with `target_table: 'users'` → rejected (not in whitelist). With `target_table: 'family'` → succeeds
- **N16 verify**: Trigger email send that fails → check DB has `retry_pending` status with `retry_at` timestamp → kill worker → restart → email retried automatically
- **N17 verify**: Run concurrent requests through throttled endpoint → Redis counter stays accurate (never goes negative)
- **N18 verify**: `ls iam-service/src/services/` → only `eventHandlers.ts` remains. `grep -r 'services/login' iam-service/src/` → zero hits (no stale imports)

---

## Output format (strict)

1. Summary of changes (by feature/module)
2. List of files modified/created/deleted (and why)
3. Permission binding approach + examples (all 3 forms shown)
4. Redis caching policy + proof of HIT/MISS
5. Rate limiting strategy + proof of 429
6. Response validation — proof it catches a bad response shape
7. Traffic hardening — H7 verification checklist with results
8. Final verification checklist (all phases passed)
9. `backend/docs/INFRASTRUCTURE.md` — infrastructure reference doc (Part K)
10. Proof that `signToken` is the only JWT signing path (grep result showing no other `new SignJWT` in codebase)
11. Proof that no log line contains `password`, `national_id`, or `token` value (grep result)
12. Proof that no repository file contains `supabase.from(` or template-literal SQL (grep result)
13. Proof that `mfa_factors.secret` and `users.otp_secret` contain encrypted values (DB query showing `:` separators)
14. Proof that invite links use opaque tokens, not UUIDs (grep for `auth/setup?token=` — should reference randomBytes, not user_id)
15. Proof that email endpoints reject requests without `X-Service-Key` header (curl without header → 401)
16. Proof that no `setTimeout` exists in email worker retry path (grep result)
17. Proof that `iam-service/src/services/` contains only `eventHandlers.ts` (ls result)

**Reminder**: No role-based checks, no routes folders, validation inline with Zod in Api files, professional formatting, AND+OR permission semantics, centralized cache, rate limiting in api.js, response validation with Zod, traffic hardening, and test every endpoint you touch.
