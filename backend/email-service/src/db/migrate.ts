/**
 * SPIS Email Service — Database Migration Runner
 *
 * Creates all tables for email_db if they don't exist.
 * Run with: npx tsx src/db/migrate.ts
 */

import 'dotenv/config'
import { pool } from './pool.js'

const MIGRATION_SQL = `
-- ═══════════════════════════════════════════════════════════════
-- email_db schema — SPIS Email Service
-- ═══════════════════════════════════════════════════════════════

-- 1. Email Requests — main outbox table
CREATE TABLE IF NOT EXISTS email_requests (
  request_id      UUID PRIMARY KEY,
  to_email        VARCHAR(320) NOT NULL,
  template_code   VARCHAR(100) NOT NULL,
  payload_json    JSONB NOT NULL DEFAULT '{}',
  status          VARCHAR(20) NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued','processing','sent','failed')),
  attempts        INT NOT NULL DEFAULT 0,
  last_error      TEXT,
  provider_used   VARCHAR(50),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_email_requests_status   ON email_requests (status);
CREATE INDEX IF NOT EXISTS idx_email_requests_to_email ON email_requests (to_email);
CREATE INDEX IF NOT EXISTS idx_email_requests_created  ON email_requests (created_at);

-- 2. Email Providers — registry + health
CREATE TABLE IF NOT EXISTS email_providers (
  provider_name         VARCHAR(50) PRIMARY KEY,
  status                VARCHAR(20) NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','down','cooldown')),
  consecutive_failures  INT NOT NULL DEFAULT 0,
  last_heartbeat        TIMESTAMPTZ,
  cooldown_until        TIMESTAMPTZ
);

-- Seed default providers
INSERT INTO email_providers (provider_name, status)
VALUES ('sendgrid', 'active'), ('smtp', 'active')
ON CONFLICT (provider_name) DO NOTHING;

-- 3. Bounce Feedback — webhook data
CREATE TABLE IF NOT EXISTS bounce_feedback (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id    VARCHAR(255) NOT NULL,
  to_email      VARCHAR(320) NOT NULL,
  reason        TEXT NOT NULL,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bounce_to_email ON bounce_feedback (to_email);

-- 4. Rate Limits — sliding window counters
CREATE TABLE IF NOT EXISTS rate_limits (
  key           VARCHAR(255) NOT NULL,
  window_start  TIMESTAMPTZ NOT NULL,
  count         INT NOT NULL DEFAULT 0,
  expires_at    TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits (expires_at);

-- 5. Template Versions — email templates with i18n
CREATE TABLE IF NOT EXISTS template_versions (
  template_code   VARCHAR(100) NOT NULL,
  version         INT NOT NULL,
  locale          VARCHAR(10) NOT NULL DEFAULT 'en',
  subject         TEXT NOT NULL,
  body            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deprecated_at   TIMESTAMPTZ,
  PRIMARY KEY (template_code, version, locale)
);

-- ═══════════════════════════════════════════════════════════════
-- Seed default templates
-- ═══════════════════════════════════════════════════════════════

INSERT INTO template_versions (template_code, version, locale, subject, body) VALUES
-- OTP template
('iam_otp', 1, 'en',
 'Your SPIS Verification Code',
 '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
  <h2 style="color:#1a56db">SPIS Jamaica</h2>
  <p>Your one-time verification code is:</p>
  <div style="background:#f3f4f6;padding:20px;text-align:center;border-radius:8px;margin:20px 0">
    <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#1a56db">{{otp_code}}</span>
  </div>
  <p>This code expires at <strong>{{expires_at}}</strong>.</p>
  <p style="color:#6b7280;font-size:12px">If you did not request this code, please ignore this email.</p>
</div>'),
-- Invite template
('invite', 1, 'en',
 'You''re Invited to SPIS Jamaica',
 '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
  <h2 style="color:#1a56db">SPIS Jamaica</h2>
  <p>You have been invited to join the Social Protection Information System.</p>
  <p>Click the link below to get started:</p>
  <a href="{{invite_link}}" style="display:inline-block;padding:12px 24px;background:#1a56db;color:#fff;text-decoration:none;border-radius:6px;margin:16px 0">Accept Invitation</a>
  <p style="color:#6b7280;font-size:12px">If you did not expect this invitation, please ignore this email.</p>
</div>'),
-- Generic notification template
('notification', 1, 'en',
 '{{subject}}',
 '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
  <h2 style="color:#1a56db">SPIS Jamaica</h2>
  {{{content}}}
  <p style="color:#6b7280;font-size:12px;margin-top:20px">This is an automated notification from the SPIS platform.</p>
</div>'),
-- Password reset
('password_reset', 1, 'en',
 'Reset Your SPIS Password',
 '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
  <h2 style="color:#1a56db">SPIS Jamaica</h2>
  <p>We received a request to reset your password.</p>
  <p>Your reset code is:</p>
  <div style="background:#f3f4f6;padding:20px;text-align:center;border-radius:8px;margin:20px 0">
    <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#1a56db">{{otp_code}}</span>
  </div>
  <p>This code expires at <strong>{{expires_at}}</strong>.</p>
  <p style="color:#6b7280;font-size:12px">If you did not request a password reset, please ignore this email.</p>
</div>')
ON CONFLICT (template_code, version, locale) DO NOTHING;

-- Cleanup function for expired rate-limit rows
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits() RETURNS void AS $$
BEGIN
  DELETE FROM rate_limits WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Cleanup function for old payloads (data retention)
CREATE OR REPLACE FUNCTION purge_old_payloads(retention_days INT DEFAULT 30) RETURNS INT AS $$
DECLARE
  deleted INT;
BEGIN
  UPDATE email_requests
  SET payload_json = '{}'::jsonb
  WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL
    AND payload_json != '{}'::jsonb;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$ LANGUAGE plpgsql;
`

async function migrate() {
  console.log('[MIGRATE] Running email_db migrations...')
  try {
    // Split migration into individual statements for Supabase REST compatibility
    const statements = MIGRATION_SQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0)

    for (const stmt of statements) {
      try {
        await pool.query(stmt)
      } catch (err) {
        // Ignore "already exists" errors for idempotent migrations
        const msg = err instanceof Error ? err.message : String(err)
        if (!msg.includes('already exists') && !msg.includes('duplicate')) {
          console.error(`[MIGRATE] Statement failed: ${stmt.slice(0, 80)}...`)
          throw err
        }
      }
    }

    console.log('[MIGRATE] ✅ All tables created / seeded successfully.')
  } catch (err) {
    console.error('[MIGRATE] ❌ Migration failed:', err)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

migrate()
