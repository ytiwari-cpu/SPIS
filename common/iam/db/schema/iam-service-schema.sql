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
  CREATE TYPE otp_purpose AS ENUM ('password_reset', 'mfa_email', 'invite', 'worker_registration', 'otp_login');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- STEP 4: Create IAM service tables
-- ═══════════════════════════════════════════════════════════════

-- 1. Users
CREATE TABLE IF NOT EXISTS users (
  user_id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email               VARCHAR(255) NOT NULL UNIQUE,
  password_hash       TEXT DEFAULT NULL,            -- bcrypt hash, set via worker registration or password reset
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
-- STEP 6: RBAC — Roles, Permissions, Role-Permission mappings
-- Applied via migration 011_comprehensive_rbac_schema + 013 + 014
-- ═══════════════════════════════════════════════════════════════

-- Roles table (independent of enum, supports custom roles)
CREATE TABLE IF NOT EXISTS roles (
    role_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_name       VARCHAR(100) NOT NULL UNIQUE,
    display_name    VARCHAR(200) NOT NULL,
    description     TEXT,
    role_type       VARCHAR(50) NOT NULL DEFAULT 'custom',   -- 'system' | 'custom'
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      UUID,
    CONSTRAINT roles_type_check CHECK (role_type IN ('system', 'custom'))
);

CREATE INDEX IF NOT EXISTS idx_roles_name   ON roles (role_name);
CREATE INDEX IF NOT EXISTS idx_roles_active ON roles (is_active) WHERE is_active = true;

-- Seed system roles
INSERT INTO roles (role_name, display_name, description, role_type) VALUES
    ('SuperAdmin',       'Super Administrator', 'Full system access with all permissions',          'system'),
    ('Admin',            'Administrator',       'System administrator with management access',      'system'),
    ('ProgrammeManager', 'Programme Manager',   'Staff managing social protection programmes',      'system'),
    ('CaseWorker',       'Case Worker',         'Staff managing citizen cases and applications',    'system'),
    ('Citizen',          'Citizen',             'Regular citizens accessing the portal',            'system')
ON CONFLICT (role_name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description  = EXCLUDED.description,
    role_type    = EXCLUDED.role_type;

-- Permissions catalog
CREATE TABLE IF NOT EXISTS permissions (
    permission_key   VARCHAR(100) PRIMARY KEY,               -- e.g. 'ADMIN.FAMILIES.VIEW'
    permission_name  VARCHAR(200) NOT NULL,
    description      TEXT,
    module           VARCHAR(50) NOT NULL DEFAULT 'admin',   -- 'admin', 'programme', 'citizen', 'system'
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions (module);

-- Role ↔ Permission mapping
CREATE TABLE IF NOT EXISTS role_permissions (
    role_name      VARCHAR(100) NOT NULL REFERENCES roles(role_name) ON DELETE CASCADE,
    permission_key VARCHAR(100) NOT NULL REFERENCES permissions(permission_key) ON DELETE CASCADE,
    granted_by     VARCHAR(100) DEFAULT 'system',
    granted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (role_name, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions (role_name);
CREATE INDEX IF NOT EXISTS idx_role_permissions_perm ON role_permissions (permission_key);

-- Per-user permission overrides (grant/revoke individual permissions)
CREATE TABLE IF NOT EXISTS user_permissions (
    user_id        UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    permission_key VARCHAR(100) NOT NULL REFERENCES permissions(permission_key) ON DELETE CASCADE,
    granted        BOOLEAN NOT NULL DEFAULT true,    -- false = explicit deny
    granted_by     UUID,
    granted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, permission_key)
);

-- Audit logs (immutable — never UPDATE or DELETE)
CREATE TABLE IF NOT EXISTS audit_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_sub       VARCHAR(255),
    actor_email     VARCHAR(255),
    actor_roles     TEXT[],
    action          VARCHAR(100) NOT NULL,
    method          VARCHAR(10)  NOT NULL,
    path            VARCHAR(500) NOT NULL,
    resource_type   VARCHAR(100),
    resource_id     VARCHAR(255),
    status_code     INTEGER NOT NULL,
    request_id      VARCHAR(100),
    ip_address      VARCHAR(45),
    user_agent      TEXT,
    request_summary  JSONB,
    response_summary JSONB,
    duration_ms     INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_created   ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor     ON audit_logs (actor_sub);
CREATE INDEX IF NOT EXISTS idx_audit_action    ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_resource  ON audit_logs (resource_type, resource_id);

COMMENT ON TABLE audit_logs IS 'Immutable audit log — NEVER DELETE or UPDATE rows';

-- Import jobs tracking
DO $$ BEGIN
    CREATE TYPE import_status AS ENUM ('PENDING', 'VALIDATING', 'VALIDATED', 'IMPORTING', 'COMPLETED', 'FAILED', 'PARTIAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS import_jobs (
    job_id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource_type       VARCHAR(100) NOT NULL,
    file_name           VARCHAR(500) NOT NULL,
    file_size           INTEGER,
    status              import_status NOT NULL DEFAULT 'PENDING',
    total_rows          INTEGER DEFAULT 0,
    valid_rows          INTEGER DEFAULT 0,
    error_rows          INTEGER DEFAULT 0,
    validation_errors   JSONB,
    imported_count      INTEGER DEFAULT 0,
    skipped_count       INTEGER DEFAULT 0,
    updated_count       INTEGER DEFAULT 0,
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    uploaded_by         UUID,
    uploaded_by_email   VARCHAR(255),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- DONE! IAM service database ready.
-- ═══════════════════════════════════════════════════════════════
