You are Opus 4.5 acting as a PRINCIPAL AUTHENTICATION ARCHITECT.

Goal: Generate the complete IAM module (Keycloak-based) that provides SSO + MFA for the SPIS platform while respecting strict data minimization. Deliver production-ready architecture, API contracts, eventing, and integration guidance with the existing family/registry service.

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
  - users: user_id (UUID PK), email (login ID), password_hash, mfa_enabled, mfa_secret, status, registry_id (FK reference only), national_id (TRN) hashed/enc, created_at, updated_at.
  - user_roles: user_id, role_name (Citizen|CaseWorker|ProgrammeManager|Admin), created_at.
  - mfa_factors: user_id, factor_type (totp|sms|email), secret/phone/email, status.
  - login_events: user_id, ip, ua, outcome, created_at.
  - password_reset_tokens: user_id, otp_code (hashed), expires_at, attempt_count.
- registry_db (owned by Registry) holds members/households; never store passwords or MFA.
- Link is registry_id (UUID) carried in both systems; national_id (TRN) may be used for lookup but not as the linkage key.

══════════════════════════════════════
3. KEYCLOAK REALM & CLIENTS
══════════════════════════════════════
- Realm: spis-prod (and spis-dev) — align aliases if an existing realm (e.g., mlss) is already provisioned.
- Clients: frontend (public PKCE), backend (confidential), api-gateway (resource server).
- Signing: RS256; JWKS endpoint (e.g., /realms/spis-dev/protocol/openid-connect/certs) fetched and cached by gateway; rotate keys with rollover.
- Token claims: sub=user_id, registry_id, roles, acr (mfa level), auth_time; ensure client mappers emit these in access tokens.
- Optional: User Federation to Supabase for credential verification if required; otherwise use Keycloak user store managed by IAM wrapper.
  - Client mappers (examples):
    - registry_id → claim registry_id (String, included in access/ID token)
    - role list → realm roles mapper to roles[]
    - acr → hardcoded "loa2" after MFA or step-up logic via auth flow
    - auth_time → built-in
  - Password policy: Argon2-hashed secrets, min length 12, block leaked passwords list, max lifetime 365 days.
- Enforce MFA (step-up) for sensitive actions; acr reflects completion.

══════════════════════════════════════
4. FLOWS
══════════════════════════════════════
A) First-time login / Password Reset (Citizen)
- User provides national_id + clicks "Reset password".
- IAM checks national_id in registry via async query/lookup API; if found & approved → send OTP via Email Service; store hashed OTP in password_reset_tokens.
- User submits OTP + new password (OTP TTL 10m, 5 attempts) → verify OTP → set password in Keycloak, enable TOTP enrollment step on next login.
- On success, create users record with registry_id link and national_id hash.
- If national_id not found → return 404 and trigger UI toast.

B) Direct login (has password)
- Standard OIDC login at Keycloak; MFA enforced if mfa_enabled or acr policy.

C) Invitation flow (Registry-driven)
- Registry emits event: CREATE_AUTH_ACCOUNT {registry_id, email, national_id_hash}.
- IAM API consumes → creates user, sends invite/OTP via Email Service.

D) Profile updates & deletion
- Registry emits USER_CONTACT_UPDATED {registry_id, email?, phone?} → IAM updates contact info used for MFA delivery (no social data).
- Registry emits USER_DELETED {registry_id} → IAM disables user, revokes sessions, anonymizes PII if policy requires.

E) Degraded mode (Email down)
- OTP/reset/invite endpoints return 503 with retry-after when Email Service is unavailable; do not block standard login for users who already have password+MFA.
- Surface email.failed events to UI for user-facing feedback; log and alert.

══════════════════════════════════════
5. API SURFACE (IAM SERVICE WRAPPER AROUND KEYCLOAK)
══════════════════════════════════════
- POST /iam/password-reset/request {national_id}: validate against registry, create otp token, send OTP.
- POST /iam/password-reset/confirm {national_id, otp, new_password}: verify OTP, set password, mark user active, require MFA setup.
- POST /iam/invite {registry_id, email, national_id_hash}: create account, send invite OTP.
- POST /iam/mfa/totp/enroll → return provisioning URI/QR; POST /iam/mfa/totp/verify {code} → enable.
- POST /iam/mfa/email/send {purpose} → send OTP via Email Service; POST /iam/mfa/email/verify {code}.
- GET /.well-known/jwks.json (Keycloak native) for gateways.

══════════════════════════════════════
6. EVENTING & CACHING
══════════════════════════════════════
- Message bus: RabbitMQ (exchange: spis.events, type=topic).
  - Bindings:
    - queue iam.registry → routing keys registry.events.USER_CONTACT_UPDATED, registry.events.USER_DELETED, registry.events.CREATE_AUTH_ACCOUNT
    - queue registry.iam → routing keys iam.events.AUTH_ACCOUNT_CREATED, iam.events.PASSWORD_RESET_REQUESTED, iam.events.MFA_ENABLED
  - Event payloads (examples):
    - CREATE_AUTH_ACCOUNT {registry_id, email, national_id_hash}
    - PASSWORD_RESET_REQUESTED {user_id, registry_id, channel=email, otp_id}
    - MFA_ENABLED {user_id, factor_type, timestamp}
- Cache: Redis maps user_id ↔ registry_id for gateway routing; TTL 24h with refresh on login; store JWKS public keys with short TTL and watch kid for rollover.

══════════════════════════════════════
7. GATEWAY VALIDATION
══════════════════════════════════════
- Gateway fetches JWKS once, caches keys; validates JWT signature, exp, iss, aud, acr locally (no DB call).
- Gateway steps: fetch JWKS (cache 15m), pin kid→pubkey, validate signature/exp/iss/aud/acr locally; on kid mismatch, refetch JWKS; reject if acr < required.
- Authorize routes by roles and acr; attach registry_id from token/Redis for downstream services; fall back to Redis cache on token mapping miss.

══════════════════════════════════════
8. SECURITY RULES
══════════════════════════════════════
- Hash national_id when stored in IAM; never log raw identifiers.
- Passwords hashed with Argon2; OTP codes stored hashed with short expiry and attempt throttling.
- Enforce device/session revocation on password reset and user deletion.
- Audit all auth events to login_events.
 - Account lockout: 5 failed login attempts → 15m lock; exponential backoff for password-reset OTP verification.
 - MFA: TOTP default, email OTP fallback; acr reflects factor strength; require step-up for sensitive APIs.
 - Key rotation: rotate realm keys quarterly; maintain dual keys during rollover; ensure gateway tracks kid.

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
 8) RabbitMQ topology (exchange, queues, bindings) and sample payloads; Redis key schema for user_id↔registry_id.
 9) Degraded-mode behavior when Email Service is unavailable (fail-fast on OTP/invite; allow existing password+MFA logins).

══════════════════════════════════════
10. STRICT CONSTRAINTS
══════════════════════════════════════
- Do NOT store registry profile data in auth_db beyond registry_id, email, national_id hash, and MFA delivery contacts.
- Do NOT redesign the existing registry schema.
- All OTP/MFA interactions must go through the standalone Email Service (or SMS provider if added later).
- Keep IAM deployable independently from the family-service.

END OF PROMPT
