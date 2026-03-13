# SPIS IAM Service — Architecture & Operations Runbook

## 1  Overview

The **IAM Service** is a standalone microservice that wraps **Keycloak** to provide SSO + MFA for the SPIS platform. It owns only identity data (credentials, MFA state, login events) and links to the Registry via a shared `registry_id` UUID. No social/profile data is stored.

| Attribute          | Value                                          |
|--------------------|-------------------------------------------------|
| Language           | TypeScript (ES 2022, NodeNext)                  |
| Runtime            | Node 20 (LTS)                                   |
| Framework          | Express 4                                        |
| Database           | PostgreSQL (`auth_db`) — direct `pg` pool        |
| IdP                | Keycloak (OIDC, RS256)                           |
| Cache              | Redis (ioredis) — user↔registry map, JWKS, rate limits |
| Message Broker     | RabbitMQ (amqplib)                               |
| Email Delivery     | Via standalone Email Service (port 3002)         |
| Port               | 3003                                             |

---

## 2  Architecture Diagram

```
         ┌──────────────────────────────┐
         │  Frontend (SPA / Portal)     │
         │  PKCE client → Keycloak      │
         └──────────┬───────────────────┘
                    │  OIDC login / token
                    ▼
         ┌──────────────────────────────┐
         │  Keycloak (IdP)              │
         │  Realm: spis-dev             │
         │  RS256 JWKS, MFA flows       │
         │  /realms/spis-dev/protocol/  │
         │   openid-connect/certs       │
         └──────────┬───────────────────┘
                    │
    ┌───────────────┼───────────────────┐
    │               │                   │
    ▼               ▼                   ▼
┌─────────┐  ┌───────────────┐  ┌──────────────┐
│ API GW  │  │ IAM Service   │  │ Family/Reg   │
│ (JWKS   │  │ port 3003     │  │ Service      │
│  verify)│  │               │  │ port 3001    │
└─────────┘  │ ┌───────────┐ │  └──────┬───────┘
             │ │ PW Reset  │ │         │
             │ │ MFA       │ │         │ events
             │ │ Invite    │ │         │
             │ └───────────┘ │         │
             └──────┬────────┘         │
                    │                  │
          ┌─────────┼──────────────────┤
          │         │                  │
          ▼         ▼                  ▼
   ┌──────────┐ ┌────────┐  ┌──────────────────┐
   │ auth_db  │ │ Redis  │  │ RabbitMQ         │
   │ (PgSQL)  │ │        │  │ spis.events      │
   └──────────┘ └────────┘  │                  │
                             │ iam.registry ←── │
                             │ registry.iam ──→ │
                             └──────────────────┘
                                      │
                                      ▼
                             ┌──────────────────┐
                             │ Email Service    │
                             │ port 3002        │
                             └──────────────────┘
```

---

## 3  Keycloak Realm Configuration

### 3.1  Realm: `spis-dev` / `spis-prod`

| Setting              | Value                          |
|----------------------|--------------------------------|
| Login theme          | default (customizable)         |
| Token signing        | RS256                          |
| Access token TTL     | 5 minutes                      |
| Refresh token TTL    | 30 minutes                     |
| SSO session idle     | 30 minutes                     |
| Password policy      | Argon2, min 12 chars, block leaked |

### 3.2  Clients

| Client ID    | Type          | Flow           | Notes                        |
|-------------|---------------|----------------|------------------------------|
| `frontend`  | Public        | Authorization Code + PKCE | SPA, redirect URIs configured |
| `backend`   | Confidential  | Client Credentials | Service-to-service           |
| `admin-cli` | Confidential  | Password Grant  | IAM service admin operations |

### 3.3  Token Claim Mappers

| Mapper Name     | Claim        | Type           | Included In         |
|-----------------|-------------|----------------|---------------------|
| registry_id     | `registry_id` | User Attribute | Access + ID Token  |
| realm roles     | `roles`     | Realm Role List | Access Token       |
| acr             | `acr`       | Hardcoded/Step-up | Access + ID Token |
| auth_time       | `auth_time` | Built-in        | ID Token           |

---

## 4  Database Schema (`auth_db`)

### 4.1  `users`

| Column               | Type            | Notes                           |
|----------------------|-----------------|----------------------------------|
| user_id              | UUID (PK)       | Auto-generated                   |
| email                | VARCHAR(255)    | Login identifier, UNIQUE         |
| mfa_enabled          | BOOLEAN         | Whether MFA is active            |
| mfa_secret           | TEXT            | Encrypted TOTP secret            |
| status               | ENUM            | pending → active → locked → disabled |
| registry_id          | UUID            | FK reference to Registry (no DB FK) |
| national_id_hash     | TEXT            | SHA-256 hashed TRN               |
| failed_login_attempts| INT             | For lockout tracking             |
| locked_until         | TIMESTAMPTZ     | Account lockout expiry           |

### 4.2  `user_roles`
Composite PK: `(user_id, role_name)`. Roles: Citizen, CaseWorker, ProgrammeManager, Admin.

### 4.3  `mfa_factors`
Tracks TOTP / SMS / email factors with status (pending → active → disabled).

### 4.4  `login_events`
Audit log: user_id, ip, user_agent, outcome, timestamp.

### 4.5  `password_reset_tokens`
Hashed OTP codes with expiry, attempt count, and max attempts.

---

## 5  API Reference

### Password Reset

| Method | Path | Description |
|--------|------|-------------|
| POST | `/iam/password-reset/request` | Request OTP by national_id |
| POST | `/iam/password-reset/confirm` | Verify OTP + set new password |

### MFA

| Method | Path | Auth Required | Description |
|--------|------|:---:|-------------|
| POST | `/iam/mfa/totp/enroll` | ✓ | Start TOTP enrollment (returns QR) |
| POST | `/iam/mfa/totp/verify` | ✓ | Verify TOTP code, activate MFA |
| POST | `/iam/mfa/email/send`  | ✓ | Send email OTP |
| POST | `/iam/mfa/email/verify`| ✓ | Verify email OTP |

### Invite

| Method | Path | Description |
|--------|------|-------------|
| POST | `/iam/invite` | Create auth account for registry member |

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/healthz` | Liveness probe |
| GET | `/readyz`  | Readiness (DB + Redis + Keycloak) |

---

## 6  Sequence Diagrams

### 6.1  First-Time Login / Password Reset

```
Citizen          IAM API          Registry       Email Svc       Keycloak
  │                │                 │               │              │
  │ POST /pw-reset/request           │               │              │
  │  {national_id} │                 │               │              │
  │───────────────>│                 │               │              │
  │                │ GET /members/   │               │              │
  │                │  lookup?nat_id  │               │              │
  │                │────────────────>│               │              │
  │                │  {registry_id,  │               │              │
  │                │   email}        │               │              │
  │                │<────────────────│               │              │
  │                │                 │               │              │
  │                │ Create user (auth_db)           │              │
  │                │ Generate OTP, hash, store       │              │
  │                │                 │               │              │
  │                │ POST /email/otp │               │              │
  │                │────────────────────────────────>│              │
  │                │                 │               │              │
  │  200 "OTP sent"│                 │               │              │
  │<───────────────│                 │               │              │
  │                │                 │               │              │
  │ POST /pw-reset/confirm           │               │              │
  │ {national_id, otp, new_password} │               │              │
  │───────────────>│                 │               │              │
  │                │ Verify OTP hash │               │              │
  │                │ Create KC user  │               │              │
  │                │────────────────────────────────────────────────>│
  │                │ Set password    │               │              │
  │                │────────────────────────────────────────────────>│
  │                │ Activate user   │               │              │
  │  200 "Password │ set"            │               │              │
  │<───────────────│                 │               │              │
```

### 6.2  TOTP Enrollment

```
Citizen (logged in)    IAM API              auth_db
  │                      │                    │
  │ POST /mfa/totp/enroll│                    │
  │─────────────────────>│                    │
  │                      │ Generate secret    │
  │                      │ Store pending      │
  │                      │───────────────────>│
  │  {qr_code, secret}  │                    │
  │<─────────────────────│                    │
  │                      │                    │
  │ POST /mfa/totp/verify│                    │
  │ {code: "123456"}     │                    │
  │─────────────────────>│                    │
  │                      │ Validate TOTP      │
  │                      │ Activate factor    │
  │                      │───────────────────>│
  │  200 "MFA enabled"  │                    │
  │<─────────────────────│                    │
```

### 6.3  Invitation Flow (Registry-Driven)

```
Registry Service       RabbitMQ            IAM Worker         Email Svc     Keycloak
  │                      │                    │                 │              │
  │ publish              │                    │                 │              │
  │ CREATE_AUTH_ACCOUNT  │                    │                 │              │
  │─────────────────────>│                    │                 │              │
  │                      │ deliver to         │                 │              │
  │                      │ iam.registry       │                 │              │
  │                      │───────────────────>│                 │              │
  │                      │                    │ Create IAM user │              │
  │                      │                    │ Create KC user  │              │
  │                      │                    │────────────────────────────────>│
  │                      │                    │ Send invite     │              │
  │                      │                    │────────────────>│              │
  │                      │                    │                 │              │
  │                      │ AUTH_ACCOUNT_      │                 │              │
  │                      │ CREATED            │                 │              │
  │                      │<───────────────────│                 │              │
```

---

## 7  RabbitMQ Topology

| Exchange       | Type  | Durable |
|---------------|-------|---------|
| `spis.events` | topic | ✓       |

### Queues

| Queue            | Binding Keys                                      |
|------------------|--------------------------------------------------|
| `iam.registry`   | `registry.events.CREATE_AUTH_ACCOUNT`             |
|                  | `registry.events.USER_CONTACT_UPDATED`            |
|                  | `registry.events.USER_DELETED`                    |

### Outbound Routing Keys

| Key                                | Payload Example                                    |
|------------------------------------|----------------------------------------------------|
| `iam.events.AUTH_ACCOUNT_CREATED`  | `{ user_id, registry_id, email }`                  |
| `iam.events.PASSWORD_RESET_REQUESTED` | `{ user_id, registry_id, channel, otp_id }`    |
| `iam.events.MFA_ENABLED`          | `{ user_id, factor_type, timestamp }`              |

---

## 8  Redis Key Schema

| Key Pattern                    | Value       | TTL    | Purpose                      |
|-------------------------------|-------------|--------|------------------------------|
| `spis:iam:user:reg:{user_id}` | registry_id | 24h    | user → registry mapping      |
| `spis:iam:reg:user:{reg_id}`  | user_id     | 24h    | registry → user mapping      |
| `spis:iam:jwks`               | JSON string | 15m    | JWKS public keys cache       |
| `spis:iam:rl:{prefix}:{key}`  | count (int) | varies | Rate limit sliding window    |

---

## 9  Gateway JWKS Validation

1. **Fetch** JWKS from `/realms/spis-dev/protocol/openid-connect/certs`
2. **Cache** in Redis (TTL 15m) + in-memory
3. **Pin** `kid` → public key
4. **Validate** JWT: signature (RS256), `exp`, `iss`, `aud`, `acr`
5. On **kid mismatch** → refetch JWKS (key rotation)
6. **Reject** if `acr` < required level for the route
7. Attach `registry_id` from token claims (or Redis fallback) for downstream

---

## 10  Security Rules

| Rule                     | Implementation                                    |
|--------------------------|---------------------------------------------------|
| Password hashing         | Argon2 (Keycloak-managed), SHA-256 in auth_db     |
| National ID storage      | SHA-256 hash only — never raw                     |
| OTP storage              | SHA-256 hash, 10m expiry, 5 max attempts          |
| PII logging              | Structured logger masks emails, OTPs, secrets     |
| Account lockout          | 5 failed attempts → 15m lock, exponential backoff |
| MFA enforcement          | TOTP default, email OTP fallback, acr in token    |
| Session revocation       | On password reset + user deletion                 |
| Key rotation             | Quarterly; dual keys during rollover              |
| Rate limiting            | Redis INCR+EXPIRE per endpoint per IP/user        |

---

## 11  Degraded Mode (Email Service Down)

| Scenario              | Behavior                                         |
|-----------------------|--------------------------------------------------|
| Password reset request| Return 503 + Retry-After header                  |
| Invite creation       | Account created but invite not sent; log alert    |
| MFA email OTP         | Return 503 + Retry-After header                  |
| Normal login          | **Not blocked** — users with password+MFA can still login via Keycloak directly |
| `email.failed` events | Surfaced to UI via error notification             |

---

## 12  Operations

### 12.1  Running Locally

```bash
# Prerequisites: PostgreSQL, Redis, RabbitMQ, Keycloak running
cp .env.example .env      # fill in real values
npm install
npm run migrate            # create auth_db tables
npm run dev                # API server (tsx --watch)
npm run worker:dev         # Event consumer (tsx --watch)
```

### 12.2  Production

```bash
npm run build              # tsc → dist/
npm start                  # API server
npm run worker             # Event consumer (separate process)
```

### 12.3  Docker

```bash
docker build -t spis-iam-service .
docker run -p 3003:3003 --env-file .env spis-iam-service
```

### 12.4  Key Rotation Checklist

1. Generate new realm key pair in Keycloak Admin Console
2. Keep old key active for rollover period (1 week minimum)
3. Gateway will auto-detect via kid mismatch → JWKS refetch
4. After rollover, disable old key
5. Verify no 401s in gateway logs

---

## 13  File Structure

```
iam-service/
├── .env.example
├── .gitignore
├── Dockerfile
├── package.json
├── tsconfig.json
├── IAM_ARCHITECTURE_RUNBOOK.md  ← this file
└── src/
    ├── index.ts                — Express API entry point
    ├── worker.ts               — Event worker entry point
    ├── config.ts               — Environment config
    ├── types.ts                — All TypeScript types
    ├── bus/
    │   └── rabbitmq.ts         — RabbitMQ connection + pub/sub
    ├── db/
    │   ├── pool.ts             — PostgreSQL pool
    │   ├── migrate.ts          — Schema + enum creation
    │   └── repository.ts       — Data access layer
    ├── lib/
    │   ├── logger.ts           — Structured JSON logger + PII masking
    │   ├── crypto.ts           — OTP generation, hashing, TOTP secrets
    │   ├── redis.ts            — Redis client + cache helpers
    │   ├── jwks.ts             — JWKS fetcher + JWT validation
    │   ├── emailClient.ts      — HTTP client to Email Service
    │   ├── registryClient.ts   — HTTP client to Registry Service
    │   └── keycloakAdmin.ts    — Keycloak Admin REST API wrapper
    ├── middleware/
    │   ├── errorHandler.ts     — Error classes + Express handler
    │   ├── validate.ts         — Zod validation middleware
    │   ├── auth.ts             — JWT auth + role + MFA middleware
    │   └── rateLimiter.ts      — Redis-based rate limiting
    ├── routes/
    │   ├── passwordReset.routes.ts
    │   ├── mfa.routes.ts
    │   ├── invite.routes.ts
    │   └── health.routes.ts
    ├── services/
    │   ├── passwordReset.ts    — Password reset flow
    │   ├── mfa.ts              — TOTP + email OTP
    │   ├── invite.ts           — Account creation from registry
    │   └── eventHandlers.ts    — Registry event consumer
    └── validators/
        └── schemas.ts          — Zod request schemas
```
