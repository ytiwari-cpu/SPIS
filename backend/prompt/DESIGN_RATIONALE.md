# SPIS Backend — Design Rationale & Architecture Decisions

This document is the **why** companion to `claude_backend_prompt_with_infra_and_central_services.md`.
For every significant architectural decision in that spec, this file explains the reason it was chosen over the alternatives.

---

## What we have implemented — Index

| # | Decision | One-line summary |
|---|---|---|
| 1 | [Permission-based authorization](#1-permission-based-authorization-not-role-based) | Role names are never checked in code; every endpoint declares the permission it needs |
| 2 | [4-layer module architecture](#2-4-layer-module-architecture-api--controller--service--repository) | Api → Controller → Service → Repository; each layer independently testable |
| 3 | [Inline Zod validation in Api files](#3-inline-zod-validation-in-api-files-no-separate-schema-files) | Schema lives next to the route it validates; no file-jumping |
| 4 | [QueryHelper (squel-style builder)](#4-queryhelper-squel-style-builder-instead-of-raw-sql-strings) | Fluent builder; parameterized placeholders auto-generated; raw SQL strings banned |
| 5 | [No RETURNING clause — ever](#5-no-returning-clause--ever) | INSERTs/UPDATEs return rowCount only; write endpoints return a message, not resource data |
| 6 | [GET responses always return an array](#6-get-responses-always-return-an-array--even-for-single-resource-fetches) | Frontend always receives an array; `findAll()` is the only endpoint GET helper |
| 7 | [Write responses contain only a message](#7-write-responses-contain-only-a-message--no-resource-data) | POST/PATCH/PUT/DELETE → `{ success, message }` only; no `data` field |
| 8 | [Centralized rate limiting](#8-centralized-rate-limiting--not-per-endpoint) | 3 buckets (auth/write/read) wired globally in `api.js`; no per-endpoint limiters |
| 9 | [Redis fail-open on outage](#9-redis--fail-open-on-outage) | All Redis features degrade gracefully; a Redis crash never returns 500 to users |
| 10 | [ApplicationError — single error class](#10-applicationerror--single-error-class-no-raw-throw-new-error) | Consistent `{ success: false, error: { code, message } }` shape; errorHandler only serializes `ApplicationError` |
| 11 | [Soft deletes — use status columns](#11-soft-deletes--use-existing-status-columns-never-hard-delete) | No `deleted_at`; existing `status` column transitions preserve audit trail |
| 12 | [Input sanitization inside QueryHelper](#12-input-sanitization-inside-queryhelper--not-in-zod-schemas) | `_sanitizeValue()` trims + escapes HTML on every INSERT/UPDATE; inescapable chokepoint |
| 13 | [SQL identifier sanitization](#13-sql-identifier-sanitization--sanitizeidentifier) | `sanitizeIdentifier()` strips injection chars from column/table names; no hardcoded allowlist |
| 14 | [Logger from base class](#14-logger-from-base-class--never-import-createlogger-in-feature-files) | `this.logger` auto-created in `BaseController/Service/Repository`; consistent naming |
| 15 | [DB connection through ApiContext](#15-db-connection-flows-through-apicontext--never-imported-in-feature-files) | Singleton pool created in `api.js`, forwarded via `ApiContext`; testable + singleton |
| 16 | [Declarative file upload](#16-declarative-file-upload--no-multer-in-api-files) | `file: { field }` in endpoint config; `ApiSchema` auto-injects multer middleware with magic-byte validation |
| 17 | [Circuit breaker on all DB calls](#17-circuit-breaker-on-all-db-calls-baserepository) | `opossum` at `BaseRepository` level; fast-fails on repeated errors; protects event loop |
| 18 | [WAF middleware](#18-waf-middleware--block-scanners-bad-content-types-sql-in-query-strings) | Blocks scanners, bad Content-Types, SQL in query strings, null bytes |
| 19 | [Startup env validation](#19-startup-validation--crash-fast-on-missing-required-env-vars) | `validateEnv()` crashes the service at boot if required vars are missing |
| 20 | [No sensitive fields in responses](#20-no-sensitive-fields-in-http-responses--service-level-projection) | Service `map()`s over `findAll()` rows; only safe fields reach the controller |
| 21 | [Timing attack prevention in login](#21-timing-attack-prevention-in-login) | Dummy `bcrypt.compare` runs even when email not found; constant ~200ms response |
| 22 | [AES-256-GCM for TOTP secrets](#22-aes-256-gcm-encryption-for-totp-secrets) | TOTP secrets encrypted before DB storage; plaintext never stored; auto-migrates on read |
| 23 | [Inter-service authentication](#23-inter-service-authentication-x-service-key-header) | `X-Service-Key` required on email-service; `timingSafeEqual` comparison prevents timing attacks |
| 24 | [Throttle double-decrement fix](#24-throttle-double-decrement-fix) | `cleaned` boolean guard ensures Redis counter is decremented exactly once per request |
| 25 | [Pagination with meta](#25-pagination--always-include-meta) | All list endpoints include `meta.total`, `totalPages`, `hasNext`, `hasPrev`; no extra count round-trip |
| 26 | [Response validation with Zod](#26-response-validation-with-zod-part-g) | Every endpoint declares an inline `response:` Zod schema; `apiSchema.js` enforces at registration; `apiSchema.js` passes it to `ApiContext` as `responseSchema`; `respondJson` calls `safeParse` before sending — same pattern as `validate.js` on the request side |
| 27 | [Graceful shutdown](#27-graceful-shutdown) | SIGTERM stops accepting requests, drains in-flight, then closes pool + Redis cleanly |
| 28 | [Horizontal scaling — no in-memory state](#28-horizontal-scaling--no-in-memory-state) | All shared state in Redis; no module-level `Map`/`Set`; file uploads streamed to object storage |

---

---

## 1. Permission-based authorization (not role-based)

**What we implement**
Every API endpoint declares a `permission` string (e.g. `"family.view"`). Access is granted only if the requesting user holds that exact permission. Role names (`SuperAdmin`, `Worker`, `Admin`) are never checked in application code.

**Why**
Role-based checks scatter across the codebase and drift — `if (role === 'SuperAdmin') return next()` is copy-pasted, then forgotten when a new role is introduced. When a role gains new permissions or a new role is added, every scattered check must be hunted down.

Permission-based checks are self-documenting and self-contained: each endpoint declares exactly what it needs, and the middleware enforces it uniformly. Adding a new role means assigning it permissions in the DB — zero code changes required.

**Side effect removed**: The `SuperAdmin` bypass (`if (userRoles.includes('SuperAdmin')) return next()`) is deleted from `requireAuth.js`. SuperAdmin access is granted by assigning the relevant permissions in the DB, not by hardcoding special logic in middleware.

---

## 2. 4-layer module architecture (Api → Controller → Service → Repository)

**What we implement**
Every feature — without exception — has exactly four files:
- `<feature>Api.js` — routes, validation, permissions (zero logic)
- `<feature>Controller.js` — HTTP glue: extract params → call service → return response
- `<feature>Service.js` — business logic (no HTTP, no DB)
- `<feature>Repository.js` — DB queries only (no logic, no HTTP)

**Why**
Separation of concerns. When a business rule changes, you touch only `Service`. When a column is added, only `Repository` changes. When an HTTP verb changes, only `Api`. Each layer is independently testable: service tests use mock repositories, repository tests use a test DB, controller tests use mock services.

The current codebase mixes all four concerns in single files. A developer debugging a validation error must read through DB code; a developer adding a column must read through business logic. The 4-layer structure eliminates this.

**Side effect**: The `routes/` folder in `family-service` is deleted — all routing moves into `Api` files.

---

## 3. Inline Zod validation in Api files (no separate schema files)

**What we implement**
The Zod schema for params, body, and query is written directly inside the endpoint config object in the Api file. No `const registerSchema = z.object({...})` exported from a separate file.

**Why**
Co-location. A developer reading the Api file sees the exact shape the endpoint expects — no file-jumping. When the route changes (new field, removed field), the schema changes in the same diff. When the schema lives in a separate file, it is routinely left out of sync.

---

## 4. QueryHelper (squel-style builder) instead of raw SQL strings

**What we implement**
All DB queries are built using `QueryHelper` — a fluent builder class. Template-literal SQL strings (`` pool.query(`SELECT * WHERE id = '${id}'`) ``) are banned everywhere.

**Why**

- **SQL injection prevention**: parameterized placeholders (`$1, $2 ...`) are built automatically. User values never touch the SQL string.
- **Consistency**: every query in every repository looks the same. Code reviews catch mistakes faster.
- **Enforced constraints**: the builder is the chokepoint for sanitization (`_sanitizeValue`) and identifier safety (`sanitizeIdentifier`). Raw SQL strings bypass both.

---

## 5. No RETURNING clause — ever

**What we implement**
`INSERT`, `UPDATE`, and `DELETE` never use `RETURNING`. After a write, the repository returns only `rowCount`. If the caller needs the saved data, it issues a separate `SELECT`.

**Why**

- **Response shape consistency**: write endpoints return `{ success: true, message }` — no resource data. If `RETURNING` were allowed, the temptation to return the row would re-emerge constantly.
- **Simpler auditing**: every data read is an explicit `SELECT`. Audit logs capture all reads, not just those that aren't piggy-backed onto writes.
- **Over-fetching prevention**: most write callers don't need the full updated row. Making them ask for it explicitly (separate GET) prevents unnecessary data transfer.

---

## 6. GET responses always return an array — even for single-resource fetches

**What we implement**
All GET endpoints return `data: [{ ...resource }]`. Even `GET /family/:id` returns a one-element array, not a bare object. Repositories use `findAll()` for all endpoint GET responses. Controllers call `this.respondOk(data)` directly — no return value needed.

**Why**
Frontend code that branches on `Array.isArray(data)` is fragile and duplicated across every page. A consistent contract (always an array) means one code path handles all responses. `map`, `filter`, `reduce`, and `data[0]` all work uniformly whether the response has 0, 1, or 100 items.

**How the array guarantee holds**
`findAll()` always returns `rows[]`. For single-resource lookups, repositories call `findAll()` with a WHERE clause instead of `findOne()`. The service checks if the returned array is empty and throws `ApplicationError.notFound()` if so. `findOne()` still exists for internal use (e.g., existence checks before creates) but is never used for endpoint responses.

---

## 7. Write responses contain only a message — no resource data

**What we implement**
POST, PATCH, PUT, DELETE return `{ success: true, message: 'Family registered successfully' }`. No `data` field. No inserted/updated row.

**Why**

- **Prevents shape drift**: the create-response shape and the read-response shape for the same entity would inevitably diverge (different fields selected, different nesting). One shape for reads, one message for writes.
- **Prevents over-fetching**: the write caller rarely needs the full row. If it does, it issues a GET.
- **Forces fresh data**: a GET after a write always reflects the current DB state, including any triggers, defaults, or other concurrent writes that happened after the insert.

---

## 8. Centralized rate limiting — not per endpoint

**What we implement**
Rate limiters are applied globally in each service's `api.js`, not added to individual endpoint configs. Three buckets:
- `loginAttempt` — very strict (10 req/min per IP on `/auth`)
- `write` — moderate (100 req/min for POST/PATCH/PUT/DELETE)
- `read` — generous (500 req/min for GET)

All limiter configuration lives exclusively in `base/middleware/rateLimiter.js`.

**Why**
Per-endpoint rate limiting is always missed on new endpoints. A centralized approach protects every route automatically — including ones added next month. A developer adding a new endpoint should not have to remember to add rate limit middleware.

---

## 9. Redis — fail-open on outage

**What we implement**
Redis is used for rate limiting, caching, and token revocation. If Redis goes down, all Redis-dependent features fail open (allow through) instead of returning 500 errors. Every Redis call is wrapped in try/catch with a safe fallback.

**Why**
A Redis outage should not take down API request handling. The cost of occasionally letting through a slightly-over-limit request, or serving a cache miss from the DB, is far lower than a complete service outage for all users.

| Feature | Redis down behaviour |
|---|---|
| Cache | Every request treated as MISS — serve from DB |
| Rate limiter | Allow request, log warning |
| Token revocation | Allow token through (short JWT TTL ≤ 15 min limits exposure) |
| Load shedder | Uses in-memory counter — unaffected by Redis |

---

## 10. ApplicationError — single error class, no raw `throw new Error()`

**What we implement**
All errors in all 4 services use `ApplicationError` factory methods: `ApplicationError.notFound(...)`, `ApplicationError.badRequest(...)`, etc. Raw `throw new Error(...)` is banned in feature code.

**Why**

- `errorHandler.js` only knows how to serialize `ApplicationError` instances. A raw `Error` falls through as a generic 500 with no useful message.
- Consistent shape: every error the client receives is `{ success: false, error: { code: 'UPPER_SNAKE_CASE', message: '...' } }`.
- Single source of truth: changing the HTTP status for `NOT_FOUND` from 404 to 410 happens in one place (`applicationError.js`), not scattered across dozens of `throw new Error` statements.

---

## 11. Soft deletes — use existing status columns, never hard-delete

**What we implement**
Business records are never hard-deleted with `DELETE FROM`. "Delete" endpoints set `status = 'archived'` (or equivalent). The `deleted_at` column is not used and is not added.

**Why**

- **Audit trail**: archived records remain queryable for compliance, disputes, and history audits.
- **Recovery**: accidentally archived records can be restored. Hard-deleted rows cannot.
- **No schema change needed**: every table already has a status column with a defined lifecycle. Adding `deleted_at` would duplicate the mechanism.

Hard deletes are only acceptable on junction/log tables (`role_permissions`, `user_permissions`, `rate_limits`, `bounce_feedback`) where TTL-based cleanup is the intended lifecycle.

---

## 12. Input sanitization inside QueryHelper — not in Zod schemas

**What we implement**
`QueryHelper._sanitizeValue()` is called automatically on every string value passed to `insert()` or `update()`. It trims whitespace and escapes HTML entities (`<`, `>`, `&`, `"`, `'`).

**Why**

- **Trim**: `" John "` and `"John"` should be the same person. Without trimming, registration creates duplicates.
- **HTML escape**: if a name like `<script>alert(1)</script>` reaches the DB and is later rendered in any web UI, it executes. Escaping at storage time converts it to harmless text before it ever enters the DB.
- **Centralization**: if sanitization lived in individual Zod schemas, any new endpoint that forgot to add `.trim()` would be vulnerable. In QueryHelper, it is automatic and inescapable — the chokepoint.

---

## 13. SQL identifier sanitization — sanitizeIdentifier()

**What we implement**
Any column name, table name, or ORDER BY direction that originates from user input (query params, request body) is passed through `sanitizeIdentifier()` before being inserted into a SQL string. The function strips everything except `[a-zA-Z0-9_.]`.

**Why**
Parameterized queries (`$1, $2`) protect values — but they **cannot** protect identifiers. `ORDER BY $1` is illegal SQL; the column name must go into the SQL string directly. Without sanitization, `?sortBy=1 UNION SELECT password_hash FROM users--` would become valid SQL.

**Why not a hardcoded allowlist?**
The column set grows as the schema evolves. An allowlist needs updating every time a new sortable column is added. `sanitizeIdentifier` neutralizes injection without maintenance — any real DB column name passes through unchanged (columns only ever contain `[a-zA-Z0-9_]`); injection payloads rely on special characters that are stripped.

---

## 14. Logger from base class — never import createLogger in feature files

**What we implement**
`BaseController`, `BaseService`, and `BaseRepository` create `this.logger = createLogger(this.constructor.name)` in their constructors. All feature classes inherit `this.logger` automatically.

**Why**
If developers import `createLogger` manually, they name loggers inconsistently (`'Login'`, `'login-service'`, `'LoginSvc'`). Base-class initialization guarantees the logger name always matches the class name exactly — making `grep LoginService logs/` reliable in production.

---

## 15. DB connection flows through ApiContext — never imported in feature files

**What we implement**
A `pg.Pool` is created once at service startup in `api.js` via `createConnection(...)`. It is passed into every `ApiContext` instance via `ApiSchema.register()`. `BaseRepository` reads `this.connection = context.connection`.

**Why**

- **Singleton guarantee**: one pool per service, shared across all requests. Creating a new pool per request exhausts DB connections within minutes.
- **Testability**: tests inject a test DB connection via the context — no monkey-patching of module imports.
- **Single point of change**: if the pool is replaced (e.g., switching from Supabase to a direct pg connection), you change `api.js` only — not 40 feature files that all import the pool directly.

---

## 16. Declarative file upload — no multer in Api files

**What we implement**
Endpoints that accept file uploads declare `file: { field: 'file', maxSizeMb: 50 }` in their config object. `ApiSchema` reads this and auto-injects **multer** middleware from `base/middleware/upload.js`. Magic-byte validation, filename sanitization, and path-traversal prevention all happen inside the middleware — not in controllers. Files max out at ~50 MB, so multer's in-memory or disk-storage mode is appropriate.

**Why**
Centralizing upload configuration in `base/middleware/upload.js` ensures every upload endpoint benefits from the same security controls. A developer adding a new upload endpoint cannot accidentally bypass the checks by creating their own multer instance. Declaring `file:` in the endpoint config keeps Api files free of direct multer imports — the same declarative pattern used for auth, caching, and Zod validation.

---

## 17. Circuit breaker on all DB calls (BaseRepository)

**What we implement**
Every DB call in `BaseRepository` is wrapped in an `opossum` circuit breaker. If more than 50% of calls fail within a window, the breaker opens and fast-fails for 30 seconds.

**Why**
Without circuit breakers, a slow or unreachable DB causes request threads to block waiting for DB responses. Within seconds, the event loop saturates with pending requests and the service becomes unresponsive to all clients — even those whose requests don't touch the DB.

The circuit breaker lets the service respond with `503 SERVICE_UNAVAILABLE` immediately. The load balancer can route to a healthy replica. After 30 seconds the breaker probes the DB with one request; if it succeeds, the circuit closes and normal traffic resumes.

---

## 18. WAF middleware — block scanners, bad content types, SQL in query strings

**What we implement**
`base/middleware/waf.js` runs before all routes on all 4 services. It blocks:
- Known scanner User-Agents (sqlmap, nikto, masscan, zgrab, dirbuster, nmap)
- POST/PATCH/PUT with an unexpected Content-Type (only `application/json` and `multipart/form-data` are valid)
- Query strings longer than 2000 characters
- Query strings containing SQL injection patterns (UNION, DROP, --, /\*, etc.)
- Null bytes (`%00`) in any query string value

**Why GET is excluded**
GET requests have no body and no Content-Type header. Query parameters on GET requests go directly to Zod validation in the endpoint config — Zod rejects unexpected shapes. No WAF check needed.

**Why DELETE is excluded**
Soft-delete endpoints don't send a body. The `express.json({ limit: '1mb' })` guard covers the rare DELETE that carries a confirm payload.

**Why urlencoded is blocked**
This is a JSON + multipart-only API. Form-encoded POSTs (`application/x-www-form-urlencoded`) are never valid here — blocking them removes an entire class of CSRF-adjacent attack surface.

---

## 19. Startup env validation — crash fast on missing variables

**What we implement**
Each service's `index.ts` calls `validateEnv([...required vars...])` as its first line, before starting the Express server. Missing variables cause an immediate hard crash with a clear error message.

**Why**
A service that starts with `JWT_SECRET=undefined` silently signs broken tokens — every user login appears to succeed but the tokens are invalid, causing mysterious 401s for all users. A service with `DATABASE_URL=undefined` crashes on the first request instead of at startup, making the root cause harder to find.

Catching missing vars at startup with `process.exit(1)` and a clear log message (`Missing required environment variables: JWT_SECRET, REDIS_URL`) makes misconfiguration instantly obvious — in CI, in staging, and in production.

---

## 20. No sensitive fields in HTTP responses — service-level projection

**What we implement**
Service methods explicitly pick only safe fields before returning data to the Controller. `password_hash`, `national_id_hash`, `token_hash`, `otp_secret`, `pin_hash`, `secret_key` are never allowed in any HTTP response body.

**Why**
Repositories return raw DB rows. If a controller called `this.respondOk(rawRow)` with unfiltered rows, sensitive columns would be in the HTTP response — logged by API gateways, visible in browser devtools, and stored in frontend state management. Service-level projection is the last line of defense before data leaves the DB layer.

---

## 21. Timing attack prevention in login

**What we implement**
When a login attempt uses an email that does not exist in the DB, `loginService` still runs `bcrypt.compare()` against a dummy hash before returning the error. Both the "email not found" and "wrong password" paths take approximately the same time to respond (~200ms).

**Why**
Without this, a nonexistent-user response returns in ~1ms (just a DB miss), while a wrong-password response takes ~200ms (bcrypt compare time). An attacker who can measure response times can enumerate all valid email addresses in the system by checking whether the response is fast or slow. The dummy compare eliminates this timing signal.

---

## 22. AES-256-GCM encryption for TOTP secrets

**What we implement**
TOTP secrets are encrypted with AES-256-GCM using `MFA_ENCRYPTION_KEY` before being stored in the DB. The DB stores ciphertext, not the raw secret.

**Why**
If the DB is exfiltrated (SQL dump, backup leak, misconfigured storage), raw TOTP secrets allow an attacker to generate valid 2FA codes for any user indefinitely — permanently bypassing MFA. Encrypted secrets are useless without `MFA_ENCRYPTION_KEY`, which lives only in environment config, not in the DB. A two-factor breach (DB + env) is required to compromise 2FA.

---

## 23. Inter-service authentication (X-Service-Key header)

**What we implement**
All non-health endpoints in `email-service` require an `X-Service-Key` header matching `SERVICE_AUTH_KEY` env var. Other services attach this header when calling email-service. Requests without it are rejected with 401.

**Why**
Without this, any network actor that can reach email-service — an SSRF vulnerability in another service, a misconfigured firewall rule, or any internal service — can trigger arbitrary email sends: password reset emails to any address, spam floods, or phishing emails that appear to come from the system.

---

## 24. Throttle double-decrement fix

**What we implement**
`base/middleware/throttle.js` has a bug: both `res.on('finish')` and `res.on('close')` call the cleanup function, decrementing the concurrency counter twice per request. The fix adds a `cleaned` boolean guard so cleanup runs exactly once.

**Why this matters**
After approximately N/2 requests (where N is the concurrency limit), the counter goes negative. Redis reads a negative counter as "slots available" even when N requests are genuinely in-flight. The throttle stops protecting the service entirely — load shedding is silently bypassed.

---

## 25. Pagination — always include meta

**What we implement**
All list endpoints return `{ success: true, data: [...], meta: { page, pageSize, total, totalPages, hasNext, hasPrev } }`.

**Why**
A raw array response forces the frontend to either hard-code limits or make a separate count query. `meta.total` tells the frontend how many records exist and how many pages are available — without a second round-trip. `hasNext` and `hasPrev` let the frontend enable/disable pagination controls without any calculation.

---

## 26. Response validation with Zod (Part G)

**What we implement**
Endpoint configs declare `request:` and `response:` Zod schemas inline — both optional but recommended. When `response:` is declared, `apiSchema.js` stores `route.response` on `req.responseSchema` before constructing `ApiContext`. `respondJson` in `BaseController` reads `context.request.responseSchema` and calls `safeParse` before sending — the same pattern as `validate.js` calling `safeParse` on `req.body / req.params / req.query` before the controller runs. When either schema is omitted, that stage is skipped silently.

**Why optional, not mandatory**
Zod validation is a quality tool, not a gate. Forcing it at startup creates friction for new endpoints under development. Making it optional means schemas can be added incrementally — the guarantee is there when declared, absent when not. The intent is "recommended" not "enforced".

**Why validation lives in `respondJson`, not via `res.json` override**
`respondJson` is the single exit point for all JSON responses — the natural place to validate. Overriding `res.json` via monkey-patching is implicit and surprising. Putting `safeParse` directly in `respondJson` is explicit, readable, and testable in isolation. The pattern is symmetric: `validate.js` validates input before the controller, `respondJson` validates output after — both use `safeParse`, both return the same `VALIDATION_ERROR` shape.

**Why `req.responseSchema` instead of an ApiContext constructor param**
`ApiContext(req, connection)` takes only 2 params. Express sets `req.res` internally so `response` is not needed. Logger uses plain `createLogger()` with no service name or child context. Both schemas (`req.requestSchema`, `req.responseSchema`) are set on `req` by `apiSchema.js` — consistent with how Express middleware communicates data through the request object. `validate()` reads `req.requestSchema`; `respondJson` reads `req.responseSchema`.

**Why**
Response shape regressions — a field renamed, a field removed, an unexpected null — are currently invisible until a frontend developer reports a bug. Zod validation at the response layer catches these regressions at the time of the API call, in CI tests, and in development — before they reach production.

---

## 27. Graceful shutdown

**What we implement**
Each service listens for `SIGTERM` and stops accepting new requests, waits for in-flight requests to finish, then closes the DB pool, Redis connection, and exits cleanly. A 10-second timeout forces exit if in-flight requests don't finish.

**Why**
Without graceful shutdown, a container restart (during a deploy, scale-down, or crash loop) drops all in-flight requests immediately. Requests that were halfway through a DB write are abandoned — potentially leaving data in an inconsistent state. Graceful shutdown ensures deploys are zero-disruption from a client perspective.

---

## 28. Horizontal scaling — no in-memory state

**What we implement**
All shared state (rate limit counters, cache, session/token data) lives in Redis, not in-process. No `Map`, `Set`, or module-level variable is used as shared state. File uploads use memory storage temporarily and are immediately forwarded to object storage (Supabase Storage) — no local disk dependency.

**Why**
In-memory state breaks the moment you run 2 replicas. Request A from client X lands on replica 1, increments an in-memory rate limit counter. Request B from client X lands on replica 2 and sees a zero counter. Redis-backed state is shared across all replicas — horizontal scaling just works.

---
