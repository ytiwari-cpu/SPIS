# All Authorization & Authentication Prompts — Complete History

> **Purpose:** Every prompt used to create, refactor, and fix the IAM / authentication / authorization system in SPIS.  
> **Date compiled:** February 25, 2026

---

## Table of Contents

1. [Prompt 1 — IAM Module Architecture (v1)](#prompt-1--iam-module-architecture-v1)
2. [Prompt 2 — Dual Login System (OTP + Password)](#prompt-2--dual-login-system-otp--password)
3. [Prompt 3 — Database Enum Error Fix](#prompt-3--database-enum-error-fix)
4. [Prompt 4 — Session Persistence After OTP Login](#prompt-4--session-persistence-after-otp-login)
5. [Prompt 5 — IAM Module v2 (Shared Supabase DB)](#prompt-5--iam-module-v2-shared-supabase-db)
6. [Prompt 6 — Keycloak → Supabase PostgreSQL Migration](#prompt-6--keycloak--supabase-postgresql-migration)
7. [Prompt 7 — Multi-Tab Login Sharing](#prompt-7--multi-tab-login-sharing)
8. [Prompt 8 — Every API Request Sent Twice](#prompt-8--every-api-request-sent-twice)
9. [Prompt 9 — Super Admin Dashboard with RBAC](#prompt-9--super-admin-dashboard-with-rbac)
10. [Prompt 10 — Permission-Tree VIEW Dependency Bug](#prompt-10--permission-tree-view-dependency-bug)
11. [Prompt 11 — Redis Caching & Import/Export](#prompt-11--redis-caching--importexport)
12. [Prompt 12 — DNS/Supabase Connectivity Fix (Login Broken)](#prompt-12--dnssupabase-connectivity-fix-login-broken)

---

---

## Prompt 1 — IAM Module Architecture (v1)

**Source file:** `common/iam/prompts/iam-module.prompt.md`

### Full Prompt

```
You are Opus 4.5 acting as a PRINCIPAL AUTHENTICATION ARCHITECT.

Goal: Generate the complete IAM module (Keycloak-based) that provides SSO + MFA for the 
SPIS platform while respecting strict data minimization. Deliver production-ready 
architecture, API contracts, eventing, and integration guidance with the existing 
family/registry service.

══════════════════════════════════════
1. SCOPE & ROLES
══════════════════════════════════════
- Provide SSO and MFA for Citizens (live) and future roles (CaseWorker, ProgrammeManager, Admin).
- Act as the single Identity Provider (IdP) via Keycloak (OIDC).
- Own identity data only (credentials, MFA, login state). No social/profile data is stored here.
- Integrate with Registry Service (family-service) via events and a shared UUID link.

══════════════════════════════════════
2. DATA MINIMIZATION & SPLIT
══════════════════════════════════════
- auth_db tables (owned by IAM):
  - users: user_id (UUID PK), email (login ID), password_hash, mfa_enabled, mfa_secret, 
    status, registry_id (FK reference only), national_id (TRN) hashed/enc, created_at, updated_at.
  - user_roles: user_id, role_name (Citizen|CaseWorker|ProgrammeManager|Admin), created_at.
  - mfa_factors: user_id, factor_type (totp|sms|email), secret/phone/email, status.
  - login_events: user_id, ip, ua, outcome, created_at.
  - password_reset_tokens: user_id, otp_code (hashed), expires_at, attempt_count.
- registry_db (owned by Registry) holds members/households; never store passwords or MFA.
- Link is registry_id (UUID) carried in both systems; national_id (TRN) may be used for 
  lookup but not as the linkage key.

══════════════════════════════════════
3. KEYCLOAK REALM & CLIENTS
══════════════════════════════════════
- Realm: spis-prod (and spis-dev) — align aliases if an existing realm is already provisioned.
- Clients: frontend (public PKCE), backend (confidential), api-gateway (resource server).
- Signing: RS256; JWKS endpoint (e.g., /realms/spis-dev/protocol/openid-connect/certs) 
  fetched and cached by gateway; rotate keys with rollover.
- Token claims: sub=user_id, registry_id, roles, acr (mfa level), auth_time; ensure client 
  mappers emit these in access tokens.
- Client mappers (examples):
  - registry_id → claim registry_id (String, included in access/ID token)
  - role list → realm roles mapper to roles[]
  - acr → hardcoded "loa2" after MFA or step-up logic via auth flow
  - auth_time → built-in
- Password policy: Argon2-hashed secrets, min length 12, block leaked passwords list, 
  max lifetime 365 days.
- Enforce MFA (step-up) for sensitive actions; acr reflects completion.

══════════════════════════════════════
4. FLOWS
══════════════════════════════════════
A) First-time login / Password Reset (Citizen)
- User provides national_id + clicks "Reset password".
- IAM checks national_id in registry via async query/lookup API; if found & approved 
  → send OTP via Email Service; store hashed OTP in password_reset_tokens.
- User submits OTP + new password (OTP TTL 10m, 5 attempts) → verify OTP → set password 
  in Keycloak, enable TOTP enrollment step on next login.
- On success, create users record with registry_id link and national_id hash.
- If national_id not found → return 404 and trigger UI toast.

B) Direct login (has password)
- Standard OIDC login at Keycloak; MFA enforced if mfa_enabled or acr policy.

C) Invitation flow (Registry-driven)
- Registry emits event: CREATE_AUTH_ACCOUNT {registry_id, email, national_id_hash}.
- IAM API consumes → creates user, sends invite/OTP via Email Service.

D) Profile updates & deletion
- Registry emits USER_CONTACT_UPDATED {registry_id, email?, phone?} → IAM updates contact 
  info used for MFA delivery (no social data).
- Registry emits USER_DELETED {registry_id} → IAM disables user, revokes sessions, 
  anonymizes PII if policy requires.

E) Degraded mode (Email down)
- OTP/reset/invite endpoints return 503 with retry-after when Email Service is unavailable; 
  do not block standard login for users who already have password+MFA.
- Surface email.failed events to UI for user-facing feedback; log and alert.

══════════════════════════════════════
5. API SURFACE (IAM SERVICE WRAPPER AROUND KEYCLOAK)
══════════════════════════════════════
- POST /iam/password-reset/request {national_id}: validate against registry, create otp 
  token, send OTP.
- POST /iam/password-reset/confirm {national_id, otp, new_password}: verify OTP, set 
  password, mark user active, require MFA setup.
- POST /iam/invite {registry_id, email, national_id_hash}: create account, send invite OTP.
- POST /iam/mfa/totp/enroll → return provisioning URI/QR; 
  POST /iam/mfa/totp/verify {code} → enable.
- POST /iam/mfa/email/send {purpose} → send OTP via Email Service; 
  POST /iam/mfa/email/verify {code}.
- GET /.well-known/jwks.json (Keycloak native) for gateways.

══════════════════════════════════════
6. EVENTING & CACHING
══════════════════════════════════════
- Message bus: RabbitMQ (exchange: spis.events, type=topic).
  - Bindings:
    - queue iam.registry → routing keys registry.events.USER_CONTACT_UPDATED, 
      registry.events.USER_DELETED, registry.events.CREATE_AUTH_ACCOUNT
    - queue registry.iam → routing keys iam.events.AUTH_ACCOUNT_CREATED, 
      iam.events.PASSWORD_RESET_REQUESTED, iam.events.MFA_ENABLED
  - Event payloads (examples):
    - CREATE_AUTH_ACCOUNT {registry_id, email, national_id_hash}
    - PASSWORD_RESET_REQUESTED {user_id, registry_id, channel=email, otp_id}
    - MFA_ENABLED {user_id, factor_type, timestamp}
- Cache: Redis maps user_id ↔ registry_id for gateway routing; TTL 24h with refresh on 
  login; store JWKS public keys with short TTL and watch kid for rollover.

══════════════════════════════════════
7. GATEWAY VALIDATION
══════════════════════════════════════
- Gateway fetches JWKS once, caches keys; validates JWT signature, exp, iss, aud, acr 
  locally (no DB call).
- Steps: fetch JWKS (cache 15m), pin kid→pubkey, validate signature/exp/iss/aud/acr 
  locally; on kid mismatch, refetch JWKS; reject if acr < required.
- Authorize routes by roles and acr; attach registry_id from token/Redis for downstream 
  services; fall back to Redis cache on token mapping miss.

══════════════════════════════════════
8. SECURITY RULES
══════════════════════════════════════
- Hash national_id when stored in IAM; never log raw identifiers.
- Passwords hashed with Argon2; OTP codes stored hashed with short expiry and attempt throttling.
- Enforce device/session revocation on password reset and user deletion.
- Audit all auth events to login_events.
- Account lockout: 5 failed login attempts → 15m lock; exponential backoff for 
  password-reset OTP verification.
- MFA: TOTP default, email OTP fallback; acr reflects factor strength; require step-up 
  for sensitive APIs.
- Key rotation: rotate realm keys quarterly; maintain dual keys during rollover; ensure 
  gateway tracks kid.

══════════════════════════════════════
9. DELIVERABLES ORDER
══════════════════════════════════════
1) High-level architecture (Keycloak + IAM wrapper + Email Service + Registry + Gateway + Redis + Bus).
2) Keycloak realm/client config (flows, MFA policy, claims mapping).
3) DB schema (auth_db) and migration scripts.
4) REST + event contracts for the flows above.
5) Sequence diagrams for first login, OTP reset, MFA enrollment, invitation, contact update, deletion.
6) Caching strategy and JWKS validation steps.
7) Operational runbook: rotation of keys/secrets, rate limits, lockout policy, logging/metrics.
8) RabbitMQ topology (exchange, queues, bindings) and sample payloads; Redis key schema.
9) Degraded-mode behavior when Email Service is unavailable.

══════════════════════════════════════
10. STRICT CONSTRAINTS
══════════════════════════════════════
- Do NOT store registry profile data in auth_db beyond registry_id, email, national_id hash, 
  and MFA delivery contacts.
- Do NOT redesign the existing registry schema.
- All OTP/MFA interactions must go through the standalone Email Service (or SMS provider 
  if added later).
- Keep IAM deployable independently from the family-service.
```

### Outcome
✅ Full IAM service scaffold created with Keycloak integration, all API endpoints, eventing, and security rules.

---

---

## Prompt 2 — Dual Login System (OTP + Password)

### Exact Prompt Given

> "Now I want that there should be two types of login - one with OTP and other with password. For OTP login, first search in users table, if not found then search in family_member table. If found in family_member, automatically create user account and send OTP."

### Additional Specifications Given

> - Search users table first
> - If not found, search family_member table via Registry service
> - Auto-create user with 'pending' status if found in family_member
> - Generate 6-digit OTP
> - Send OTP via email
> - Activate user on successful OTP verification
> - Password reset should only check users table (different behavior)

### Outcome
✅ Created `POST /iam/otp-login/request` and `POST /iam/otp-login/verify`. Frontend login page updated with OTP/Password toggle.

---

---

## Prompt 3 — Database Enum Error Fix

### Exact Prompt Given

> "I got this error in response when I tried to login with the OTP"
>
> ```json
> { "error": "invalid input value for enum otp_purpose: \"otp_login\"" }
> ```

### Outcome
✅ Migration 011 created:
```sql
ALTER TYPE otp_purpose ADD VALUE IF NOT EXISTS 'worker_registration';
ALTER TYPE otp_purpose ADD VALUE IF NOT EXISTS 'otp_login';
```

---

---

## Prompt 4 — Session Persistence After OTP Login

### Exact Prompt Given

> "When I login with the OTP then it takes to dashboard for the fraction of the second and then returns back to the login page"

### Root Cause Found
- OTP verify returned 200 OK ✅
- JWT token stored ✅
- Dashboard loaded briefly ✅
- `/auth/me` returned 401 ❌ → redirect to login
- **Why:** OTP login JWT was missing `national_id` in payload. Family service `/auth/me` requires it for non-worker users.

### Outcome
✅ Added `national_id` to JWT payload in both OTP and password login services.

---

---

## Prompt 5 — IAM Module v2 (Shared Supabase DB)

**Source file:** `common/iam/prompts/iam-module-v2.prompt.md`

### Full Prompt

```
# IAM Module Creation Prompt — v2.0
Date: February 24, 2026
Supersedes: iam-module.prompt.md (v1.0)
Changes from v1: Keycloak backed by shared Supabase PostgreSQL, no sync scripts,
socat IPv4/IPv6 bridge, workaround code removed, complete developer guide added.

---

You are a PRINCIPAL AUTHENTICATION ARCHITECT.

Goal: Generate and maintain the complete IAM module for the SPIS platform providing 
SSO + MFA via Keycloak, where ALL Keycloak state lives in the shared Supabase IAM 
PostgreSQL database so every developer automatically has up-to-date user data without 
any manual sync.

══════════════════════════════════════
1. SCOPE & ROLES
══════════════════════════════════════
- Provide SSO and MFA for Citizens, CaseWorkers, ProgrammeManagers, Admins, SuperAdmins.
- Act as the single Identity Provider (IdP) via Keycloak (OIDC).
- Own identity data only (credentials via Keycloak, MFA, login state). No social/profile 
  data stored here.
- Integrate with Family/Registry Service via events and a shared UUID (registry_id).

══════════════════════════════════════
2. SHARED DATABASE ARCHITECTURE
══════════════════════════════════════
The IAM Supabase PostgreSQL (project: wrxrstmncezssrscrkxs) hosts TWO schemas:

schema: public  — application tables (owned by IAM Service code)
  - users              : user_id, email, mfa_enabled, mfa_secret, status, registry_id,
                         national_id_hash, failed_login_attempts, locked_until
  - user_roles         : user_id, role_name
  - mfa_factors        : user_id, factor_type, secret/phone/email, status
  - login_events       : user_id, ip, user_agent, outcome, created_at
  - password_reset_tokens : user_id, otp_hash, purpose, expires_at, attempt_count, used

schema: keycloak — Keycloak internal tables (auto-created by Keycloak, never touch directly)
  ~100 tables including user_entity, credential, realm, client, keycloak_role, etc.

RULES:
- Do NOT store profile/social data in auth_db beyond registry_id, email, national_id_hash.
- Do NOT redesign the existing registry schema.
- Do NOT add password_hash to the users table — passwords belong to Keycloak's credential table.
- national_id must only be stored as sha256("trn:" + normalize(national_id)).

══════════════════════════════════════
3. KEYCLOAK CONFIGURATION
══════════════════════════════════════
- Realm: spis-dev (development), spis-prod (production)
- Clients:
  - frontend (public, PKCE + direct access grants enabled)
  - backend (confidential, service accounts)
- Signing: RS256 — Keycloak signs with private key, services verify via JWKS
- JWKS endpoint: http://localhost:8080/realms/spis-dev/protocol/openid-connect/certs
- Token claims: sub=keycloak_user_id, preferred_username=national_id, realm_access.roles
- Password policy: bcrypt, min 8 chars
- Direct Access Grants: ENABLED (required for Resource Owner Password Grant)
- Keycloak must use the shared Supabase PostgreSQL:
  KC_DB=postgres
  KC_DB_URL=jdbc:postgresql://127.0.0.1:5433/postgres?sslmode=disable
  KC_DB_USERNAME=postgres
  KC_DB_PASSWORD=<from env>
  KC_DB_SCHEMA=keycloak

CRITICAL — IPv6 Bridge Requirement:
  The Supabase IAM DB (db.wrxrstmncezssrscrkxs.supabase.co) resolves to IPv6 only.
  Keycloak's JVM defaults to IPv4. A socat bridge MUST run on the host:
    socat TCP4-LISTEN:5433,reuseaddr,fork TCP6:[SUPABASE_IPV6]:5432 &
  Keycloak must use --network=host to reach 127.0.0.1:5433.

══════════════════════════════════════
4. AUTHENTICATION FLOWS
══════════════════════════════════════
A) Login with Password
  1. POST /iam/login {national_id, password}
  2. Hash national_id → lookup in users table (status check, lockout check)
  3. Resource Owner Password Grant to Keycloak: username=national_id, password=password
  4. If Keycloak returns 401 → increment failed_login_attempts; lock after 5 attempts (15min)
  5. If Keycloak success → query user_roles + permissions from DB
  6. Issue LOCAL HS256 JWT: {sub, national_id, email, roles, permissions, registry_id}
  7. Record login_event (outcome: success or fail_password)
  8. Return HS256 JWT — NOT the Keycloak RS256 token

B) OTP Login (Passwordless)
  1. POST /iam/otp-login/request {national_id}
  2. Lookup user by national_id_hash; verify status=active
  3. Generate 6-digit OTP (crypto.randomBytes), hash with SHA-256, store in 
     password_reset_tokens with purpose='otp_login', TTL=10min, max_attempts=5
  4. Send OTP to user.email via Email Service (POST http://EMAIL_SERVICE_URL/email/otp)
  5. Return {otp_id}
  
  POST /iam/otp-login/verify {national_id, otp, otp_id}
  6. Retrieve token by user_id + purpose + not used + not expired
  7. Increment attempt_count; reject if > max_attempts (429)
  8. Verify SHA-256(otp) == otp_hash; reject if mismatch (400)
  9. Mark token as used
  10. If user has no Keycloak account → create it (username=national_id, random temp password)
  11. Issue LOCAL HS256 JWT (same shape as password login)

C) Password Reset
  1. POST /iam/password-reset/request {national_id}
     - Lookup user by national_id_hash in users table only
     - Generate OTP, hash, store with purpose='password_reset', TTL=10min
     - Send OTP via Email Service
     - Return {otp_id}
  
  2. POST /iam/password-reset/confirm {national_id, otp, new_password}
     - Verify OTP (TTL, attempts, hash match)
     - Mark OTP used
     - Call Keycloak Admin API:
       - GET /admin/realms/spis-dev/users?username={national_id}&exact=true
       - If exists: PUT /admin/realms/spis-dev/users/{id}/reset-password
       - If not: POST /admin/realms/spis-dev/users (create with credentials)
     - UPDATE users SET status='active'
     - Do NOT store password_hash in the users table — Keycloak owns credential storage

D) Invitation Flow (Registry-driven)
  - POST /iam/invite {registry_id, email, national_id_hash}
  - Create users record
  - Send invite OTP via Email Service
  - Consumed by: RabbitMQ event CREATE_AUTH_ACCOUNT from registry

E) Degraded Mode (Email Service down)
  - OTP/reset/invite → return 503 with Retry-After header
  - Standard password login continues working (no email needed)

══════════════════════════════════════
5. TOKEN DESIGN
══════════════════════════════════════
LOCAL HS256 JWT (what frontend receives and all services verify):
  Header: { alg: "HS256", typ: "JWT" }
  Payload: {
    sub: <user_id from IAM DB>,
    national_id: <plaintext, for display only>,
    email: <user email>,
    roles: ["Citizen"],
    permissions: ["family:read", "profile:update"],
    registry_id: <from users.registry_id>,
    iss: "spis-iam",
    aud: "spis",
    iat: <unix timestamp>,
    exp: <iat + 3600>
  }
  Signed with: JWT_SECRET env var

Keycloak RS256 JWT (internal only — validate then discard):
  Used ONLY to verify Keycloak accepted the credentials.
  NEVER forwarded to frontend or other services.

══════════════════════════════════════
6. AUTHORIZATION MODEL
══════════════════════════════════════
Roles → Permissions mapping (computed at login, embedded in JWT):

Citizen:          family:read, profile:update, documents:upload
CaseWorker:       family:read, family:write, cases:assign, documents:review
ProgrammeManager: family:read, programme:read, programme:write, reports:read
Admin:            *.read, user:manage, audit:read
SuperAdmin:       *.* (unrestricted)

Services MUST check permissions (not roles) for authorization decisions.
Roles are for display/audit. Permissions are for access control.

══════════════════════════════════════
7. API SURFACE
══════════════════════════════════════
POST /iam/login                      — password login → HS256 JWT
POST /iam/otp-login/request          — request OTP for passwordless login
POST /iam/otp-login/verify           — verify OTP → HS256 JWT
POST /iam/password-reset/request     — request reset OTP
POST /iam/password-reset/confirm     — verify OTP + set new password in Keycloak
POST /iam/invite                     — create account + send invite OTP (admin only)
POST /iam/mfa/totp/enroll            — begin TOTP setup
POST /iam/mfa/totp/verify            — confirm TOTP code → activate MFA
POST /iam/mfa/email/send             — send email OTP for MFA step-up
POST /iam/mfa/email/verify           — verify email OTP
GET  /iam/health                     — health check

══════════════════════════════════════
8. INFRASTRUCTURE (start-infra.sh)
══════════════════════════════════════
Order of operations:
1. Start Redis (spis-redis, port 6379)
2. Start socat IPv4→IPv6 bridge (127.0.0.1:5433 → Supabase_IPv6:5432)
3. Start Keycloak (--network=host, KC_DB=postgres, KC_DB_URL=localhost:5433)
4. Health-check loop — wait for Keycloak /health/ready → 200
5. Run setup-keycloak.mjs (idempotent — checks if realm exists before creating)
6. No sync script — Keycloak reads from shared Supabase automatically

stop-all.sh must: pkill -f "socat.*5433" and docker stop spis-keycloak

══════════════════════════════════════
9. EVENTING (RabbitMQ)
══════════════════════════════════════
Exchange: spis.events (topic)

Published by IAM:
  iam.events.AUTH_ACCOUNT_CREATED    {user_id, registry_id, email}
  iam.events.PASSWORD_RESET_REQUESTED {user_id, registry_id, channel, otp_id}
  iam.events.MFA_ENABLED             {user_id, factor_type, timestamp}

Consumed by IAM:
  registry.events.USER_CONTACT_UPDATED {registry_id, email?, phone?} → update mfa contact
  registry.events.USER_DELETED         {registry_id} → disable user + delete from Keycloak
  registry.events.CREATE_AUTH_ACCOUNT  {registry_id, email, national_id_hash} → invite

══════════════════════════════════════
10. SECURITY REQUIREMENTS
══════════════════════════════════════
- national_id: hash BEFORE any storage. Never log raw TRN.
- OTP codes: hash with SHA-256. 10min TTL. Max 5 attempts.
- Account lockout: 5 failed logins → lock 15 min → exponential backoff
- Password minimum length: 8 characters
- Session revocation: on password reset, revoke all Keycloak sessions for the user
- Audit: ALL login attempts → login_events table (success + failures)
- MFA: TOTP default (6-digit, 30s). Email OTP fallback.
- Key rotation: Keycloak RS256 keys rotated quarterly. Maintain dual keys during rollover.

══════════════════════════════════════
11. WHAT NEVER TO DO
══════════════════════════════════════
- DO NOT add password_hash to the users table (passwords live in Keycloak credential table)
- DO NOT add keycloak_username to the users table (username = national_id, use it directly)
- DO NOT store profile/household data in auth_db
- DO NOT forward Keycloak RS256 tokens to the frontend
- DO NOT create a sync script for normal operation (shared DB makes sync obsolete)
- DO NOT run Keycloak with local H2 or local volume in multi-developer environments
- DO NOT use --network=bridge with Keycloak when the DB is IPv6-only (use --network=host)
- DO NOT run Keycloak on docker-compose without the socat bridge for Supabase connectivity
```

### Outcome
✅ IAM module v2 implemented with shared Supabase DB. No more sync scripts needed.

---

---

## Prompt 6 — Keycloak → Supabase PostgreSQL Migration

**Source file:** `common/iam/prompts/keycloak-supabase-migration.prompt.md`

### Full Prompt

```
# Prompt: Keycloak → Supabase PostgreSQL Migration + IAM Cleanup
Target Model: Claude Opus 4.6
Role: Senior Platform Engineer & IAM Architect
Project: SPIS Jamaica — Social Protection Information System

---

## Context You Must Understand First

### Current Architecture (BROKEN state)

Developer A's PC                 Developer B's PC
┌─────────────────────┐         ┌─────────────────────┐
│  Keycloak (Docker)  │         │  Keycloak (Docker)  │
│  + LOCAL H2 volume  │         │  + LOCAL H2 volume  │
│  (private data)     │         │  (private data)     │
└─────────────────────┘         └─────────────────────┘
        ↕ manual sync                    ↕ manual sync
┌────────────────────────────────────────────────────────┐
│           Supabase IAM DB (shared)                     │
│  project: wrxrstmncezssrscrkxs                         │
│  users, user_roles, password_reset_tokens, etc.        │
└────────────────────────────────────────────────────────┘

Problem: Every developer has a SEPARATE Keycloak instance with its own private user store. 
When teammate A adds a user or someone resets a password, Developer B's Keycloak knows 
nothing about it.

### Target Architecture (What you must build)

Developer A's PC                 Developer B's PC
┌─────────────────────┐         ┌─────────────────────┐
│  Keycloak (Docker)  │         │  Keycloak (Docker)  │
│  --network=host     │         │  --network=host     │
│  socat IPv4→IPv6    │         │  socat IPv4→IPv6    │
└──────────┬──────────┘         └──────────┬──────────┘
           │  JDBC                          │  JDBC
           └──────────────┬─────────────────┘
                          ↓
          ┌───────────────────────────────────┐
          │     Supabase IAM PostgreSQL        │
          │  project: wrxrstmncezssrscrkxs     │
          │  schema: public  → app tables      │
          │  schema: keycloak → KC tables      │
          └───────────────────────────────────┘

Result: Every developer's local Keycloak reads/writes the SAME database. Users, passwords, 
roles — everything is instantly shared. No sync script ever needed.

---

## Critical Technical Constraint

The Supabase IAM DB hostname db.wrxrstmncezssrscrkxs.supabase.co resolves to IPv6 only:
  2406:da14:271:990a:390c:6d0d:f781:66a9

Keycloak's JVM defaults to IPv4 (-Djava.net.preferIPv4Stack=true) and cannot connect.
Solution: Run socat on the HOST as an IPv4→IPv6 bridge:
  socat TCP4-LISTEN:5433,reuseaddr,fork TCP6:[2406:da14:271:990a:390c:6d0d:f781:66a9]:5432 &
Then Keycloak (with --network=host) connects to 127.0.0.1:5433 via IPv4,
and socat forwards it to Supabase over IPv6.

---

## Step-by-Step Implementation

### STEP 1 — Install socat
  sudo apt-get install -y socat

### STEP 2 — Update start-infra.sh
  - Kill stale socat processes
  - Start socat bridge on port 5433
  - Start Keycloak with --network=host and shared Supabase PostgreSQL config
  - Health-check loop (wait for /health/ready)
  - Run setup-keycloak.mjs (idempotent)
  - Remove old sync-users block entirely

### STEP 3 — Remove the Workaround Code
  3a — Drop columns from Supabase:
    ALTER TABLE users DROP COLUMN IF EXISTS password_hash;
    ALTER TABLE users DROP COLUMN IF EXISTS keycloak_username;
    DROP INDEX IF EXISTS idx_users_keycloak_username;
  
  3b — Revert src/types.ts: remove password_hash and keycloak_username from UserRow
  3c — Revert src/lib/crypto.ts: remove bcrypt section entirely
  3d — Revert src/db/repository.ts: remove savePasswordHash function
  3e — Revert src/services/passwordReset.ts: remove hashPassword and savePasswordHash calls

### STEP 4 — Mark sync-users-to-keycloak.mjs as deprecated
  Add @deprecated comment. Do NOT delete — useful for one-time migration.

### STEP 5 — Handle stop-all.sh and Docker Container Reset
  docker stop spis-keycloak; docker rm spis-keycloak
  Add to stop-all.sh: pkill -f "socat.*5433"

### STEP 6 — Rebuild and Verify

---

## Fallback: If socat is Unavailable

Use Node.js TCP proxy at backend/iam-service/ipv4-proxy.mjs:
  import net from 'net'
  const server = net.createServer(client => {
    const remote = net.connect({ host: SUPABASE_IPV6, port: 5432, family: 6 })
    client.pipe(remote); remote.pipe(client)
  })
  server.listen(5433, '127.0.0.1')

---

## Verification Checklist
- [ ] keycloak schema has 90+ tables
- [ ] Keycloak Admin UI shows spis-dev realm
- [ ] Password reset on Dev A works on Dev B WITHOUT sync
- [ ] start-infra.sh runs end-to-end without manual intervention
- [ ] TypeScript builds cleanly
- [ ] No password_hash or keycloak_username columns in users table
- [ ] sync-users-to-keycloak.mjs is deprecated and not called

## What NOT to Change
- Do NOT modify the users, user_roles, password_reset_tokens tables
- Do NOT change any frontend code
- Do NOT change the family-service, email-service
- Do NOT change the JWT signing/verification logic
- Do NOT change the OTP flow
```

### Outcome
✅ Keycloak migrated to shared Supabase PostgreSQL. All developers share the same data automatically.

---

---

## Prompt 7 — Multi-Tab Login Sharing

**Source file:** `common/infra/prompts/auth.md` — Section 1

### Problem Reported

> Logging in on one tab did not carry over to another tab — the second tab asked to log in again.

### Root Cause

`authStore.ts` was using `sessionStorage` as the Zustand persist storage. `sessionStorage` is tab-isolated by browser design. Additionally, `App.tsx` was calling `localStorage.removeItem('spis-auth-storage')` on every page load, actively destroying any cross-tab storage.

### Requirement Given

> - Same browser profile must share auth session across all tabs automatically.
> - Incognito remains separate (acceptable and desired).

### Fix Specified

> 1. Switch persist storage from `sessionStorage` → `localStorage`
> 2. Add `BroadcastChannel('spis-auth')` for real-time cross-tab sync
>    - `login()` calls `authChannel.postMessage({ type: 'LOGIN' })`
>    - `logout()` calls `authChannel.postMessage({ type: 'LOGOUT' })`
>    - Channel `onmessage` handler clears Zustand state on LOGOUT
> 3. Add `window.addEventListener('storage', ...)` as fallback
>    - Catches changes to `spis-auth-storage` written by other tabs
>    - Handles key deletion by clearing state
> 4. Remove `localStorage.removeItem('spis-auth-storage')` call in App.tsx
> 5. One-time migration: if `spis-auth-storage` exists in `sessionStorage`, copy to `localStorage`, then delete from `sessionStorage`

### Security Constraints

> - Tokens are signed JWTs — stolen token only useful from same origin
> - `hasPermission()` reads from JWT payload in `session.permissions`
> - Backend validates every request; frontend guards are UX only
> - Incognito profiles have isolated `localStorage` partition

### Verification

> 1. Login in tab1 → open tab2 → tab2 shows authenticated view ✅
> 2. Logout in tab1 → tab2 redirected to login ✅
> 3. Incognito window isolated ✅
> 4. Hard-refresh while logged in → still authenticated ✅

### Outcome
✅ Cross-tab auth sharing working.

---

---

## Prompt 8 — Every API Request Sent Twice

**Source file:** `common/infra/prompts/auth.md` — Section 2

### Problem Reported

> Each API call appears twice in the network tab.

### Tasks Given

> - Identify why requests duplicate:
>   - React StrictMode double-invoking effects?
>   - Two different fetching mechanisms running in parallel?
>   - Axios interceptor replaying requests?
>   - Retry logic triggering immediately?
> - Fix so only one request is sent per user action.
> - If StrictMode is the cause, fix effects to be idempotent OR adjust dev behavior — do NOT break production.

### Verification Required

> Before/after proof: network logs with unique request IDs showing duplicates are gone.

### Outcome
✅ Root cause: React StrictMode double-invoking effects. Fixed with idempotent effects and abort controllers.

---

---

## Prompt 9 — Super Admin Dashboard with RBAC

**Source file:** `common/infra/prompts/dashboard.md`

### Full Prompt

```
# Dashboard Prompt

Prompt for building the Super Admin Dashboard experience inside the existing React application.

## Context

You are working inside an existing React application that already has a global layout 
and sidebar. Follow the existing project patterns and styling exactly.

## Primary Goal

Create a Super Admin Dashboard experience by adding the following sections as new items 
in the existing sidebar, and implement the corresponding pages using the same layout and 
design system as the existing pages.

## Hard Requirements

- Use the existing sidebar component/navigation structure. Do NOT create a new sidebar.
- Add these sidebar sections (routes/pages) under the same layout:
  - Overview
  - Families
  - Programmes
  - Grievances
  - Appeals
  - Admins & Access
  - Archived
  - Audit Logs
- All pages must use the current layout wrapper and match the existing page design 
  (same header spacing, typography, table style, buttons, filters, etc.).
- Families page must use the existing Families API already present in the codebase. 
  Do not mock families. Use the current API service/client and existing hooks/patterns.
- For new features (Programmes, Grievances, Appeals, Admins, Archived, Audit Logs), 
  use mock data.
- Create ONE single mock data file (e.g., src/mock/superAdminMockData.ts). Store all 
  mock arrays and helper functions there. Do NOT define mock data inside individual components.
- Implement Edit and Archive access controls (RBAC) at UI level — hide/disable buttons 
  when permissions are missing.
- Use pagination, sorting, and filtering UI consistent with the existing table pages.

## Feature Details

### 1) Families (Real API)
Fetches family dataset using the existing API. Table columns:
  Family ID, Head of Family, Members Count, Region/District, Phone, Primary Programme, 
  Status, Last Updated
Row actions:
  View — details drawer consistent with current UX
  Edit — permission-based
  Archive — permission-based + confirmation modal requiring reason

### 2) Programmes (Mock Data)
Programme master table columns:
  Programme ID, Name, Programme Type, Status, Enrolled Count, Eligible Count, 
  Benefits Disbursed, Last Updated
Programme details view with tabs: Enrolled / Benefits Received / Eligible
Export button (permission-based, CSV)

### 3) Grievances (Mock Data)
Columns: Grievance ID, Family ID, Category, Priority, Status, Assigned Admin, 
  Created Date, SLA Due
Actions: View, Edit, Archive (permission-based)
Status update UI (dropdown)

### 4) Appeals (Mock Data)
Columns: Appeal ID, Grievance ID, Family ID, Reason, Status, Reviewer, Submitted Date
Review UI in details drawer: Approve / Deny / Request Info
Actions: View, Edit, Archive (permission-based)

### 5) Admins & Access Control (Mock Data)
Table: Admin ID, Name, Email, Role, Status, Last Login
Actions: Add Admin, Edit Admin, Suspend/Activate
Permission matrix editor (modal) with modules:
  Families, Programmes, Grievances, Appeals, Archived, Audit Logs, Export
Permissions: View, Create, Edit, Archive, Manage Admins, Export

### 6) Archived (Mock Data)
Unified table filterable by record type: Families / Programmes / Grievances / Appeals
Restore action (Super Admin only)
Show: archived reason, archived by, archived date

### 7) Audit Logs (Mock Data)
Immutable log table columns: Timestamp, Actor, Action, Module, Record ID, Summary
Filters: user, module, date range

## Mock Data Model (superAdminMockData.ts)
Arrays: programmes[], programmeFamilyMap[], grievances[], appeals[], admins[], 
  archivedRecords[], auditLogs[]
Helper functions: getProgrammeFamilies(), getProgrammeFamiliesBySegment(), hasPermission()

## Implementation Instructions
- Reuse existing shared components (Table, Badge, Modal, Drawer, Button, Filters)
- Keep styling identical to existing pages
- No duplication of layout wrappers
- Do not invent a new UI library
```

### Outcome
✅ Full Super Admin dashboard built with RBAC, permission-gated routes, role management UI, and all 7 sections.

---

---

## Prompt 10 — Permission-Tree VIEW Dependency Bug

**Source file:** `common/infra/prompts/auth.md` — Sections 3-6

### Problem Reported

> `SYSTEM → EXPORT` requires VIEW permission when other permissions are selected, but SYSTEM → EXPORT has no VIEW child.

### Root Cause Found

> - `enforceViewDependency` in `permissionUtils.ts` and `AdminRoleManagement.tsx` listed `'EXPORT'` inside `WRITE_ACTIONS`.
> - This caused any EXPORT permission check to auto-add a `*.VIEW` key that doesn't exist in the permission registry.
> - `SYSTEM.EXPORT.ALL` and `SYSTEM.REPORTS.*` were dead permissions — never guarded by any `hasPermission()` call anywhere.

### Fix Specified

> - Remove `'EXPORT'` from `WRITE_ACTIONS` in both `src/utils/permissionUtils.ts` and `src/pages/superadmin/AdminRoleManagement.tsx`
> - Remove the entire `SYSTEM → Export` and `SYSTEM → Reports` sections from `src/config/featureCatalogue.ts` (unused)
> - Remove `SYSTEM` key from `src/lib/auth.ts` permission constants (unused)

### Permission Enforcement Rules Established

> - **Never base access on role names.** Use permission keys only (e.g., `ADMIN.FAMILIES.EDIT`).
> - **Do not trust localStorage user objects for authorisation decisions.** Only the signed JWT/token is authoritative.
> - **Backend must enforce authorisation.** Frontend guards (hiding buttons, redirect) are UX-only.
> - **VIEW is required for write actions** (CREATE, EDIT, DELETE, ARCHIVE, RESTORE, MANAGE) on modules that have a VIEW permission — enforced automatically by `enforceViewDependency`.
> - **EXPORT does not require VIEW** — it is a read-like action, not a mutation.

### Permission Key Naming Convention

```
MODULE.SUBMODULE.ACTION

Examples:
  ADMIN.FAMILIES.VIEW
  ADMIN.FAMILIES.CREATE
  ADMIN.FAMILIES.EDIT
  ADMIN.FAMILIES.ARCHIVE
  ADMIN.FAMILIES.EXPORT
  ADMIN.ROLES.MANAGE_PERMISSIONS
  ADMIN.AUDITLOGS.EXPORT

Write Actions (auto-add VIEW when checked):
  CREATE, EDIT, DELETE, ARCHIVE, RESTORE, MANAGE, ASSIGN, REVIEW, APPLY, MANAGE_PERMISSIONS

Read Actions (no VIEW dependency):
  EXPORT, VIEW itself
```

### Outcome
✅ Permission tree bug fixed. Dead permissions removed. Enforcement rules documented.

---

---

## Prompt 11 — Redis Caching & Import/Export

**Source file:** `common/infra/prompts/redis-import-export.md`

### Full Prompt

```
# Redis · Double Requests · Import / Export Prompt

You are a senior full-stack engineer. Audit the entire codebase and fix the issues below.
For each item provide: root cause + exact file/function references + changes + 
verification steps.

---

## Issue 1 — Redis Caching Not Working

Repeated calls to cached endpoints have the same (slow) response time.

Tasks:
- Locate caching middleware/service usage for APIs
- Verify Redis connection init, config (host / port / db index), and error handling
- Verify cache key strategy — keys must not vary per call when the request is logically identical
- Ensure cache HIT returns cached payload without hitting DB/service
- Ensure TTL is correct and SET is actually executing
- Add dev-only debug: response header X-Cache: HIT|MISS and logs of cache keys + hit/miss
- Confirm caching is NOT disabled by auth token or headers unless intentional
- Reproducible test: call endpoint 5 times and show hit/miss results and improved latency

Deliverable:
- "Cache Working Report" including:
  - Which endpoints are cached
  - Cache key format
  - TTLs
  - Invalidation rules
  - Evidence (logs / headers)

---

## Issue 2 — Every API Request Sent Twice

Each API call appears twice in the network tab.

Tasks:
- Identify root cause (StrictMode? Two fetching mechanisms? Axios interceptor? Retry?)
- Fix so only one request is sent per user action
- If StrictMode, fix effects to be idempotent — do NOT break production

Deliverable:
- Before/after proof: network logs showing duplicates are gone

---

## Issue 3 — Excel Export

Current state: CSV export exists on Families, Programmes, Grievances, Appeals, Audit Logs.

Requirement:
- Add Export as .xlsx option alongside the existing CSV export
- Use SheetJS (xlsx) library
- Column headers must match the existing CSV export columns
- Auto-size columns based on content
- Export button is permission-based (*.EXPORT permission key)

Schema for each module:
| Module      | Exported columns |
|-------------|-----------------|
| Families    | Family ID, Head Name, National ID, Phone, Email, Household Size, Programme, Status, Created |
| Programmes  | Programme ID, Name, Type, Status, Enrolled Count, Eligible Count, Benefits Disbursed, Last Updated |
| Grievances  | Grievance ID, Family ID, Category, Priority, Status, Assigned Admin, Created Date, SLA Due |
| Appeals     | Appeal ID, Grievance ID, Family ID, Reason, Status, Reviewer, Submitted Date |
| Audit Logs  | Timestamp, Actor, Action, Module, Record ID, Summary, IP Address |

---

## Issue 4 — Excel Import with Validation

Requirement:
- Add Import from .xlsx on Families, Programmes, Grievances, Appeals pages
- Strict per-column validation with row-level error reporting

### Step-Form Wizard (2 steps)

Step 1 — Upload:
- Download template button (generates blank .xlsx with correct headers + hint row)
- Column reference legend
- Drag-and-drop or click-to-browse file upload (.xlsx / .xls only)

Step 2 — Verify:
- Summary banner: N valid / N with errors / total rows / filename
- Error table: shows ALL columns; each cell displays value + inline error
- Valid preview: first 5 rows (shown only when zero errors)
- Import button: disabled when any errors exist; label "Resolve N errors to import"
- "Import X valid only" escape-hatch link
- Download error report button (.xlsx)

### Validation Rules per Column Type
| Type     | Rule |
|----------|------|
| string   | Optional min/max length |
| number   | Must parse as number; optional min/max value |
| email    | Must match ^[^\s@]+@[^\s@]+\.[^\s@]+$ |
| phone    | Must match ^[\d\s\-+()]{7,15}$ |
| enum     | Must be one of static options[] |
| date     | Must parse to valid date (YYYY-MM-DD) |
| lookup   | Must match value in lookupValues[] |

### Import Column Schemas per Module

Families:
  First Name* string min:2 max:50, Last Name* string min:2 max:50,
  National ID* string min:5 max:20, Phone* phone, Email email,
  Household Size* number min:1 max:20, Programme lookup, Status enum

Programmes:
  Programme Name* string min:3 max:100, Programme Type* enum,
  Status* enum, Description string max:500

Grievances:
  Family ID* string, Family Name* string min:2 max:100,
  Category* enum, Priority* enum, Summary* string min:10 max:500,
  Assigned To lookup

Appeals:
  Family ID* string, Family Name* string min:2 max:100,
  Grievance ID* lookup, Reason* string min:10 max:1000, Reviewer lookup

### After Successful Import
- Rows appended to local state optimistically
- In production: call relevant API per row
- Imported records show intake_channel: 'BULK_IMPORT'
```

### Outcome
✅ Redis caching fixed with X-Cache headers. Excel import/export implemented with full validation wizard.

---

---

## Prompt 12 — DNS/Supabase Connectivity Fix (Login Broken)

**Date:** February 25, 2026

### Exact Prompt Given

> "I am not able to login — Invalid credentials. If you haven't set a password yet, use Forgot password? below."

### Investigation Chain

```
1. POST /api/v1/auth/login (frontend → family-service:3001)
2. family-service calls POST http://localhost:3003/iam/keycloak/login
3. IAM service tries supabase.rpc('exec_sql', {...}) 
4. Supabase client uses Node.js fetch() → getaddrinfo() → DNS FAILS
5. Error: "DB query failed: TypeError: fetch failed"

Root cause: 
- Node.js dns.getServers() → ['192.1.200.31', '35.200.192.5'] (VPN DNS servers)
- These servers REFUSE to resolve *.supabase.co
- Node.js dns.lookup() returns: getaddrinfo EAI_AGAIN wrxrstmncezssrscrkxs.supabase.co
- But dns.Resolver with ['8.8.8.8', '1.1.1.1'] resolves fine → 172.64.149.246
```

### Fix Applied

Modified `backend/iam-service/src/db/pool.ts`:
- Created custom `fetch` wrapper using Node.js `https` module
- Custom DNS lookup via `dns.Resolver` pointing to Google DNS (`8.8.8.8`, `1.1.1.1`)
- Injected into Supabase client via `global.fetch` option

Additional fix — Node.js v20 Response constructor crash:
```
TypeError: Response constructor: Invalid response status code 204
```
Status 204 is a "null body status" per Fetch spec. Fixed by passing `null` body for 204/205/304.

### Outcome
✅ Login working again. IAM service can reach Supabase despite VPN DNS blocking.

---

---

## Source Prompt Files Index

| File | What It Contains |
|---|---|
| `common/iam/prompts/iam-module.prompt.md` | Original IAM architecture prompt (v1) |
| `common/iam/prompts/iam-module-v2.prompt.md` | Shared Supabase DB version (v2) |
| `common/iam/prompts/keycloak-supabase-migration.prompt.md` | Migration from H2 → shared Supabase |
| `common/infra/prompts/auth.md` | Multi-tab login, double requests, permission bugs |
| `common/infra/prompts/dashboard.md` | Super Admin dashboard with RBAC |
| `common/infra/prompts/redis-import-export.md` | Redis caching, Excel import/export |

---

*Compiled: February 25, 2026 | SPIS Jamaica — IAM & Authorization Prompt History*
