# Testing Guide — SPIS Email Service

This guide explains how to verify the Email Service locally using the provided integration tools.

## 1. Prerequisites

Ensure the following infrastructure is running on your machine:
- **PostgreSQL**: Accessible at the URL in your `.env` (default: `localhost:5432`)
- **RabbitMQ**: Accessible at the URL in your `.env` (default: `localhost:5672`)

## 2. Environment Setup

Copy the example configuration and add your provider credentials:

```bash
cd backend/email-service
cp .env.example .env
```

Edit `.env` and provide at least one of:
- `SENDGRID_API_KEY`
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`

## 3. Launching the Service

Open three terminal windows to run components in parallel:

### Terminal A: Database & Setup
Initialize the schema and seed templates:
```bash
npm run migrate
```

### Terminal B: API Server
Start the Express REST API (records requests to DB and queues them):
```bash
npm run dev
```

### Terminal C: Queue Worker
Start the consumer (processes delivery via SendGrid/SMTP):
```bash
npm run worker:dev
```

---

## 4. Running Integration Tests

With the API and Worker running, use the automated test script to verify all core features:

```bash
# From /backend/email-service
npx tsx src/scripts/test-api.ts
```

### What this script tests:
1.  **Health Probes**: Verifies `/healthz` and `/readyz` (DB + Provider status).
2.  **OTP Flow**: Queues an OTP email and checks for a `202 Accepted` response.
3.  **Idempotency**: Sends the same `request_id` twice; ensures the second call matches the first without double-sending.
4.  **Registration Invites**: Tests the `/email/invite` endpoint with family merge variables.
5.  **General Notifications**: Tests generic template rendering.
6.  **Rate Limiting**: Attempts to flood the OTP endpoint to trigger a `429 Too Many Requests` error.

---

## 5. Verification Checklist

- [ ] **API Response**: `test-api.ts` should report `✅ All API tests completed successfully!`.
- [ ] **Worker Logs**: The worker terminal should show `Rendering template...` followed by `Email sent successfully`.
- [ ] **Database Audit**: Run `SELECT * FROM email_requests ORDER BY created_at DESC;` to see the full audit trail and delivery status.
- [ ] **Inbox**: If you used a real email address in `test-api.ts`, check your inbox for the rendered templates.
