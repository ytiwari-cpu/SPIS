# SPIS IAM Module — Complete Developer Guide

> **Last Updated:** February 24, 2026  
> **Service Port:** 3003  
> **Database:** Supabase `wrxrstmncezssrscrkxs` (schema: `public` for app tables, `keycloak` for Keycloak internals)

---

## Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [How Authentication Works](#2-how-authentication-works)
3. [Flow A — Login with Password](#3-flow-a--login-with-password)
4. [Flow B — Login with OTP (Passwordless)](#4-flow-b--login-with-otp-passwordless)
5. [Flow C — Password Reset](#5-flow-c--password-reset)
6. [Authorization — Roles & Permissions](#6-authorization--roles--permissions)
7. [Token Anatomy](#7-token-anatomy)
8. [Database Schema](#8-database-schema)
9. [Developer Setup](#9-developer-setup)
10. [API Reference](#10-api-reference)
11. [Error Reference](#11-error-reference)

---

## 1. Architecture Overview

```
 ┌─────────────────────────────────────────────────────────────────┐
 │                        SPIS Platform                           │
 │                                                                 │
 │  Frontend (3000)                                                │
 │       │                                                         │
 │       │  POST /iam/login (password or OTP)                      │
 │       ▼                                                         │
 │  IAM Service (3003)  ──────────────────────────────────────┐   │
 │       │                                                     │   │
 │       │  Resource Owner Password Grant                      │   │
 │       ▼                                                     │   │
 │  Keycloak (8080) ←──── Shared Supabase PostgreSQL ─────────┘   │
 │       │                (schema: keycloak)                       │
 │       │  RS256-signed JWT                                       │
 │       ▼                                                         │
 │  IAM Service issues LOCAL HS256 JWT ──► Frontend               │
 │                                                                 │
 │  Family Service (3001) ◄─── verifies HS256 JWT                 │
 │  Programme Service (3004) ◄─ verifies HS256 JWT                │
 └─────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision | Why |
|---|---|
| Keycloak stores passwords | Keycloak handles bcrypt/argon2 hashing, brute-force protection, and session management |
| IAM service re-issues HS256 JWT | Family/Programme services already verify HS256. No changes needed there |
| national_id stored as SHA-256 hash | TRN is PII — never stored in plaintext |
| Shared Supabase PostgreSQL for Keycloak | All developers share the same user store. No manual sync needed |
| Email OTP for identity verification | No reliance on SMS. OTP sent via Email Service (3002) |

---

## 2. How Authentication Works

### Step 1 — User provides credentials
The frontend sends the user's `national_id` + `password` (or an OTP code) to the IAM Service.

### Step 2 — IAM Service checks local DB
The `national_id` is hashed with SHA-256 (`sha256("trn:" + normalize(national_id))`) and 
looked up in the `users` table. This check validates:
- Does this user exist?
- Is their account `active` (not `locked`, `pending`, or `disabled`)?
- Is the account locked due to too many failed attempts?

### Step 3 — Credential validation via Keycloak
The IAM Service sends the `national_id` + `password` to Keycloak's **Token Endpoint** 
using the **Resource Owner Password Grant** (ROPG):
```
POST http://localhost:8080/realms/spis-dev/protocol/openid-connect/token
  grant_type=password
  client_id=frontend
  username=<national_id>
  password=<password>
```
Keycloak validates the password (its own bcrypt hash stored in the `keycloak` schema in 
Supabase) and returns an RS256-signed JWT if valid.

### Step 4 — IAM Service issues a LOCAL JWT
The IAM Service **does not forward** the Keycloak RS256 token to the frontend. Instead it 
creates a new **HS256 JWT** signed with the `JWT_SECRET` env var. This token contains:
```json
{
  "sub": "754e90bc-...",
  "national_id": "TRN12345",
  "email": "user@example.com",
  "roles": ["Citizen"],
  "permissions": ["family:read", "profile:update"],
  "registry_id": "abc-123",
  "iss": "spis-iam",
  "exp": 1234567890
}
```

### Step 5 — Frontend uses the token
All subsequent API calls include the HS256 token in the `Authorization: Bearer <token>` 
header. Family/Programme services verify it locally using the shared `JWT_SECRET`.

```
┌─────────┐    POST /iam/login     ┌───────────┐
│Frontend │ ─────────────────────► │IAM Service│
│         │                        │           │──► Keycloak (validates password)
│         │ ◄──── HS256 JWT ──────  │           │◄── RS256 JWT (discarded internally)
│         │                        └───────────┘
│         │    GET /family/me                        ┌──────────────┐
│         │    Authorization: Bearer <HS256>  ──────►│Family Service│
│         │ ◄──────────────────────────────────────  │(verifies HS256│
└─────────┘                                          └──────────────┘
```

---

## 3. Flow A — Login with Password

### Endpoint
```
POST /iam/login
Content-Type: application/json

{
  "national_id": "TRN123456789",
  "password": "MyPassword123!"
}
```

### Success Response
```json
{
  "success": true,
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "user_id": "754e90bc-1dac-443c-b434-18e27e72641e",
  "email": "user@example.com",
  "roles": ["Citizen"],
  "permissions": ["family:read", "profile:update"]
}
```

### Failure Modes

| HTTP | Code | Meaning |
|---|---|---|
| 401 | `INVALID_CREDENTIALS` | Wrong national_id or password |
| 401 | `ACCOUNT_NOT_FOUND` | national_id not in IAM DB |
| 403 | `ACCOUNT_LOCKED` | Too many failed attempts (unlocks after 15 min) |
| 403 | `ACCOUNT_DISABLED` | Admin has disabled this account |
| 500 | `KEYCLOAK_ERROR` | Keycloak unreachable (run `bash start-infra.sh`) |

### Sequence Diagram
```
Frontend          IAM Service        IAM DB (Supabase)    Keycloak
   │                   │                    │                  │
   │─ POST /iam/login ►│                    │                  │
   │                   │─ hash(national_id) │                  │
   │                   │─ SELECT user ─────►│                  │
   │                   │◄── UserRow ────────│                  │
   │                   │  [status check]    │                  │
   │                   │─ ROPG grant ──────────────────────────►│
   │                   │◄─ RS256 token (or error) ─────────────│
   │                   │  [record login_event]                  │
   │                   │─ increment/reset failed_logins ───────►│
   │                   │─ sign HS256 JWT    │                  │
   │◄── HS256 JWT ─────│                    │                  │
```

---

## 4. Flow B — Login with OTP (Passwordless)

Used for users who have never set a password (e.g., newly invited citizens).

### Step 1 — Request OTP
```
POST /iam/otp-login/request
{ "national_id": "TRN123456789" }
```
- IAM looks up user by `national_id_hash`
- Generates a 6-digit OTP, stores `sha256(otp)` in `password_reset_tokens` table with `purpose='otp_login'`
- Sends OTP to user's registered email via Email Service (3002)

### Step 2 — Verify OTP and Get Token
```
POST /iam/otp-login/verify
{
  "national_id": "TRN123456789",
  "otp": "482019",
  "otp_id": "uuid-from-step-1"
}
```
- Verifies OTP hash matches, TTL not expired (10 min), attempts not exceeded (5 max)
- Issues a LOCAL HS256 JWT (same shape as password login)
- Creates the Keycloak user if they don't exist yet (with a random temp password)

### Failure Modes

| HTTP | Code | Meaning |
|---|---|---|
| 404 | `USER_NOT_FOUND` | national_id not registered |
| 400 | `OTP_EXPIRED` | OTP older than 10 minutes |
| 400 | `OTP_INVALID` | Wrong OTP code |
| 429 | `OTP_MAX_ATTEMPTS` | 5 wrong attempts — request a new OTP |
| 503 | `EMAIL_SERVICE_DOWN` | Email Service unavailable |

---

## 5. Flow C — Password Reset

### Step 1 — Request OTP
```
POST /iam/password-reset/request
{ "national_id": "TRN123456789" }
```
- Only works for users in the `users` table (not pure registry members)
- Generates OTP, stores hash, sends via Email Service

**Response:**
```json
{ "success": true, "message": "OTP sent to your registered email", "otp_id": "uuid" }
```

### Step 2 — Confirm with OTP + New Password
```
POST /iam/password-reset/confirm
{
  "national_id": "TRN123456789",
  "otp": "391042",
  "new_password": "NewSecurePass123!"
}
```

**What happens internally:**
1. Verifies OTP hash + TTL + attempt limit
2. Marks OTP as used
3. Calls Keycloak Admin API to set the new password:
   - If user exists in Keycloak → `PUT /admin/realms/spis-dev/users/{id}/reset-password`
   - If user doesn't exist in Keycloak → creates them with `POST /admin/realms/spis-dev/users`
4. Sets IAM DB `users.status = 'active'`
5. Since Keycloak uses the **shared Supabase DB**, the new password is **immediately available** 
   to all developers/environments with no sync required

**Response:**
```json
{ "success": true, "message": "Password set successfully. You can now log in.", "user_id": "uuid" }
```

### Sequence Diagram
```
Frontend          IAM Service        IAM DB             Keycloak (→ Supabase)
   │                   │                │                      │
   │─ /request ───────►│                │                      │
   │                   │─ SELECT user ─►│                      │
   │                   │─ INSERT otp ──►│                      │
   │                   │─ send email ──────────── Email Service │
   │◄─ {otp_id} ───────│                │                      │
   │                   │                │                      │
   │─ /confirm ───────►│                │                      │
   │                   │─ verify otp ──►│                      │
   │                   │─ mark used ───►│                      │
   │                   │─ set password ─────────────────────────►│
   │                   │                │          (stored in shared Supabase)
   │                   │─ UPDATE status►│                      │
   │◄─ success ────────│                │                      │
```

---

## 6. Authorization — Roles & Permissions

### Roles (stored in `user_roles` table + Keycloak realm roles)

| Role | Description | Access Level |
|---|---|---|
| `Citizen` | Registered citizen | Own family data only |
| `CaseWorker` | Staff managing cases | Assigned cases |
| `ProgrammeManager` | Programme administration | All programme data |
| `Admin` | System administrator | Full read + user management |
| `SuperAdmin` | Platform owner | Unrestricted |

### Permissions (derived from roles at login time)
Permissions are computed by `getUserPermissions()` in `repository.ts` and embedded in the 
HS256 JWT. Services check permissions, NOT roles directly.

Example permission set for `Citizen`:
```
family:read, profile:update, documents:upload
```

Example permission set for `CaseWorker`:
```
family:read, family:write, cases:assign, documents:review
```

### How Downstream Services Authorize Requests
```typescript
// In family-service requireAuth middleware:
const token = verifyJWT(req.headers.authorization)
// token.permissions includes 'family:read'

// In route handler:
if (!token.permissions.includes('family:write')) {
  return res.status(403).json({ error: 'Insufficient permissions' })
}
```

---

## 7. Token Anatomy

### HS256 JWT (issued by IAM Service, verified by all services)
```json
{
  "header": { "alg": "HS256", "typ": "JWT" },
  "payload": {
    "sub": "754e90bc-1dac-443c-b434-18e27e72641e",  // user_id from IAM DB
    "national_id": "TRN123456789",                   // plaintext in JWT (not stored)
    "email": "user@example.com",
    "roles": ["Citizen"],
    "permissions": ["family:read", "profile:update"],
    "registry_id": "reg-abc-123",                    // link to family-service
    "iss": "spis-iam",
    "aud": "spis",
    "iat": 1708800000,
    "exp": 1708803600                                // 1 hour expiry
  }
}
```
**Signed with:** `JWT_SECRET` env var (HS256 — symmetric, shared across services)

### RS256 JWT (issued by Keycloak — used INTERNALLY only, never sent to frontend)
```json
{
  "header": { "alg": "RS256", "kid": "wkTRZKeN7..." },
  "payload": {
    "sub": "keycloak-user-uuid",
    "preferred_username": "TRN123456789",
    "realm_access": { "roles": ["Citizen"] },
    "iss": "http://localhost:8080/realms/spis-dev",
    "exp": 1708803600
  }
}
```
**Signed with:** Keycloak's private RSA key (never exposed)  
**Verified with:** Public key from `http://localhost:8080/realms/spis-dev/protocol/openid-connect/certs`

---

## 8. Database Schema

### Tables in `public` schema (app data — IAM service owns)

```sql
-- Identity records
users (
  user_id          UUID PK,
  email            VARCHAR UNIQUE NOT NULL,
  mfa_enabled      BOOLEAN DEFAULT false,
  mfa_secret       TEXT,                    -- encrypted TOTP secret
  status           user_status,             -- pending|active|locked|disabled
  registry_id      TEXT,                    -- link to family-service
  national_id_hash TEXT,                    -- sha256("trn:" + normalize(national_id))
  failed_login_attempts INT DEFAULT 0,
  locked_until     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ
)

-- Role assignments
user_roles (user_id UUID, role_name TEXT, created_at TIMESTAMPTZ)

-- OTP tokens for password reset AND OTP login
password_reset_tokens (
  id            UUID PK,
  user_id       UUID FK → users,
  otp_hash      TEXT,                       -- sha256(otp_code)
  purpose       otp_purpose,                -- password_reset|otp_login|invite
  expires_at    TIMESTAMPTZ,                -- NOW() + 10 minutes
  attempt_count INT DEFAULT 0,
  max_attempts  INT DEFAULT 5,
  used          BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ
)

-- MFA factors
mfa_factors (user_id, factor_type, secret, status, ...)

-- Audit log
login_events (user_id, ip, user_agent, outcome, created_at)
```

### Tables in `keycloak` schema (Keycloak internal — do NOT modify directly)
Keycloak auto-creates ~100 tables including:
- `realm`, `client`, `keycloak_role` — realm/client config
- `user_entity` — Keycloak user records (username = national_id)
- `credential` — bcrypt-hashed passwords
- `user_role_mapping` — user ↔ role assignments in Keycloak

---

## 9. Developer Setup

### First Time (on a fresh machine)
```bash
# 1. Install socat (needed for IPv4→IPv6 bridge to Supabase)
sudo apt-get install -y socat

# 2. Start all infrastructure
cd /home/yuvraj/Desktop/SPIS
bash start-infra.sh
# This will:
#   - Start socat bridge (127.0.0.1:5433 → Supabase IPv6:5432)
#   - Start Keycloak with shared Supabase PostgreSQL backend
#   - Wait for Keycloak to initialize (~60s first time, ~15s after)
#   - Run setup-keycloak.mjs (idempotent — skipped if realm exists)

# 3. Start backend services
cd backend/iam-service && npm run dev
cd backend/email-service && npm run dev
cd backend/family-service && npm run dev

# 4. Start frontend
cd frontend && npm run dev
```

### Daily Workflow (after initial setup)
```bash
# Just run start-infra.sh — everything is shared, no sync needed
bash start-infra.sh

# Then start services normally
```

### When a Teammate Adds a New User
- Nothing required. Keycloak reads from the shared Supabase database.
- The new user can log in on YOUR machine immediately.

### Troubleshooting

**"Password reset failed. Please try again."**
→ Keycloak is not running. Run `bash start-infra.sh`

**Keycloak starts but users can't log in after teammate added them**
→ Check that both machines have socat running: `pgrep -a socat`
→ If not running: `socat TCP4-LISTEN:5433,reuseaddr,fork TCP6:[2406:da14:271:990a:390c:6d0d:f781:66a9]:5432 &`

**"fetch failed" in IAM logs**
→ Keycloak is unreachable. Check `curl http://localhost:8080/health/ready`
→ If 000: run `bash start-infra.sh`

**Keycloak container keeps restarting**
→ socat bridge may have died. Run `bash start-infra.sh` which restarts socat and Keycloak.

---

## 10. API Reference

### Authentication Endpoints (port 3003)

| Method | Path | Auth Required | Description |
|---|---|---|---|
| POST | `/iam/login` | No | Login with national_id + password |
| POST | `/iam/otp-login/request` | No | Request OTP for passwordless login |
| POST | `/iam/otp-login/verify` | No | Verify OTP and get access token |
| POST | `/iam/password-reset/request` | No | Request password reset OTP |
| POST | `/iam/password-reset/confirm` | No | Confirm reset with OTP + new password |
| POST | `/iam/invite` | Admin JWT | Create account for new user |
| POST | `/iam/mfa/totp/enroll` | JWT | Start TOTP setup |
| POST | `/iam/mfa/totp/verify` | JWT | Confirm TOTP code to activate MFA |
| GET | `/iam/health` | No | Service health check |

### Request / Response Examples

#### POST `/iam/login`
```json
// Request
{ "national_id": "TRN123456789", "password": "Password123!" }

// Response 200
{
  "success": true,
  "access_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "user_id": "uuid",
  "email": "user@example.com",
  "roles": ["Citizen"],
  "permissions": ["family:read"]
}
```

#### POST `/iam/password-reset/request`
```json
// Request
{ "national_id": "TRN123456789" }

// Response 200
{ "success": true, "message": "OTP sent to your registered email", "otp_id": "uuid" }
```

#### POST `/iam/password-reset/confirm`
```json
// Request
{ "national_id": "TRN123456789", "otp": "482019", "new_password": "NewPass123!" }

// Response 200
{ "success": true, "message": "Password set successfully. You can now log in.", "user_id": "uuid" }
```

---

## 11. Error Reference

All errors follow this shape:
```json
{ "success": false, "error": { "code": "ERROR_CODE", "message": "Human readable message" } }
```

| Code | HTTP | When |
|---|---|---|
| `INVALID_CREDENTIALS` | 401 | Wrong password or national_id |
| `ACCOUNT_NOT_FOUND` | 404 | national_id not registered |
| `ACCOUNT_LOCKED` | 403 | 5+ failed logins in 15 min |
| `ACCOUNT_DISABLED` | 403 | Admin-disabled account |
| `OTP_EXPIRED` | 400 | OTP older than 10 minutes |
| `OTP_INVALID` | 400 | Wrong OTP code |
| `OTP_MAX_ATTEMPTS` | 429 | 5 wrong attempts — request new OTP |
| `PASSWORD_TOO_SHORT` | 400 | Password under 8 characters |
| `EMAIL_SERVICE_DOWN` | 503 | Email Service (3002) unreachable |
| `INTERNAL_ERROR` | 500 | Keycloak unreachable or unexpected error |
| `VALIDATION_ERROR` | 400 | Missing or malformed request fields |
