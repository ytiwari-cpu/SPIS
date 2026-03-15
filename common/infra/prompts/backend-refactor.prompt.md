# Backend Refactoring & Centralization Prompt

**Target Model:** Claude Opus 4.6  
**Role:** Senior Backend Architect  
**Project:** SPIS Jamaica — Social Protection Information System  
**Date:** February 27, 2026

---

## CRITICAL CONSTRAINTS — READ FIRST

1. **DO NOT rename or modify any database table names or column names.** The schema is already deployed and the frontend depends on exact field names in API responses.
2. **DO NOT change any API endpoint paths or response shapes.** The frontend (`/frontend/src/`) is NOT being refactored — every existing API contract must remain intact.
3. **DO NOT delete or rewrite feature logic.** This is a structural refactoring — moving code into centralized patterns, not rewriting business logic.
4. **Test every endpoint after refactoring.** If an API returned `{ success: true, data: [...] }` before, it must return the exact same shape after.

---

## 1. CURRENT PROJECT STATE — WHAT EXISTS

### 1.1 Monorepo Structure

```
backend/
├── base/                          ← SHARED BASE LAYER (exists, partially used)
│   ├── apiContext.js              ← Request/Response/User/Logger wrapper
│   ├── apiSchema.js              ← Declarative route registry
│   ├── baseController.js         ← respondOk/respondError helpers
│   ├── baseService.js            ← getUserId/hasRole/hasPermission
│   ├── baseSupabaseRepository.js ← insertOne/updateOne/findOne for Supabase
│   ├── baseDbRepository.js       ← query/queryOne/execute for pg Pool
│   └── index.js                  ← Re-exports all base classes
├── common/
│   ├── index.ts                  ← Exports auditService
│   └── services/
│       └── auditService.ts       ← Common audit logger (via Supabase REST)
├── family-service/               ← Port 3001, Supabase DB
├── iam-service/                  ← Port 3003, Supabase REST via exec_sql/exec_ddl
├── email-service/                ← Port 3005, Supabase DB
└── programme-service/            ← Port 3007, Supabase DB
```

### 1.2 What Each Service Has (Current State)

| Capability | family-service | iam-service | email-service | programme-service |
|---|---|---|---|---|
| **4-layer features (api→ctrl→svc→repo)** | ✅ 6 features + 3 legacy routes | ✅ 7 features + 2 legacy routes | ✅ 2 features | ✅ 9 features |
| **Base class usage** | ❌ Controllers don't extend BaseController | ✅ LoginController extends BaseController | ❌ | ❌ |
| **Structured logger** | ❌ console.log + morgan only | ✅ JSON logger with PII masking | ❌ | ❌ |
| **Error handler middleware** | ✅ Basic (no logging) | ✅ With logger | ✅ Basic | ✅ Basic |
| **Custom error classes** | ✅ (in errorHandler.ts) | ✅ (in errorHandler.ts) | ✅ | ✅ |
| **Validation middleware** | ✅ Zod (validate.ts) | ✅ Zod (validate.ts) | ✅ Zod (validate.ts) | ❌ NONE |
| **Validation schemas** | ✅ Zod — 10 schemas (315 lines) | ✅ Zod — 6 schemas (48 lines) | ✅ Zod — 3 schemas (31 lines) | ✅ Zod — 10 schemas (90 lines, inline parse) |
| **Rate limiting** | ❌ NONE | ✅ Redis-based (rateLimiter.ts) | ❌ | ❌ |
| **Audit logging** | ❌ Only family_history table | ✅ Full audit middleware → DB | ❌ | ❌ |
| **Auth middleware (requireAuth)** | ✅ JWT HS256 verification | ✅ JWT HS256 verification | ❌ | ✅ |
| **Redis** | ❌ | ✅ ioredis (caching, rate-limit) | ❌ | ❌ |
| **Request logging (morgan)** | ✅ | ✅ | ✅ | ❌ |

### 1.3 Validation Coverage Gap (Critical Finding)

| Service | Endpoints WITH validation | Endpoints WITHOUT validation | Coverage |
|---|---|---|---|
| family-service (feature routes) | 8 endpoints | ~15+ endpoints | ~35% |
| family-service (registration.routes.ts — 3113 lines) | **0** endpoints | **28 endpoints** | **0%** |
| iam-service (feature routes) | 6 via middleware + 3 inline | **22+ admin endpoints** | ~30% |
| email-service | 3 endpoints | 4 endpoints (health + webhooks) | ~43% |
| programme-service | 10 (inline parse, no middleware) | ~10+ endpoints | ~50% |
| **TOTAL** | **~30 endpoints** | **~80+ endpoints** | **~27%** |

### 1.4 Key Problems to Solve

1. **~80+ endpoints have ZERO input validation.** The entire `registration.routes.ts` (28 endpoints, 3113 lines) validates nothing. All 22 admin CRUD endpoints in iam-service validate nothing. This is a security risk.

2. **Duplicate code everywhere:** Each service has its own `errorHandler.ts`, `notFound.ts`, `requireAuth.ts`, `validate.ts` — all slightly different copies of the same logic.

3. **No centralized logging:** `family-service` uses raw `console.log`. No structured JSON output. No PII masking. No correlation IDs. IAM has a good logger — it should be shared.

4. **No centralized rate limiting:** Only `iam-service` has rate limiting (Redis-based). `family-service` has zero protection against brute-force or DDoS on registration/document endpoints.

5. **No centralized audit logging:** `iam-service` has a full audit middleware that logs every mutation to `audit_logs`. Other services have nothing.

6. **Base classes exist but are not used consistently:** `baseController.js` has `respondOk`, `respondError` etc. but most controllers don't extend it.

7. **Giant monolith route files:** `registration.routes.ts` is **3,113 lines** — inline Express handlers with no separation of concerns.

8. **No request-level correlation ID:** No way to trace a request across services. Need `X-Request-Id` header propagation.

9. **Inconsistent validation patterns:** Zod is used 3 different ways — via middleware, via inline `.parse()`, or not at all. Must standardize on middleware approach.

10. **No API gateway / throttling layer:** All services called directly. No centralized rate limits, auth, or throttling.

---

## 2. REFERENCE ARCHITECTURE — WHAT TO ADOPT

The reference project (provided by the user) has a well-structured enterprise pattern. Adopt the CONCEPTS, not the exact code (the reference uses MSSQL/squel — we use Supabase/pg).

### Reference Patterns to Adopt:

**A) ApiContext (we have this — enhance it)**
- Already wraps request, response, logger, user
- ENHANCE: Add `requestId` (from `X-Request-Id` header or generate UUID)
- ENHANCE: Pass structured logger instance per request (with requestId embedded)

**B) BaseController (we have this — enforce usage)**
- `respondOk()`, `respondError()`, `respondNotFound()`, `respondCreated()`
- ENFORCE: Every controller MUST extend `BaseController`
- ADD: Automatic error logging in `respondError()` with request context

**C) BaseService (we have this — enhance it)**
- `getUserId()`, `hasRole()`, `hasPermission()`
- Already exists and is usable

**D) BaseRepository (we have two — keep both)**
- `BaseSupabaseRepository` for family-service, programme-service
- `BaseDbRepository` for iam-service (uses exec_sql/exec_ddl RPC)
- ENFORCE: Every repository MUST extend one of these

**E) ApiSchema (we have this — enhance it)**
- Declarative route definitions: `{ path, verb, handler, middleware }`
- Auto-wraps in ApiContext
- ENHANCE: Add support for per-route validation schema and rate-limit config

**F) Centralized middleware stack (NEW — create in base/)**
- Error handling (with structured logging)
- Request validation (Zod, configurable per route)
- Rate limiting (Redis, configurable per route)
- Audit logging (configurable per service)
- Request ID propagation
- CORS, helmet, body parsing

**G) ApplicationError (NEW — create in base/)**
- Standardized error class with code, statusCode, message, details
- Factory methods: `ApplicationError.badRequest()`, `.notFound()`, `.forbidden()`, `.unauthorized()`, `.conflict()`, `.validation()`, `.tooManyRequests()`
- All services throw `ApplicationError` instances → centralized error handler catches them

---

## 3. IMPLEMENTATION PLAN

### Phase 1: Centralized Shared Layer (`backend/base/`)

#### 3.1 Create `backend/base/applicationError.js`

```
ApplicationError extends Error
  - code: number (HTTP status code)
  - message: string
  - details: unknown (optional, only in dev)
  
Factory methods:
  - ApplicationError.badRequest(message)           → 400
  - ApplicationError.unauthorized(message)         → 401
  - ApplicationError.forbidden(message)            → 403
  - ApplicationError.notFound(message)             → 404
  - ApplicationError.conflict(message)             → 409
  - ApplicationError.validation(message, errors[]) → 422
  - ApplicationError.tooManyRequests(message)      → 429
  - ApplicationError.internal(message)             → 500
  - ApplicationError.serviceUnavailable(msg)       → 503
  - ApplicationError.create(statusCode, data)      → generic factory
```

Replace ALL service-specific error classes (`BadRequestError`, `NotFoundError`, etc. in each service's `errorHandler.ts`) with imports from `base/applicationError.js`.

#### 3.2 Create `backend/base/logger.js`

Centralized structured logger (extract from `iam-service/src/lib/logger.ts`):

```
Features:
  - JSON output (for log aggregators)
  - PII masking (password, otp, national_id, tokens, secrets)
  - Log levels: debug, info, warn, error
  - Configurable via LOG_LEVEL env var
  - Configurable service name per instance
  - Request correlation (requestId embedded in every log line)
  
Factory:
  createLogger(serviceName: string) → Logger instance
  
Logger methods:
  - logger.info(message, meta?)
  - logger.warn(message, meta?)
  - logger.error(message, meta?)
  - logger.debug(message, meta?)
```

Every service creates a logger via `createLogger('family-service')`. The `ApiContext` gets a child logger with `requestId` embedded.

#### 3.3 Create `backend/base/middleware/errorHandler.js`

Centralized error handler middleware:

```
- Catches all errors thrown in route handlers
- If error is ApplicationError → use its code, message, statusCode
- If error is ZodError → format as 422 validation error
- If error is unknown → 500 Internal Server Error
- ALWAYS logs via structured logger (error level for 5xx, warn for 4xx)
- In development: include stack trace and details in response
- In production: omit stack trace
- Response shape: { success: false, error: { code, message, details? } }
```

#### 3.4 Create `backend/base/middleware/requestId.js`

```
- Read X-Request-Id from incoming headers
- If not present, generate UUID
- Attach to req.requestId
- Set X-Request-Id response header
- Pass to ApiContext for logger correlation
```

#### 3.5 Create `backend/base/middleware/rateLimiter.js`

Extract from `iam-service/src/middleware/rateLimiter.ts` and generalize:

```
Configuration:
  rateLimit({
    prefix: string,
    maxRequests: number,
    windowSec: number,
    keyFn?: (req) => string,     // defaults to req.ip
    redisClient: RedisClient,    // injected — each service provides its own
  })

Behavior:
  - Uses Redis INCR + EXPIRE for sliding window
  - Sets X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset headers
  - Returns 429 with Retry-After header when exceeded
  - Fail-open: if Redis is down, allow the request through (log warning)
  
Pre-configured factories:
  - rateLimiters.loginAttempt(redisClient)       → 5 per IP per 15min
  - rateLimiters.passwordReset(redisClient)      → 5 per IP per 15min
  - rateLimiters.otpRequest(redisClient)         → 5 per IP per 15min
  - rateLimiters.apiGeneral(redisClient)         → 100 per IP per 1min
  - rateLimiters.apiHeavy(redisClient)           → 20 per IP per 1min
  - rateLimiters.bulkImport(redisClient)         → 5 per IP per 10min
```

#### 3.6 Create `backend/base/middleware/validate.js`

Centralized Zod validation middleware (extract and unify from existing):

```js
/**
 * Zod validation middleware factory.
 * 
 * @param {Object} schemas - { body?: ZodSchema, query?: ZodSchema, params?: ZodSchema }
 * @returns Express middleware
 * 
 * Usage in route definitions:
 *   validate({ body: CreateFamilySchema })
 *   validate({ body: CreateMemberSchema, params: z.object({ id: z.string().uuid() }) })
 *   validate({ query: PaginationSchema })
 */
function validate(schemas) {
  return (req, res, next) => {
    const errors = [];

    for (const [target, schema] of Object.entries(schemas)) {
      if (!schema || !['body', 'query', 'params'].includes(target)) continue;

      const result = schema.safeParse(req[target]);
      if (!result.success) {
        errors.push(
          ...result.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message,
            code: issue.code,
            target,
          }))
        );
      } else {
        req[target] = result.data; // Replace with parsed + coerced data
      }
    }

    if (errors.length > 0) {
      throw ApplicationError.validation('Validation failed', errors);
    }

    next();
  };
}
```

Supports multi-target validation in a single middleware call. Always uses `safeParse()` with `abortEarly: false` equivalent (Zod collects all errors by default). Replaces `req[target]` with parsed data for type coercion.

#### 3.7 Create `backend/base/middleware/auditLog.js`

Extract from `iam-service/src/middleware/audit.ts` and generalize:

```
auditMiddleware(options: {
  serviceName: string,
  supabaseClient: SupabaseClient | null,  // injected per service
  excludePaths?: string[],
  logGets?: boolean,                       // default: false
  sensitiveFields?: string[],
})

Behavior:
  - Intercepts res.json to capture response summary
  - On finish: writes to audit_logs table via Supabase
  - Extracts actor from req.user (JWT)
  - Extracts resource type + ID from URL path
  - Generates action from HTTP method + path
  - Sanitizes request body (redact passwords, tokens, etc.)
  - Records: actor, action, method, path, status_code, request_id, ip, user_agent, duration_ms
  - Fail-silent: audit errors NEVER break the request
```

#### 3.8 Create `backend/base/middleware/requireAuth.js`

Extract from existing (both services have near-identical copies):

```
requireAuth(options?: {
  jwtSecret?: string,
  jwtIssuer?: string,
  jwtAudience?: string,
})

Behavior:
  - Reads Authorization: Bearer <token>
  - Verifies HS256 JWT (jose library)
  - Populates req.user with { sub, national_id, email, roles, permissions }
  - Returns 401 if missing/invalid/expired
```

#### 3.9 Create `backend/base/middleware/throttle.js`

```
// Concurrency-based throttle (different from rate limit)
throttle({
  prefix: string,
  maxConcurrent: number,
  keyFn: (req) => string,
  redisClient: RedisClient,
})

Behavior:
  - On request: INCR counter, if > max → 429 "Too many concurrent requests"
  - On response finish: DECR counter
  - TTL safety: auto-expire after 5min (in case response never finishes)
```

#### 3.10 Enhance `backend/base/apiSchema.js`

Add per-route support for:
```
{
  path: '/:id',
  verb: 'POST',
  handler: { controller: FamilyController, method: 'submit' },
  middleware: [requireAuth],
  validation: { body: SubmitFamilySchema },     // NEW — auto-adds validate()
  rateLimit: { maxRequests: 20, windowSec: 60 }, // NEW — auto-adds rateLimit()
}
```

The `register()` method should auto-inject `validate()` and `rateLimit()` middleware when these properties are present.

#### 3.11 Enhance `backend/base/apiContext.js`

```
Add:
  - this.requestId = request.requestId || request.headers['x-request-id'] || uuid()
  - this.logger = logger.child({ requestId: this.requestId, userId: this.user?.sub })
```

---

### Phase 2: Adopt in Each Service

#### 3.12 family-service Refactoring

1. **Remove** duplicated middleware files:
   - `src/middleware/errorHandler.ts` → import from `base/middleware/errorHandler.js`
   - `src/middleware/notFound.ts` → import from `base/middleware/errorHandler.js`
   - `src/middleware/requireAuth.ts` → import from `base/middleware/requireAuth.js`
   - `src/middleware/validate.ts` → import from `base/middleware/validate.js`

2. **Add centralized middleware to `api.js`:**
   - Add `requestId` middleware (before all routes)
   - Add `rateLimiter.apiGeneral(redisClient)` on all routes
   - Add `auditMiddleware({ serviceName: 'family-service', ... })`
   - Replace error handler with centralized version

3. **Make all controllers extend BaseController:**
   - `FamilyController` → extend `BaseController`, use `this.respondOk()` etc.
   - `DocumentController` → extend `BaseController`
   - `MemberController` → extend `BaseController`
   - `AddressController` → extend `BaseController`
   - `CitizensController` → extend `BaseController`
   - `AuthController` → extend `BaseController`

4. **Make all repositories extend BaseSupabaseRepository:**
   - Pass `supabase` client in constructor
   - Use `this.from('family')`, `this.insertOne()`, `this.findOne()` etc.

5. **Replace console.log with structured logger:**
   - Create logger instance: `createLogger('family-service')`
   - Replace all `console.log`, `console.error` with `logger.info`, `logger.error`

6. **Wire Zod validation on ALL endpoints:**
   - Feature routes: add `validation: { body: CreateFamilySchema }` to route definitions
   - Registration routes: add `validate({ body: ... })` middleware to every handler
   - Create NEW schemas for unvalidated endpoints

7. **Add Redis client for rate limiting:**
   - Create `src/lib/redis.ts` (minimal — just for rate limiting)
   - Apply `rateLimiters.apiGeneral()` globally
   - Apply `rateLimiters.bulkImport()` on import endpoints

8. **Replace inline error classes** with `ApplicationError` from base

9. **DO NOT touch `registration.routes.ts` logic** in this phase — it's 3113 lines. Just add validation middleware and the centralized error handler + logger. The internal refactoring into 4-layer features will be a separate effort.

#### 3.13 iam-service Refactoring

1. **Move** `src/lib/logger.ts` → `base/logger.js` (the IAM version is the best — promote it)
2. **Move** `src/middleware/rateLimiter.ts` → `base/middleware/rateLimiter.js`
3. **Move** `src/middleware/audit.ts` → `base/middleware/auditLog.js`
4. **Replace** local copies with imports from `base/`
5. **Keep** IAM-specific config (Redis, Keycloak) in `src/lib/`
6. **Replace** error classes in `src/middleware/errorHandler.ts` with `ApplicationError`
7. **Wire Zod validation** on all 22 unvalidated admin endpoints
8. **Create NEW schemas** for admin CRUD (CreateUserSchema, UpdateUserSchema, CreateRoleSchema, etc.)

#### 3.14 email-service Refactoring

1. **Remove** duplicated `src/middleware/errorHandler.ts`
2. **Import** shared middleware from `base/`
3. **Add** structured logger
4. **Add** basic rate limiting (50 emails/min per IP)
5. **Add validation** on webhook endpoints

#### 3.15 programme-service Refactoring

1. **Create** validate middleware (programme-service currently has NONE)
2. **Remove** duplicated middleware
3. **Import** shared from `base/`
4. **Replace** all inline `schema.parse(req.body)` with validate middleware
5. **Add** structured logger, rate limiting
6. **Extend** base classes in all controllers/services/repositories
7. **Create NEW schemas** for unvalidated endpoints (AssignManagerSchema, GlobalRuleCreateSchema, etc.)

---

### Phase 3: API Gateway / Throttling Layer

#### 3.16 Central API Gateway Middleware (in `family-service/src/api.js`)

Since `family-service` is the main entry point (frontend → family-service → other services), it already acts as an API gateway. Enhance it:

```
1. Global rate limiting: 100 requests/min per IP for all /api/* routes
2. Tiered rate limiting:
   - /api/v1/auth/*           → 10/min per IP (auth endpoints)
   - /api/v1/registration/*   → 30/min per IP (registration forms)
   - /api/v1/families/*       → 60/min per IP (general CRUD)
   - /api/v1/upload/*         → 10/min per IP (file uploads)
3. Request throttling for expensive operations:
   - Bulk import: 5 concurrent per user (use Redis semaphore)
   - Export: 3 concurrent per user
4. Request size limits:
   - General: 1mb (already set)
   - Upload: 10mb (already set)
   - Bulk import: 50mb
```

#### 3.17 Throttling Pattern

```
// Concurrency-based throttle (different from rate limit)
throttle({
  prefix: string,
  maxConcurrent: number,
  keyFn: (req) => string,
  redisClient: RedisClient,
})

Behavior:
  - On request: INCR counter, if > max → 429 "Too many concurrent requests"
  - On response finish: DECR counter
  - TTL safety: auto-expire after 5min (in case response never finishes)
```

---

## 4. FILE CREATION / MODIFICATION SUMMARY

### New Files to Create:
```
backend/base/applicationError.js
backend/base/logger.js
backend/base/middleware/errorHandler.js
backend/base/middleware/requestId.js
backend/base/middleware/rateLimiter.js
backend/base/middleware/validate.js
backend/base/middleware/auditLog.js
backend/base/middleware/requireAuth.js
backend/base/middleware/throttle.js
backend/base/middleware/index.js              ← re-exports all middleware
```

### Files to Modify (import from base instead of local):
```
backend/family-service/src/api.js                      (add centralized middleware stack)
backend/family-service/src/features/*/controller.js    (extend BaseController)
backend/family-service/src/features/*/repository.js    (extend BaseSupabaseRepository)
backend/family-service/src/features/*/api.js           (add validation + rateLimit per route)
backend/family-service/src/routes/registration.routes.ts (add validation middleware per handler)
backend/family-service/src/validators/schemas.ts       (add ~15 NEW schemas for unvalidated endpoints)

backend/iam-service/src/api.js
backend/iam-service/src/features/*/controller.js
backend/iam-service/src/features/*/api.js
backend/iam-service/src/validators/schemas.ts          (add ~12 NEW schemas for admin endpoints)

backend/email-service/src/api.js
backend/email-service/src/features/*/controller.js

backend/programme-service/src/api.js
backend/programme-service/src/features/*/controller.js
backend/programme-service/src/features/*/api.js        (replace inline .parse() with middleware)
```

### Files to Delete (after migration):
```
backend/family-service/src/middleware/errorHandler.ts   → replaced by base
backend/family-service/src/middleware/notFound.ts        → replaced by base
backend/family-service/src/middleware/validate.ts        → replaced by base
backend/iam-service/src/middleware/errorHandler.ts       → replaced by base
backend/email-service/src/middleware/errorHandler.ts     → replaced by base
backend/programme-service/src/middleware/errorHandler.ts → replaced by base
```

---

## 5. LOGGING REQUIREMENTS

### Every Request Must Log:

```json
{
  "timestamp": "2026-02-27T10:30:00.000Z",
  "level": "info",
  "service": "family-service",
  "requestId": "abc-123-def",
  "method": "POST",
  "path": "/api/v1/families",
  "userId": "user-uuid",
  "statusCode": 201,
  "durationMs": 45,
  "message": "Request completed"
}
```

### Every Error Must Log:

```json
{
  "timestamp": "2026-02-27T10:30:00.000Z",
  "level": "error",
  "service": "family-service",
  "requestId": "abc-123-def",
  "method": "POST",
  "path": "/api/v1/families",
  "userId": "user-uuid",
  "error": "Duplicate family_id",
  "code": "CONFLICT",
  "statusCode": 409,
  "stack": "...(dev only)...",
  "message": "Request failed"
}
```

### Every Validation Failure Must Log:

```json
{
  "timestamp": "2026-02-27T10:30:00.000Z",
  "level": "warn",
  "service": "family-service",
  "requestId": "abc-123-def",
  "method": "POST",
  "path": "/api/v1/members",
  "statusCode": 422,
  "validationErrors": [
    { "field": "first_name", "message": "Required" },
    { "field": "date_of_birth", "message": "Invalid date" }
  ],
  "message": "Validation failed"
}
```

### PII Fields to Always Mask:
```
password, new_password, otp, otp_code, otp_hash, token, access_token, 
refresh_token, api_key, secret, mfa_secret, authorization, cookie, 
national_id, national_id_hash, client_secret, pin, credential, private_key
```

---

## 6. RATE LIMITING CONFIGURATION

| Endpoint Pattern | Max Requests | Window | Key |
|---|---|---|---|
| `POST /api/v1/auth/login` | 10 | 15 min | IP |
| `POST /iam/keycloak/login` | 10 | 15 min | IP |
| `POST /iam/otp-login/request` | 5 | 15 min | IP |
| `POST /iam/password-reset/*` | 5 | 15 min | IP |
| `POST /api/v1/registration/family` | 30 | 1 min | IP |
| `POST /api/v1/upload/*` | 10 | 1 min | IP |
| `GET /api/v1/*` | 200 | 1 min | IP |
| `POST/PATCH/DELETE /api/v1/*` | 60 | 1 min | IP |
| `POST /email/*` | 50 | 1 min | IP |
| `POST /api/v1/registration/*/members/bulk` | 5 | 10 min | IP |

---

## 7. VALIDATION REQUIREMENTS — FULL ENDPOINT COVERAGE

**Goal: 100% validation coverage on ALL endpoints that accept input.**

### 7.1 family-service — Feature Routes (Currently 8 validated → target: all validated)

| Method | Endpoint | Zod Schema | Status |
|---|---|---|---|
| POST | `/api/v1/families` | `CreateFamilySchema` | ✅ Exists → wire via middleware |
| PATCH | `/api/v1/families/:id` | `UpdateFamilySchema` | ✅ Exists → wire via middleware |
| POST | `/api/v1/members` | `CreateMemberSchema` | ✅ Exists → wire via middleware |
| PATCH | `/api/v1/members/:id` | `UpdateMemberSchema` | ✅ Exists → wire via middleware |
| POST | `/api/v1/addresses` | `CreateAddressSchema` | ✅ Exists → wire via middleware |
| PATCH | `/api/v1/addresses/:id` | `UpdateAddressSchema` | ✅ Exists → wire via middleware |
| POST | `/api/v1/documents` | `CreateDocumentSchema` | ✅ Exists → wire via middleware |
| POST | `/api/v1/documents/:id/verify` | `VerifyDocumentSchema` | ✅ Exists → wire via middleware |
| POST | `/api/v1/families/:id/submit` | `FamilySubmitParamsSchema` | ❌ NEW — validate params |
| POST | `/api/v1/families/:id/reject` | `FamilyRejectSchema` | ❌ NEW — `{ reason: z.string().min(1) }` |
| POST | `/api/v1/upload/sql` | `RawSqlSchema` | ❌ NEW — critical security gap |
| GET | `/api/v1/families` | `PaginationSchema` (query) | ❌ NEW — validate pagination |
| GET | `/api/v1/members` | `PaginationSchema` (query) | ❌ NEW — validate pagination |
| GET | `/api/v1/citizens/search` | `CitizenSearchSchema` (query) | ❌ NEW — validate search |

### 7.2 family-service — Registration Routes (Currently 0/28 validated → target: all validated)

| Method | Endpoint | Zod Schema | Status |
|---|---|---|---|
| POST | `/registration/family` | `RegistrationFamilyCreateSchema` | ❌ NEW |
| PUT | `/registration/:id/step/:step` | `RegistrationStepUpdateSchema` | ❌ NEW |
| PUT | `/registration/:id/household` | `RegistrationHouseholdSchema` | ❌ NEW |
| PUT | `/registration/:id/income` | `RegistrationIncomeSchema` | ❌ NEW |
| POST | `/registration/:id/address` | `RegistrationAddressCreateSchema` | ❌ NEW |
| POST | `/registration/:id/documents` | `RegistrationDocumentCreateSchema` | ❌ NEW |
| POST | `/registration/:id/members` | `RegistrationMemberCreateSchema` | ❌ NEW |
| POST | `/registration/:id/members/:mid/address` | `RegistrationMemberAddressSchema` | ❌ NEW |
| POST | `/registration/:id/members/:mid/documents` | `RegistrationMemberDocumentSchema` | ❌ NEW |
| POST | `/registration/:id/submit` | `RegistrationSubmitSchema` | ❌ NEW |
| POST | `/registration/:id/members/bulk` | `RegistrationBulkMemberSchema` | ❌ NEW — array validation |
| PUT | `/registration/:id/codes` | `RegistrationCodesSchema` | ❌ NEW |
| PUT | `/registration/:id/housing` | `RegistrationHousingSchema` | ❌ NEW |
| PATCH | `/registration/:id/members/:mid` | `RegistrationMemberUpdateSchema` | ❌ NEW |
| DELETE | `/registration/:id/members/:mid` | Params only | ❌ NEW |

### 7.3 iam-service (Currently 9 validated → target: all validated)

| Method | Endpoint | Zod Schema | Status |
|---|---|---|---|
| POST | `/iam/password-reset/request` | `PasswordResetRequestSchema` | ✅ Exists |
| POST | `/iam/password-reset/confirm` | `PasswordResetConfirmSchema` | ✅ Exists |
| POST | `/iam/password-reset/verify` | `PasswordResetVerifySchema` | ✅ Exists |
| POST | `/iam/invite` | `InviteSchema` | ✅ Exists |
| POST | `/iam/mfa/enable` | `MfaEnableSchema` | ✅ Exists |
| POST | `/iam/otp-login/request` | `OtpLoginSchema` | ✅ Exists |
| POST | `/iam/keycloak/login` | `KeycloakLoginSchema` | ❌ NEW |
| POST | `/admin/users` | `CreateUserSchema` | ❌ NEW |
| PATCH | `/admin/users/:id` | `UpdateUserSchema` | ❌ NEW |
| POST | `/admin/users/:id/roles` | `AssignRoleSchema` | ❌ NEW |
| POST | `/admin/roles` | `CreateRoleSchema` | ❌ NEW |
| PATCH | `/admin/roles/:id` | `UpdateRoleSchema` | ❌ NEW |
| POST | `/admin/roles/:id/permissions` | `AssignPermissionSchema` | ❌ NEW |
| POST | `/admin/permissions` | `CreatePermissionSchema` | ❌ NEW |
| PATCH | `/admin/permissions/:id` | `UpdatePermissionSchema` | ❌ NEW |
| POST | `/iam/worker/register` | `WorkerRegisterSchema` | ❌ NEW |
| GET | `/admin/users` | `AdminSearchSchema` (query) | ❌ NEW |
| GET | `/admin/roles` | `PaginationSchema` (query) | ❌ NEW |

### 7.4 email-service (Currently 3 validated → target: all validated)

| Method | Endpoint | Zod Schema | Status |
|---|---|---|---|
| POST | `/email/otp` | `SendOtpSchema` | ✅ Exists |
| POST | `/email/invite` | `SendInviteSchema` | ✅ Exists |
| POST | `/email/notify` | `SendNotificationSchema` | ✅ Exists |
| POST | `/provider/bounce` | `WebhookBounceSchema` | ❌ NEW |
| POST | `/provider/delivery` | `WebhookDeliverySchema` | ❌ NEW |

### 7.5 programme-service (Currently 10 inline → target: all via middleware)

| Method | Endpoint | Zod Schema | Status |
|---|---|---|---|
| POST | `/programmes` | `CreateProgrammeSchema` | ⚠️ Inline parse → move to middleware |
| PATCH | `/programmes/:id` | `UpdateProgrammeSchema` | ⚠️ Inline parse → move to middleware |
| POST | `/programmes/:id/rules` | `CreateRuleSchema` | ⚠️ Inline parse → move to middleware |
| POST | `/programmes/:id/rule-groups` | `CreateRuleGroupSchema` | ⚠️ Inline parse → move to middleware |
| POST | `/rule-groups/:id/rules` | `AddRuleToGroupSchema` | ⚠️ Inline parse → move to middleware |
| POST | `/custom-fields` | `CreateCustomFieldSchema` | ⚠️ Inline parse → move to middleware |
| PATCH | `/custom-fields/:id` | `UpdateCustomFieldSchema` | ⚠️ Inline parse → move to middleware |
| POST | `/rules/versions` | `CreateRuleVersionSchema` | ⚠️ Inline parse → move to middleware |
| POST | `/beneficiaries` | `EnrollBeneficiarySchema` | ⚠️ Inline parse → move to middleware |
| POST | `/rules` | `GlobalRuleCreateSchema` | ❌ NEW |
| POST | `/programmes/:id/managers` | `AssignManagerSchema` | ❌ NEW |
| GET | `/beneficiaries` | `BeneficiarySearchSchema` (query) | ❌ NEW |

### 7.6 Validation Error Response Format (Standard Across All Services)

```json
{
  "success": false,
  "error": {
    "code": 422,
    "message": "Validation failed",
    "details": [
      {
        "field": "first_name",
        "message": "Required",
        "code": "invalid_type",
        "target": "body"
      },
      {
        "field": "date_of_birth",
        "message": "Invalid date",
        "code": "invalid_date",
        "target": "body"
      }
    ]
  }
}
```

---

## 8. AUDIT LOGGING REQUIREMENTS

### What to Audit (all services):
- Every POST, PUT, PATCH, DELETE request
- Actor (from JWT): sub, email, roles
- Action: generated from HTTP method + path
- Resource: type + ID extracted from URL
- Request summary: sanitized body (sensitive fields redacted)
- Response: success/failure + error code (no full data)
- Timing: duration in ms
- IP address + User-Agent

### What NOT to Audit:
- GET requests (too noisy — unless `logGets: true` is set)
- Health checks (`/health`, `/healthz`, `/readyz`)
- Static assets

### Audit Table (use existing `audit_logs` in IAM DB, or create one per service DB):

```sql
-- DO NOT modify existing tables. Only CREATE this if it doesn't exist.
CREATE TABLE IF NOT EXISTS audit_logs (
  log_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID,
  actor_sub       VARCHAR(100),
  actor_email     VARCHAR(255),
  actor_roles     TEXT[],
  action          VARCHAR(100) NOT NULL,
  method          VARCHAR(10) NOT NULL,
  path            TEXT NOT NULL,
  resource_type   VARCHAR(50),
  resource_id     VARCHAR(100),
  status_code     INTEGER,
  ip_address      VARCHAR(50),
  user_agent      TEXT,
  request_summary JSONB,
  response_summary JSONB,
  duration_ms     INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs (actor_sub);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs (created_at DESC);
```

---

## 9. EXECUTION ORDER

```
Step 1:  Create base/applicationError.js
Step 2:  Create base/logger.js (extract from iam-service)
Step 3:  Create base/middleware/* (all 8 middleware files + index.js)
Step 4:  Update base/apiContext.js (add requestId, structured logger)
Step 5:  Update base/apiSchema.js (add validation + rateLimit support)
Step 6:  Create NEW Zod schemas for all unvalidated endpoints (~40 new schemas across all services)
Step 7:  Refactor iam-service (replace local copies with base imports, wire validation)
Step 8:  Refactor family-service (replace local copies, extend base classes, wire validation)
Step 9:  Refactor email-service (add logger, rate limiting, wire validation)
Step 10: Refactor programme-service (replace inline .parse(), wire middleware, extend base classes)
Step 11: Add Redis to family-service + programme-service for rate limiting
Step 12: Wire up audit middleware on all services
Step 13: Test every API endpoint — ensure no response shape changes
```

---

## 10. VERIFICATION CHECKLIST

### Core Infrastructure
- [ ] `base/applicationError.js` exists and is imported by all services
- [ ] `base/logger.js` exists — structured JSON logger with PII masking
- [ ] `base/middleware/` — all 8 middleware files + `index.js` re-export created
- [ ] `base/apiContext.js` enhanced with `requestId` and structured logger
- [ ] `base/apiSchema.js` enhanced with `validation` and `rateLimit` properties

### Validation
- [ ] All existing Zod schemas still work unchanged
- [ ] ~40 NEW Zod schemas created for unvalidated endpoints
- [ ] All 28 `registration.routes.ts` endpoints have Zod validation
- [ ] All 22 IAM admin endpoints have Zod validation
- [ ] All programme-service inline `.parse()` replaced with validate middleware
- [ ] Validation errors return `{ success: false, error: { code: 422, message, details[] } }`

### Logging
- [ ] All services use structured logger from `base/logger.js`
- [ ] No `console.log` statements remain (replaced with logger)
- [ ] PII is masked in all log output
- [ ] `X-Request-Id` header is propagated and logged
- [ ] Validation failures logged at `warn` level with field details

### Architecture
- [ ] All controllers extend `BaseController`
- [ ] All repositories extend `BaseSupabaseRepository` or `BaseDbRepository`
- [ ] All service-local `errorHandler.ts` / `validate.ts` / `notFound.ts` deleted (using base versions)

### Security
- [ ] Rate limiting is active on all services
- [ ] Audit logging captures all mutations
- [ ] Every POST/PUT/PATCH endpoint has Zod validation (100% coverage)
- [ ] Throttling on bulk/export endpoints

### Compatibility
- [ ] All existing API response shapes unchanged
- [ ] Frontend works without any changes
- [ ] No database table/column changes (only new `audit_logs` table if missing)
- [ ] `registration.routes.ts` still works (validation added, business logic untouched)
