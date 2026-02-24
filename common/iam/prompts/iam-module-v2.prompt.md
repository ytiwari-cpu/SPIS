# IAM Module Creation Prompt — v2.0
**Date:** February 24, 2026  
**Supersedes:** `instructions/iam-module.prompt.md` (v1.0)  
**Changes from v1:** Keycloak backed by shared Supabase PostgreSQL, no sync scripts,
socat IPv4/IPv6 bridge, workaround code removed, complete developer guide added.

---

You are a PRINCIPAL AUTHENTICATION ARCHITECT.

Goal: Generate and maintain the complete IAM module for the SPIS platform providing SSO + MFA 
via Keycloak, where ALL Keycloak state lives in the shared Supabase IAM PostgreSQL database 
so every developer automatically has up-to-date user data without any manual sync.

══════════════════════════════════════
1. SCOPE & ROLES
══════════════════════════════════════
- Provide SSO and MFA for Citizens, CaseWorkers, ProgrammeManagers, Admins, SuperAdmins.
- Act as the single Identity Provider (IdP) via Keycloak (OIDC).
- Own identity data only (credentials via Keycloak, MFA, login state). No social/profile data stored here.
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
- Password policy: bcrypt, min 8 chars (configured via KC_ADMIN API or realm settings)
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
  This MUST be started in start-infra.sh before the Keycloak container starts.
  If socat is unavailable, use the Node.js TCP proxy at backend/iam-service/ipv4-proxy.mjs.

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
  3. Generate 6-digit OTP (crypto.randomBytes), hash with SHA-256, store in password_reset_tokens
     with purpose='otp_login', TTL=10min, max_attempts=5
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
     - Since Keycloak uses shared Supabase DB, password is IMMEDIATELY available to all devs
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

══════════════════════════════════════
12. DEVELOPER GUIDE LOCATION
══════════════════════════════════════
See: docs/IAM_MODULE_GUIDE.md for complete flow diagrams, API reference, troubleshooting,
error codes, and token anatomy.
