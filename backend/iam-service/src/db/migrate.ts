/**
 * SPIS IAM Service — Database Migration
 *
 * Creates the auth_db schema:
 *   - users
 *   - user_roles
 *   - mfa_factors
 *   - login_events
 *   - password_reset_tokens
 *
 * All statements use IF NOT EXISTS for idempotent re-runs.
 */

import 'dotenv/config'
import { pool } from './pool.js'

const SCHEMA = `
-- ═══════════════════════════════════════════════════════════════
-- EXTENSIONS
-- ═══════════════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ═══════════════════════════════════════════════════════════════
-- ENUM TYPES
-- ═══════════════════════════════════════════════════════════════
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

-- ═══════════════════════════════════════════════════════════════
-- USERS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS users (
  user_id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email               VARCHAR(255) NOT NULL UNIQUE,
  mfa_enabled         BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_secret          TEXT,                                 -- encrypted TOTP secret
  status              user_status NOT NULL DEFAULT 'pending',
  registry_id         TEXT,                                 -- link key to registry (member UUID or national ID fallback)
  national_id_hash    TEXT,                                 -- hashed TRN
  failed_login_attempts INT NOT NULL DEFAULT 0,
  locked_until        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_registry_id ON users (registry_id);
CREATE INDEX IF NOT EXISTS idx_users_national_id_hash ON users (national_id_hash);

-- Ensure compatibility with older deployments where registry_id was UUID
DO $$ BEGIN
  ALTER TABLE users
    ALTER COLUMN registry_id TYPE TEXT USING registry_id::text;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- USER_ROLES
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_roles (
  user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  role_name   role_name NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, role_name)
);

-- ═══════════════════════════════════════════════════════════════
-- MFA_FACTORS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS mfa_factors (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  factor_type  mfa_factor_type NOT NULL,
  secret       TEXT,           -- TOTP secret (encrypted)
  phone        VARCHAR(20),    -- for SMS factor
  email        VARCHAR(255),   -- for email factor
  status       mfa_factor_status NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mfa_factors_user ON mfa_factors (user_id);

-- ═══════════════════════════════════════════════════════════════
-- LOGIN_EVENTS  (audit log)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS login_events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  ip          VARCHAR(45) NOT NULL,
  user_agent  TEXT NOT NULL DEFAULT '',
  outcome     login_outcome NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_events_user ON login_events (user_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- PASSWORD_RESET_TOKENS  (OTP codes — hashed)
-- ═══════════════════════════════════════════════════════════════
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

-- ═══════════════════════════════════════════════════════════════
-- UTILITY FUNCTIONS
-- ═══════════════════════════════════════════════════════════════

-- Cleanup expired OTP tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM password_reset_tokens
  WHERE expires_at < NOW() OR used = TRUE;
END;
$$ LANGUAGE plpgsql;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
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
`

async function migrate() {
  console.log('🔄 Running IAM auth_db migration...')

  try {
    await pool.query(SCHEMA)
    console.log('✅ Migration complete — all tables created.')
  } catch (err) {
    console.error('❌ Migration failed:', err)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

migrate()
