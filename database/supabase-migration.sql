-- ═══════════════════════════════════════════════════════════════
-- STEP 1: Run this FIRST in Supabase SQL Editor
-- Go to: https://supabase.com/dashboard → Your Project → SQL Editor
-- Paste and run this entire file
-- ═══════════════════════════════════════════════════════════════

-- Create the exec_sql function (for SELECT queries - returns JSON rows)
CREATE OR REPLACE FUNCTION public.exec_sql(query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  EXECUTE 'SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (' || query || ') t'
  INTO result;
  RETURN result;
END;
$$;

-- Create the exec_ddl function (for INSERT/UPDATE/DELETE/CREATE - no return)
CREATE OR REPLACE FUNCTION public.exec_ddl(query text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE query;
END;
$$;

-- Grant access to the service_role (used by our backend services)
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.exec_ddl(text) TO service_role;

-- Verify it works
SELECT public.exec_sql('SELECT 1 as ok');

-- ═══════════════════════════════════════════════════════════════
-- STEP 2: Email Service Tables
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

-- Seed default templates
INSERT INTO template_versions (template_code, version, locale, subject, body) VALUES
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
('invite', 1, 'en',
 'You''re Invited to SPIS Jamaica',
 '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
  <h2 style="color:#1a56db">SPIS Jamaica</h2>
  <p>You have been invited to join the Social Protection Information System.</p>
  <p>Click the link below to get started:</p>
  <a href="{{invite_link}}" style="display:inline-block;padding:12px 24px;background:#1a56db;color:#fff;text-decoration:none;border-radius:6px;margin:16px 0">Accept Invitation</a>
  <p style="color:#6b7280;font-size:12px">If you did not expect this invitation, please ignore this email.</p>
</div>'),
('notification', 1, 'en',
 '{{subject}}',
 '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
  <h2 style="color:#1a56db">SPIS Jamaica</h2>
  {{{content}}}
  <p style="color:#6b7280;font-size:12px;margin-top:20px">This is an automated notification from the SPIS platform.</p>
</div>'),
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

-- Cleanup functions
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits() RETURNS void AS $$
BEGIN
  DELETE FROM rate_limits WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

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


-- ═══════════════════════════════════════════════════════════════
-- STEP 3: IAM Service Tables
-- ═══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ENUM TYPES
DO $$ BEGIN
  CREATE TYPE user_status AS ENUM ('pending', 'active', 'locked', 'disabled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE role_name AS ENUM ('Citizen', 'CaseWorker', 'ProgrammeManager', 'Admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE mfa_factor_type AS ENUM ('totp', 'sms', 'email');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE mfa_factor_status AS ENUM ('pending', 'active', 'disabled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE login_outcome AS ENUM ('success', 'fail_password', 'fail_mfa', 'fail_locked', 'fail_disabled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE otp_purpose AS ENUM ('password_reset', 'mfa_email', 'invite');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- USERS
CREATE TABLE IF NOT EXISTS users (
  user_id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email               VARCHAR(255) NOT NULL UNIQUE,

  mfa_enabled         BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_secret          TEXT,
  status              user_status NOT NULL DEFAULT 'pending',
  registry_id         TEXT,
  national_id_hash    TEXT,
  failed_login_attempts INT NOT NULL DEFAULT 0,
  locked_until        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_registry_id ON users (registry_id);
CREATE INDEX IF NOT EXISTS idx_users_national_id_hash ON users (national_id_hash);

-- USER_ROLES
CREATE TABLE IF NOT EXISTS user_roles (
  user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  role_name   role_name NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, role_name)
);

-- MFA_FACTORS
CREATE TABLE IF NOT EXISTS mfa_factors (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  factor_type  mfa_factor_type NOT NULL,
  secret       TEXT,
  phone        VARCHAR(20),
  email        VARCHAR(255),
  status       mfa_factor_status NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mfa_factors_user ON mfa_factors (user_id);

-- LOGIN_EVENTS
CREATE TABLE IF NOT EXISTS login_events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  ip          VARCHAR(45) NOT NULL,
  user_agent  TEXT NOT NULL DEFAULT '',
  outcome     login_outcome NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_events_user ON login_events (user_id, created_at DESC);

-- PASSWORD_RESET_TOKENS
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  otp_hash      TEXT NOT NULL,
  purpose       otp_purpose NOT NULL DEFAULT 'password_reset',
  expires_at    TIMESTAMPTZ NOT NULL,
  attempt_count INT NOT NULL DEFAULT 0,
  max_attempts  INT NOT NULL DEFAULT 5,
  used          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prt_user ON password_reset_tokens (user_id, purpose, created_at DESC);

-- UTILITY FUNCTIONS
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM password_reset_tokens
  WHERE expires_at < NOW() OR used = TRUE;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
DO $$ BEGIN
  CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_mfa_factors_updated_at
    BEFORE UPDATE ON mfa_factors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- DONE! All tables created for email-service and iam-service
-- ═══════════════════════════════════════════════════════════════
