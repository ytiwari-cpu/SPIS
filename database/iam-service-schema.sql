-- ═══════════════════════════════════════════════════════════════
-- IAM SERVICE DATABASE SCHEMA
-- Supabase Project: wrxrstmncezssrscrkxs
-- Run this in: https://supabase.com/dashboard/project/wrxrstmncezssrscrkxs/sql/new
-- ═══════════════════════════════════════════════════════════════

-- STEP 1: Create helper functions for REST API adapter
-- ═══════════════════════════════════════════════════════════════

-- exec_sql: For SELECT queries (returns JSON rows)
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

-- exec_ddl: For INSERT/UPDATE/DELETE/CREATE (no return value)
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

-- Grant access to service_role
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.exec_ddl(text) TO service_role;

-- Verify functions work
SELECT public.exec_sql('SELECT 1 as ok, ''functions_created'' as status');


-- STEP 2: Enable extensions
-- ═══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- STEP 3: Create enum types
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


-- STEP 4: Create IAM service tables
-- ═══════════════════════════════════════════════════════════════

-- 1. Users
CREATE TABLE IF NOT EXISTS users (
  user_id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email               VARCHAR(255) NOT NULL UNIQUE,
  password_hash       TEXT NOT NULL DEFAULT '',
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

-- 2. User Roles
CREATE TABLE IF NOT EXISTS user_roles (
  user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  role_name   role_name NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, role_name)
);

-- 3. MFA Factors
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

-- 4. Login Events
CREATE TABLE IF NOT EXISTS login_events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  ip          VARCHAR(45) NOT NULL,
  user_agent  TEXT NOT NULL DEFAULT '',
  outcome     login_outcome NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_events_user ON login_events (user_id, created_at DESC);

-- 5. Password Reset Tokens
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


-- STEP 5: Utility functions and triggers
-- ═══════════════════════════════════════════════════════════════

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

-- Apply triggers
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
-- DONE! IAM service database ready.
-- ═══════════════════════════════════════════════════════════════
