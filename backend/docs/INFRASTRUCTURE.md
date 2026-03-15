# SPIS Backend — Infrastructure Documentation

## Architecture Overview

The SPIS backend consists of 4 independent microservices sharing a common `base/` library:

| Service | Port | Purpose |
|---------|------|---------|
| **iam-service** | 3003 | Authentication, authorization, RBAC |
| **family-service** | 3001 | Family registration, members, documents |
| **email-service** | 3002 | Email delivery (OTP, invite, notifications) |
| **programme-service** | 3004 | Social programmes, rules engine, beneficiaries |

## Middleware Execution Order

Every request passes through the following middleware chain (in order):

| # | Middleware | File | Purpose |
|---|-----------|------|---------|
| 0 | Helmet | `npm:helmet` | Security headers (CSP, HSTS, X-Frame) |
| 1 | Request ID | `base/middleware/requestId.js` | UUID per request, sets `X-Request-ID` |
| 2 | Compression | `npm:compression` | Gzip (threshold 1KB, level 6) |
| 3 | Request Timeout | `base/middleware/requestTimeout.js` | 30s hard limit → 503 |
| 4 | Load Shedder | `base/middleware/loadShedder.js` | In-flight counter → 503 |
| 5 | WAF | `base/middleware/waf.js` | Bot block, SQLi, null bytes, content-type |
| 6 | Rate Limiter | `base/middleware/rateLimiter.js` | Write 60/min, Read 120/min (Redis-backed) |
| 7 | Request Logger | `base/middleware/requestLogger.js` | Structured JSON logging |
| 8 | CORS | `npm:cors` | Origin whitelist |
| 9 | Body Parsing | `express.json/urlencoded` | 1MB limit |
| 10 | Audit Log | Per-service | Write mutations to audit trail |

### Per-Route Middleware (via `apiSchema.js`)

| # | Middleware | Trigger | Purpose |
|---|-----------|---------|---------|
| A | Schema Attach | Always | Sets `req.requestSchema` + `req.responseSchema` |
| B | Cache Headers | Always | `Cache-Control` + `Vary: Authorization` |
| C | Per-endpoint Rate Limit | `rateLimit:` field | Fine-grained throttle |
| D | Response Cache | `cache:` field (GET only) | Redis cache with X-Cache HIT/MISS |
| E | Auth Middleware | `middleware:` array | `requireAuth()`, `requireServiceAuth()` |
| F | File Upload | `file:` field | Multer (magic byte validation) |
| G | Permission Check | `permission:` field | RBAC permission enforcement |
| H | Request Validation | `request:` field | Zod schema validation |
| I | Controller | Always | Business logic handler |
| J | Response Validation | `response:` field | Zod response shape validation |

## Security Layers

### WAF (`base/middleware/waf.js`)

- **Bot blocking**: Rejects known scanner User-Agents (sqlmap, nikto, masscan, etc.)
- **Content-Type enforcement**: POST/PATCH/PUT must have `application/json` or `multipart/form-data`
- **Query string limit**: Rejects query strings > 2000 characters
- **SQL injection patterns**: Regex detection of common SQLi payloads → 403
- **Null byte check**: Rejects `%00` in query values → 400

### Rate Limiting (`base/middleware/rateLimiter.js`)

Global buckets (all services):
- **Write** (POST/PATCH/PUT/DELETE): 60 requests/minute per IP
- **Read** (GET): 120 requests/minute per IP

Specialized buckets (IAM):
- **loginAttempt**: Stricter limit on `/api/v1/auth`

Backing store: Redis (fail-open if Redis unavailable).

### Application-Level Rate Limits (Email Service)

DB-backed per-email/purpose quotas:
- **OTP**: 5 per email per hour
- **Invite**: 3 per email per day
- **Global**: 100 per day (free-tier guard)

## Caching

### Redis Response Cache (`base/redisCache.js` + `base/middleware/cache.js`)

- Cache-aside pattern with `X-Cache: HIT/MISS` headers
- Cache key includes user `sub` to prevent cross-user data leaks
- Only caches 2xx GET responses
- Per-endpoint TTL via `cache: { ttl, prefix }` in endpoint config

Cached endpoints:
- `GET /api/v1/families/` (60s)
- `GET /api/v1/families/:id` (120s)
- `GET /iam/admin/roles` (300s)
- `GET /iam/admin/permissions` (300s)

### Cache Headers (`base/middleware/cacheHeaders.js`)

Three policies:
- `no-store` — Default for authenticated endpoints
- `public` — Short TTL for public read endpoints
- `immutable` — Long TTL for versioned static assets

All responses include `Vary: Authorization`.

## Circuit Breaker (`base/circuitBreaker.js`)

- Uses `opossum` library
- **Timeout**: 3s per DB call
- **Error threshold**: 50%
- **Reset timeout**: 30s
- Applied via `BaseRepository` — all DB queries auto-protected
- State changes logged: OPEN → HALF-OPEN → CLOSED

## Load Shedding (`base/middleware/loadShedder.js`)

- In-memory in-flight request counter
- Default max: 200 concurrent requests (`MAX_INFLIGHT_REQUESTS`)
- Returns 503 `SERVICE_OVERLOADED` with `Retry-After: 5` when exceeded
- Skips health check endpoints (`/healthz`, `/readyz`)

## Request Timeout (`base/middleware/requestTimeout.js`)

- Configurable via `REQUEST_TIMEOUT_MS` (default: 30,000ms)
- Returns 503 `REQUEST_TIMEOUT` when exceeded
- Skips health check endpoints

## Health Checks

All services expose:
- `GET /healthz` — Liveness probe (always returns `{ status: 'ok' }`)
- `GET /readyz` — Readiness probe (checks DB, Redis where applicable)

Docker healthcheck configuration in `docker-compose.scale.yml`.

## Horizontal Scaling

### Docker Compose (`docker-compose.scale.yml`)

- 3 replicas per service
- Nginx load balancer with `least_conn`
- Health check integration
- Service isolation via Docker networking

### Nginx (`nginx/nginx.scale.conf`)

- `least_conn` upstream load balancing
- Per-service upstream blocks with `keepalive 16`
- Nginx-level rate limiting zones (general: 30r/s, auth: 5r/s)
- Security headers (X-Content-Type-Options, X-Frame-Options, etc.)
- Gzip compression at edge

## Email Worker Durable Retry

The email worker uses **DB-backed retry** instead of in-memory `setTimeout`:

1. On failure, sets `status = 'retry_pending'` with `retry_at` timestamp (exponential backoff)
2. Sweep loop runs every 30s, queries `WHERE status='retry_pending' AND retry_at <= NOW()`
3. Re-publishes pending emails to the queue with incremented attempt count
4. If process crashes, pending retries survive in the DB and are picked up on restart

Migration: `database/migrations/011_email_durable_retry.sql`

## Graceful Shutdown

All 4 services handle `SIGTERM` and `SIGINT`:

1. Stop accepting new connections (close HTTP server)
2. Close message bus connections (RabbitMQ)
3. Close Redis connections
4. Close DB connection pools
5. Exit 0

Force exit after 10s timeout to prevent hanging.

## Environment Variables

### Common (all services)

| Variable | Default | Purpose |
|----------|---------|---------|
| `NODE_ENV` | `development` | Environment mode |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed CORS origin |
| `REQUEST_TIMEOUT_MS` | `30000` | Request timeout in ms |
| `MAX_INFLIGHT_REQUESTS` | `200` | Load shedder threshold |
| `REDIS_URL` | — | Redis connection URL |

### IAM Service

| Variable | Default | Purpose |
|----------|---------|---------|
| `IAM_SERVICE_PORT` | `3003` | Listen port |
| `IAM_SUPABASE_URL` | — | IAM Supabase project URL |
| `IAM_SUPABASE_SERVICE_ROLE_KEY` | — | IAM service role key |
| `JWT_PUBLIC_KEY` | — | RS256 public key for JWT verification |
| `JWT_ISSUER` | — | Expected JWT issuer |

### Family Service

| Variable | Default | Purpose |
|----------|---------|---------|
| `FAMILY_SERVICE_PORT` | `3001` | Listen port |
| `FAMILY_SUPABASE_URL` | — | Family Supabase project URL |
| `FAMILY_SUPABASE_SERVICE_ROLE_KEY` | — | Family service role key |

### Email Service

| Variable | Default | Purpose |
|----------|---------|---------|
| `EMAIL_SERVICE_PORT` | `3002` | Listen port |
| `EMAIL_SUPABASE_URL` | — | Email Supabase project URL |
| `SMTP_HOST` | — | SMTP server host |
| `SENDGRID_API_KEY` | — | SendGrid API key |
| `RATE_LIMIT_OTP_PER_EMAIL_PER_HOUR` | `5` | OTP rate limit |
| `RATE_LIMIT_INVITE_PER_EMAIL_PER_DAY` | `3` | Invite rate limit |
| `RATE_LIMIT_GLOBAL_PER_DAY` | `100` | Global daily email limit |

### Programme Service

| Variable | Default | Purpose |
|----------|---------|---------|
| `PROGRAMME_SERVICE_PORT` | `3004` | Listen port |
| `PROGRAMME_SUPABASE_URL` | — | Programme Supabase project URL |
| `PROGRAMME_SUPABASE_SERVICE_ROLE_KEY` | — | Programme service role key |
