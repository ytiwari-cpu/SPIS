# SPIS Email Service — Architecture & Operations Runbook

## 1  Overview

The **Email Service** is a standalone micro-service responsible for all outbound
email from the SPIS platform.  It exposes a small REST API for sending OTP codes,
invitations, and generic notifications, and uses an asynchronous queue (RabbitMQ)
to decouple request acceptance from actual delivery.

| Attribute        | Value                              |
|------------------|------------------------------------|
| Language         | TypeScript (ES 2022, NodeNext)     |
| Runtime          | Node 20 (LTS)                      |
| Framework        | Express 4                          |
| Database         | PostgreSQL (own `email_db`)        |
| Message Broker   | RabbitMQ (amqplib)                 |
| Primary Provider | SendGrid (`@sendgrid/mail`)        |
| Fallback         | SMTP (Nodemailer)                  |
| Port             | 3002                               |

---

## 2  Architecture Diagram (Conceptual)

```
                ┌───────────────────────────┐
                │   IAM / Family Service    │
                └───────────┬───────────────┘
                            │ HTTP POST /email/*
                            ▼
               ┌─────────────────────────────┐
               │   Email Service  (API)      │
               │   Express · port 3002       │
               │                             │
               │ ┌─────────┐ ┌─────────────┐ │
               │ │ Rate    │ │ Idempotency │ │
               │ │ Limiter │ │ (DB dedup)  │ │
               │ └─────────┘ └─────────────┘ │
               └──────────┬──────────────────┘
                          │ publish(email.send)
                          ▼
               ┌───────────────────────┐
               │   RabbitMQ Exchange   │
               │   spis.events (topic) │
               └──────┬───────────┬────┘
                      │           │
         ┌────────────┘           └───────────────┐
         ▼                                        ▼
 ┌───────────────┐                     ┌──────────────────┐
 │ email.send    │                     │ email.sent.audit  │
 │ (Queue)       │                     │ email.failed.alerts│
 └───────┬───────┘                     └──────────────────┘
         │ consume
         ▼
 ┌───────────────────────────────────────┐
 │  Email Worker (separate process)      │
 │                                       │
 │  1. Render Handlebars template        │
 │  2. sendWithFallback()                │
 │     ┌──────────┐   ┌──────────┐      │
 │     │ SendGrid │──▶│  SMTP    │      │
 │     │ primary  │   │ fallback │      │
 │     └──────────┘   └──────────┘      │
 │  3. Circuit breaker failover          │
 │  4. Exponential-backoff retries       │
 └───────────────────────────────────────┘
         │
         ▼
 ┌──────────────────┐
 │  PostgreSQL      │
 │  email_db        │
 │  ┌─────────────┐ │
 │  │email_requests│ │
 │  │email_providers││
 │  │bounce_feedback││
 │  │rate_limits   │ │
 │  │template_vers.│ │
 │  └─────────────┘ │
 └──────────────────┘
```

---

## 3  Database Schema

### 3.1  `email_requests`
Primary audit & tracking table.

| Column         | Type                  | Notes                      |
|----------------|-----------------------|----------------------------|
| id             | uuid (PK)             | auto-generated             |
| request_id     | varchar(255) UNIQUE   | idempotency key            |
| to_email       | varchar(255)          | recipient                  |
| template_code  | varchar(100)          | e.g. `iam_otp`             |
| purpose        | enum                  | `otp`, `invite`, `notify`… |
| variables      | jsonb                 | Handlebars merge vars      |
| locale         | varchar(10)           | default `en`               |
| status         | enum                  | queued→processing→sent/failed/bounced |
| provider_used  | varchar(50)           | sendgrid / smtp            |
| sent_at        | timestamptz           | populated on send          |
| last_error     | text                  | latest error message       |
| created_at     | timestamptz           | insertion time             |
| updated_at     | timestamptz           | last status change         |

### 3.2  `email_providers`
Tracks provider health for circuit-breaker pattern.

### 3.3  `bounce_feedback`
Stores SendGrid webhook bounce/spam events for compliance.

### 3.4  `rate_limits`
Sliding-window counters per email+purpose, checked before queueing.

### 3.5  `template_versions`
Versioned, locale-aware Handlebars templates stored in the DB.

---

## 4  API Reference

### `POST /email/otp`
Send a one-time password email.

```jsonc
// Request
{ "to_email": "user@example.com", "otp_code": "123456" }
// Optionally: "locale", "request_id"

// Response  202 Accepted
{ "request_id": "uuid", "status": "queued" }
```

Rate limit: **5 per email per hour**.

### `POST /email/invite`
Send a family-registration invitation.

```jsonc
{
  "to_email": "user@example.com",
  "family_name": "Smith",
  "invite_link": "https://portal.spis.gov.jm/invite/abc"
}
```

Rate limit: **3 per email per day**.

### `POST /email/notify`
Generic notification (password reset, status change, etc.).

```jsonc
{
  "to_email": "user@example.com",
  "template_code": "password_reset",
  "variables": { "name": "Jane", "reset_link": "…" }
}
```

### `GET /healthz`
Liveness probe — always returns `200 { status: "ok" }`.

### `GET /readyz`
Readiness probe — checks DB and provider health.

### `POST /events/provider/bounce`
SendGrid signed-event webhook for bounces & spam complaints.

### `POST /events/provider/delivery`
SendGrid delivery confirmation webhook.

---

## 5  Queue Topology

| Exchange        | Type  | Durable |
|-----------------|-------|---------|
| `spis.events`   | topic | ✓       |

| Queue                 | Routing Key     | Purpose                       |
|-----------------------|-----------------|-------------------------------|
| `email.send`          | `email.send`    | Worker picks up & sends       |
| `email.sent.audit`    | `email.sent`    | Audit/logging consumers       |
| `email.failed.alerts` | `email.failed`  | Alerting, dashboards          |

### Retry Strategy

Failed sends are retried with **exponential backoff**:

```
delay = RETRY_BASE_DELAY_MS × 2^(attempt − 1)
```

Default: 3 max attempts → delays of 1 s, 2 s, 4 s.
After all attempts, an `email.failed` event is published.

---

## 6  Circuit Breaker

Each provider row in `email_providers` tracks:

- `consecutive_failures` — incremented on error, reset on success
- `last_failure_at` — used for cooldown

**Failover logic (provider selector):**

1. Attempt primary provider (SendGrid).  
2. If circuit is *open* (failures ≥ threshold AND still within cooldown), skip.  
3. On success → reset `consecutive_failures` to 0.  
4. On failure → increment, try next provider.  
5. If **all** providers are open → throw `ServiceUnavailableError`.

Defaults: threshold = **5**, cooldown = **60 s**.

---

## 7  Template System

- Templates stored in `template_versions` table (DB-managed, not files).
- Renderer loads the latest active version for a given `template_code + locale`.
- Compiled Handlebars templates are cached in-memory for performance.
- Fallback: if no locale-specific template exists, falls back to `en`.
- Seeded templates: `iam_otp`, `invite`, `notification`, `password_reset`.

---

## 8  Security

| Layer                | Mechanism                                 |
|----------------------|-------------------------------------------|
| Transport            | TLS (reverse proxy / load-balancer)       |
| Auth (API callers)   | Internal network only / API key header    |
| PII logging          | Structured logger masks emails, OTP, keys |
| Webhook verification | SendGrid signature header validation      |
| Input validation     | Zod schemas on every endpoint             |
| Rate limiting        | DB-backed sliding window per purpose      |

---

## 9  Operations

### 9.1  Running Locally

```bash
# Prerequisites: PostgreSQL, RabbitMQ running locally
cp .env.example .env       # fill in real values
npm install
npm run migrate            # create tables + seed data
npm run dev                # API server (tsx --watch)
npm run worker:dev         # Queue consumer (tsx --watch)
```

### 9.2  Production

```bash
npm run build              # tsc → dist/
npm start                  # API server
npm run worker             # Queue consumer (separate process)
```

### 9.3  Docker

```bash
docker build -t spis-email-service .
docker run -p 3002:3002 --env-file .env spis-email-service
```

### 9.4  Health Checks

| Probe     | Endpoint   | What it checks              |
|-----------|------------|------------------------------|
| Liveness  | `/healthz` | Process is alive             |
| Readiness | `/readyz`  | DB connection + provider ok  |

### 9.5  Environment Variables

See [`.env.example`](.env.example) for the full list.  
Key variables:

| Variable                    | Required | Default                           |
|-----------------------------|----------|-----------------------------------|
| `PORT`                      | No       | `3002`                            |
| `DATABASE_URL`              | Yes*     | `postgresql://…/email_db`         |
| `RABBITMQ_URL`              | Yes*     | `amqp://guest:guest@localhost`    |
| `SENDGRID_API_KEY`          | Yes      | —                                 |
| `SENDGRID_FROM_EMAIL`       | No       | `noreply@spis.gov.jm`            |
| `SMTP_HOST` / `SMTP_USER`…  | For SMTP | —                                 |
| `MAX_SEND_ATTEMPTS`         | No       | `3`                               |
| `RETRY_BASE_DELAY_MS`       | No       | `1000`                            |
| `LOG_LEVEL`                 | No       | `debug`                           |

\* Defaults provided for local dev; must be set in staging/production.

### 9.6  Database Migrations

```bash
npm run migrate   # runs src/db/migrate.ts — idempotent (IF NOT EXISTS)
```

The migration script also creates two housekeeping PL/pgSQL functions:
- `cleanup_expired_rate_limits()` — removes stale sliding-window rows
- `purge_old_payloads(days)` — nullifies `variables` column after retention period

Schedule these with `pg_cron` or an external scheduler.

### 9.7  Monitoring Checklist

- [ ] `email.send` queue depth (RabbitMQ Management UI)
- [ ] `email.failed.alerts` consumer → PagerDuty / Slack
- [ ] `email_requests` status distribution (Grafana / SQL dashboard)
- [ ] Provider circuit-breaker state (`email_providers.status`)
- [ ] Bounce rate from `bounce_feedback` table
- [ ] Rate-limit hits (structured logs, `rateLimitExceeded`)

---

## 10  File Structure

```
email-service/
├── .env.example
├── .gitignore
├── Dockerfile
├── package.json
├── tsconfig.json
├── ARCHITECTURE.md          ← this file
└── src/
    ├── index.ts             — Express API entry point
    ├── worker.ts            — Queue worker entry point
    ├── config.ts            — Environment-based config
    ├── types.ts             — All TypeScript types
    ├── bus/
    │   └── rabbitmq.ts      — RabbitMQ connection, publish, consume
    ├── db/
    │   ├── pool.ts          — pg Pool
    │   ├── migrate.ts       — Schema + seed migration
    │   └── repository.ts    — Data-access layer
    ├── lib/
    │   └── logger.ts        — Structured JSON logger with PII masking
    ├── middleware/
    │   ├── errorHandler.ts  — Error classes + Express handler
    │   └── validate.ts      — Zod validation middleware
    ├── providers/
    │   ├── sendgrid.ts      — SendGrid adapter
    │   ├── smtp.ts          — SMTP/Nodemailer adapter
    │   └── selector.ts      — Provider selector + circuit breaker
    ├── routes/
    │   ├── email.routes.ts  — POST /email/otp|invite|notify
    │   └── health.routes.ts — GET /healthz|readyz, webhooks
    ├── services/
    │   ├── rateLimiter.ts   — Rate-limit enforcement
    │   ├── templateRenderer.ts — Handlebars rendering
    │   └── worker.ts        — Queue message processor
    └── validators/
        └── schemas.ts       — Zod request schemas
```
