You are Opus 4.6 acting as a PRINCIPAL PLATFORM ENGINEER.

Goal: Generate a standalone Email Service used by IAM (OTP, invites) and other SPIS modules. Produce production-ready architecture, API contracts, event handling, and observability. This service must stay independent and reusable.

══════════════════════════════════════
1. SCOPE
══════════════════════════════════════
- Outbound email delivery for OTP, invitations, notifications.
- Works for IAM password reset/MFA, Registry notices, future modules.
- Provides both REST endpoints and async consumption from a message bus.

══════════════════════════════════════
2. ARCHITECTURE
══════════════════════════════════════
- Components: API layer, worker/queue processor, provider adapters (SendGrid primary, SMTP fallback), template renderer, rate limiter, audit logger.
- Message bus: RabbitMQ (exchange: spis.events, type=topic) with queues/bindings:
	- queue email.send → routing key email.send
	- queue email.sent.audit → routing key email.sent
	- queue email.failed.alerts → routing key email.failed
- Templates: stored versioned in DB or disk with i18n placeholders; variables include otp_code, expiry, product, locale.
- Idempotency: dedupe by request_id with short TTL to avoid double sends.

══════════════════════════════════════
3. DATA MODEL (email_db)
══════════════════════════════════════
- email_requests: request_id (UUID PK), to_email, template_code, payload_json, status (queued|sent|failed), attempts, last_error, created_at, sent_at.
- email_providers: provider_name, status, last_heartbeat.
- bounce_feedback: message_id, to_email, reason, received_at.
- rate_limits: key (ip|email|purpose), window, count, expires_at.
 - template_versions: template_code, version, locale, subject, body, created_at, deprecated_at.

══════════════════════════════════════
4. APIS
══════════════════════════════════════
- POST /email/otp {to_email, otp_code, expires_at, locale, purpose, request_id?}
- POST /email/invite {to_email, invite_link, locale, request_id?}
- POST /email/notify {to_email, template_code, variables, request_id?}
- Health: GET /healthz (liveness), /readyz (provider check).
- Webhooks: /events/provider/bounce, /events/provider/delivery for SendGrid callbacks (verify signature header, reject if invalid).

══════════════════════════════════════
5. QUEUE WORKFLOW
══════════════════════════════════════
- API enqueues to email.send with payload; worker pulls, renders template, chooses active provider with fallback; publishes email.sent or email.failed.
- Retries with exponential backoff; max attempts configurable.
- Provider selection: SendGrid primary with SMTP fallback and circuit-breaker on failures; mark provider down after N consecutive failures and auto-heal after cooldown.

══════════════════════════════════════
6. SECURITY & COMPLIANCE
══════════════════════════════════════
- Store only minimal PII (email address + template variables); purge payloads after retention window.
- Sign webhooks; validate provider signatures.
- Rate-limit OTP/invite sends by email and purpose; throttle brute force.
- Log structured events; no secrets/OTP values in logs (mask sensitive fields).
 - Rate limits (suggested defaults): 5 OTP sends per email per hour, 3 invites per email per day; return 429 on breach.
 - Secrets: SendGrid API key and SMTP credentials via env/secret manager; rotate quarterly; never log provider responses with PII.
- Free tier ops: assume SendGrid free quota (e.g., ~100/day); apply global rate cap, queue spillover with backoff, and surface 429/503 gracefully when quota is exhausted.

══════════════════════════════════════
7. OBSERVABILITY
══════════════════════════════════════
- Metrics: sends, failures, latency, bounce rate, provider success %, queue depth.
- Traces: include request_id through API → queue → provider.
- Alerts: high failure rate, queue backlog, provider down, webhook errors.
 - Dashboards: per-provider success %, top templates, rate-limit hits; SLO suggestion: 99% send success (provider accepted) within 30s.

══════════════════════════════════════
8. DELIVERABLES ORDER
══════════════════════════════════════
1) High-level diagram (API, queue, worker, providers, DB, bus).
2) DB schema and migrations for email_db.
3) REST + message contracts for otp/invite/notify and provider callbacks.
4) Template structure with i18n and versioning guidance.
5) Provider adapter interface + fallback logic.
6) Ops runbook: rotation of SMTP/API keys, handling bounces/blocks, rate-limit tuning.
 7) RabbitMQ topology (exchange, queues, bindings) and sample payloads for email.send/email.sent/email.failed.

══════════════════════════════════════
9. INTEGRATION WITH IAM
══════════════════════════════════════
- IAM calls POST /email/otp or emits email.send with template_code=iam_otp via RabbitMQ; Email Service sends through SendGrid (or fallback) and reports status via events.
- IAM listens to email.failed for user-facing error paths.

END OF PROMPT
