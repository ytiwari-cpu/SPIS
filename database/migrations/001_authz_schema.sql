-- ============================================================================
-- SPIS Authorization Schema (Greenfield)
-- ============================================================================
-- 
-- This is a FRESH schema designed from scratch for permission-based RBAC.
-- 
-- CRITICAL PRINCIPLES:
-- 1. Authorization checks PERMISSIONS only, never role names
-- 2. Role names are labels only — can be renamed/removed freely
-- 3. No hard deletes — use soft delete with deprecation flags
-- 4. Audit everything security-related
-- 
-- Apply order:
--   001_base_schema.sql       (this file)
--   002_seed_permissions.sql  (permission registry)
--   003_seed_roles.sql        (default roles with permissions)
--   004_app_tables.sql        (domain-specific tables)
-- 
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- SCHEMA: authz (Authorization)
-- ────────────────────────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS authz;

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE: authz.permission
-- 
-- Single source of truth for all permission codes.
-- Permissions follow: SECTION.RESOURCE.ACTION pattern
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE authz.permission (
    -- Primary key: permission code itself (e.g., 'ADMIN.FAMILIES.VIEW')
    code        VARCHAR(100) PRIMARY KEY,
    
    -- Human-readable display
    label       VARCHAR(200) NOT NULL,
    description TEXT,
    
    -- Categorization for UI grouping
    module      VARCHAR(50) NOT NULL,  -- e.g., 'ADMIN', 'CITIZEN'
    resource    VARCHAR(50) NOT NULL,  -- e.g., 'FAMILIES', 'USERS'
    action      VARCHAR(50) NOT NULL,  -- e.g., 'VIEW', 'CREATE', 'EDIT', 'DELETE'
    
    -- Lifecycle management (never hard delete permissions)
    is_active       BOOLEAN NOT NULL DEFAULT true,
    deprecated_at   TIMESTAMPTZ,
    deprecated_by   UUID,
    deprecation_reason TEXT,
    
    -- Metadata
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT permission_code_format CHECK (
        code ~ '^[A-Z][A-Z0-9_]*\.[A-Z][A-Z0-9_]*\.[A-Z][A-Z0-9_]*$'
    )
);

-- Index for module-based queries (sidebar grouping)
CREATE INDEX idx_permission_module ON authz.permission(module);
CREATE INDEX idx_permission_active ON authz.permission(is_active) WHERE is_active = true;

COMMENT ON TABLE authz.permission IS 'Permission registry - single source of truth for all permission codes';
COMMENT ON COLUMN authz.permission.code IS 'Unique permission key: MODULE.RESOURCE.ACTION (UPPERCASE)';
COMMENT ON COLUMN authz.permission.is_active IS 'Soft delete - set false to deprecate, never hard delete';

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE: authz.role
-- 
-- Role definitions. Role NAMES are labels only — never used for authorization.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE authz.role (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Role identifier (for API/display, NOT for authorization)
    name        VARCHAR(100) NOT NULL UNIQUE,
    
    -- Human-readable display
    label       VARCHAR(200) NOT NULL,
    description TEXT,
    
    -- Role type for UI categorization
    role_type   VARCHAR(50) NOT NULL DEFAULT 'custom',  -- 'system', 'custom'
    
    -- Lifecycle
    is_active   BOOLEAN NOT NULL DEFAULT true,
    
    -- Metadata
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by  UUID
);

CREATE INDEX idx_role_active ON authz.role(is_active) WHERE is_active = true;
CREATE INDEX idx_role_type ON authz.role(role_type);

COMMENT ON TABLE authz.role IS 'Role definitions - names are labels only, never used for authorization';
COMMENT ON COLUMN authz.role.name IS 'Role identifier for API/display - NEVER use for access control';

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE: authz.role_permission
-- 
-- Many-to-many: which permissions each role has.
-- This is what actually controls access.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE authz.role_permission (
    role_id         UUID NOT NULL REFERENCES authz.role(id) ON DELETE CASCADE,
    permission_code VARCHAR(100) NOT NULL REFERENCES authz.permission(code) ON DELETE CASCADE,
    
    -- Audit trail
    granted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    granted_by  UUID,
    
    PRIMARY KEY (role_id, permission_code)
);

CREATE INDEX idx_role_permission_role ON authz.role_permission(role_id);
CREATE INDEX idx_role_permission_perm ON authz.role_permission(permission_code);

COMMENT ON TABLE authz.role_permission IS 'Mapping of permissions to roles - THIS is what controls access';

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE: authz.app_user
-- 
-- Application user records linked to Keycloak subject (sub).
-- Stores additional app-specific data, not auth credentials.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE authz.app_user (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Link to identity provider (Keycloak subject)
    keycloak_sub    VARCHAR(255) UNIQUE,  -- sub claim from JWT
    
    -- Alternative identifiers
    national_id     VARCHAR(20) UNIQUE,
    email           VARCHAR(255),
    
    -- Profile (synced from Keycloak or editable)
    display_name    VARCHAR(200),
    phone           VARCHAR(20),
    
    -- Account status
    status          VARCHAR(20) NOT NULL DEFAULT 'active',  -- active, suspended, pending
    
    -- Tenant support (optional, for multi-tenancy)
    tenant_id       UUID,
    
    -- Metadata
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at   TIMESTAMPTZ,
    
    CONSTRAINT app_user_status_check CHECK (
        status IN ('active', 'suspended', 'pending', 'deleted')
    )
);

CREATE INDEX idx_app_user_keycloak ON authz.app_user(keycloak_sub);
CREATE INDEX idx_app_user_national_id ON authz.app_user(national_id);
CREATE INDEX idx_app_user_email ON authz.app_user(email);
CREATE INDEX idx_app_user_status ON authz.app_user(status);
CREATE INDEX idx_app_user_tenant ON authz.app_user(tenant_id) WHERE tenant_id IS NOT NULL;

COMMENT ON TABLE authz.app_user IS 'Application users - linked to Keycloak via sub claim';

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE: authz.user_role
-- 
-- Many-to-many: which roles each user has.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE authz.user_role (
    user_id     UUID NOT NULL REFERENCES authz.app_user(id) ON DELETE CASCADE,
    role_id     UUID NOT NULL REFERENCES authz.role(id) ON DELETE CASCADE,
    
    -- Audit trail
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    assigned_by UUID,
    
    -- Optional: role assignment expiry
    expires_at  TIMESTAMPTZ,
    
    PRIMARY KEY (user_id, role_id)
);

CREATE INDEX idx_user_role_user ON authz.user_role(user_id);
CREATE INDEX idx_user_role_role ON authz.user_role(role_id);
CREATE INDEX idx_user_role_expires ON authz.user_role(expires_at) WHERE expires_at IS NOT NULL;

COMMENT ON TABLE authz.user_role IS 'User-to-role assignments';

-- ════════════════════════════════════════════════════════════════════════════
-- VIEW: authz.v_user_permissions
-- 
-- Effective permissions for each user (derived from their roles).
-- This is what the backend should query for authorization.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW authz.v_user_permissions AS
SELECT DISTINCT
    u.id AS user_id,
    u.keycloak_sub,
    u.national_id,
    p.code AS permission_code,
    p.module,
    p.resource,
    p.action
FROM authz.app_user u
JOIN authz.user_role ur ON ur.user_id = u.id
    AND (ur.expires_at IS NULL OR ur.expires_at > now())
JOIN authz.role r ON r.id = ur.role_id AND r.is_active = true
JOIN authz.role_permission rp ON rp.role_id = r.id
JOIN authz.permission p ON p.code = rp.permission_code AND p.is_active = true;

COMMENT ON VIEW authz.v_user_permissions IS 'Effective permissions per user - use for authorization queries';

-- ════════════════════════════════════════════════════════════════════════════
-- FUNCTION: authz.get_user_permissions(user_uuid)
-- 
-- Returns array of permission codes for a user.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION authz.get_user_permissions(p_user_id UUID)
RETURNS TEXT[] AS $$
    SELECT COALESCE(array_agg(DISTINCT permission_code), ARRAY[]::TEXT[])
    FROM authz.v_user_permissions
    WHERE user_id = p_user_id;
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION authz.get_user_permissions IS 'Get all effective permissions for a user';

-- ════════════════════════════════════════════════════════════════════════════
-- FUNCTION: authz.get_user_permissions_by_sub(keycloak_sub)
-- 
-- Same but using Keycloak sub claim (what the JWT contains).
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION authz.get_user_permissions_by_sub(p_keycloak_sub VARCHAR)
RETURNS TEXT[] AS $$
    SELECT COALESCE(array_agg(DISTINCT permission_code), ARRAY[]::TEXT[])
    FROM authz.v_user_permissions
    WHERE keycloak_sub = p_keycloak_sub;
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION authz.get_user_permissions_by_sub IS 'Get permissions using Keycloak sub claim';

-- ════════════════════════════════════════════════════════════════════════════
-- FUNCTION: authz.has_permission(user_uuid, permission_code)
-- 
-- Check if user has a specific permission.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION authz.has_permission(p_user_id UUID, p_permission VARCHAR)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM authz.v_user_permissions
        WHERE user_id = p_user_id AND permission_code = p_permission
    );
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION authz.has_permission IS 'Check if user has specific permission';

-- ────────────────────────────────────────────────────────────────────────────
-- SCHEMA: audit (Security Event Logging)
-- ────────────────────────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS audit;

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE: audit.security_log
-- 
-- Immutable log of all security-related events.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE audit.security_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Event classification
    event_type      VARCHAR(50) NOT NULL,  -- LOGIN, LOGOUT, PERMISSION_GRANT, etc.
    event_category  VARCHAR(50) NOT NULL DEFAULT 'AUTH',  -- AUTH, AUTHZ, ADMIN
    severity        VARCHAR(20) NOT NULL DEFAULT 'INFO',  -- DEBUG, INFO, WARN, ERROR, CRITICAL
    
    -- Actor (who performed the action)
    actor_id        UUID,
    actor_type      VARCHAR(50) NOT NULL DEFAULT 'USER',  -- USER, SYSTEM, API
    actor_ip        INET,
    actor_user_agent TEXT,
    
    -- Target (what was affected)
    target_type     VARCHAR(50),  -- USER, ROLE, PERMISSION, etc.
    target_id       UUID,
    target_ref      VARCHAR(255),  -- Additional reference (e.g., permission code)
    
    -- Event details
    action          VARCHAR(100) NOT NULL,  -- Human-readable action description
    details         JSONB,  -- Additional context
    
    -- Result
    success         BOOLEAN NOT NULL DEFAULT true,
    error_code      VARCHAR(50),
    error_message   TEXT,
    
    -- Timestamp (immutable)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Partition key for time-based partitioning (optional)
    event_date      DATE NOT NULL DEFAULT CURRENT_DATE
);

-- Indexes for common queries
CREATE INDEX idx_audit_event_type ON audit.security_log(event_type);
CREATE INDEX idx_audit_actor ON audit.security_log(actor_id);
CREATE INDEX idx_audit_target ON audit.security_log(target_id);
CREATE INDEX idx_audit_created ON audit.security_log(created_at DESC);
CREATE INDEX idx_audit_event_date ON audit.security_log(event_date);
CREATE INDEX idx_audit_severity ON audit.security_log(severity) WHERE severity IN ('WARN', 'ERROR', 'CRITICAL');

COMMENT ON TABLE audit.security_log IS 'Immutable security event log - NEVER DELETE';

-- ════════════════════════════════════════════════════════════════════════════
-- FUNCTION: audit.log_event
-- 
-- Helper to insert audit events.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION audit.log_event(
    p_event_type VARCHAR,
    p_action VARCHAR,
    p_actor_id UUID DEFAULT NULL,
    p_target_type VARCHAR DEFAULT NULL,
    p_target_id UUID DEFAULT NULL,
    p_target_ref VARCHAR DEFAULT NULL,
    p_details JSONB DEFAULT NULL,
    p_success BOOLEAN DEFAULT true,
    p_error_code VARCHAR DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL,
    p_severity VARCHAR DEFAULT 'INFO',
    p_category VARCHAR DEFAULT 'AUTH'
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO audit.security_log (
        event_type, event_category, severity,
        actor_id, action,
        target_type, target_id, target_ref,
        details, success, error_code, error_message
    ) VALUES (
        p_event_type, p_category, p_severity,
        p_actor_id, p_action,
        p_target_type, p_target_id, p_target_ref,
        p_details, p_success, p_error_code, p_error_message
    ) RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION audit.log_event IS 'Helper to create audit log entries';

-- ────────────────────────────────────────────────────────────────────────────
-- TRIGGERS: Auto-update updated_at timestamps
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_permission_updated
    BEFORE UPDATE ON authz.permission
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_role_updated
    BEFORE UPDATE ON authz.role
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_app_user_updated
    BEFORE UPDATE ON authz.app_user
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ────────────────────────────────────────────────────────────────────────────
-- RLS POLICIES (Optional - for direct Supabase client access)
-- ────────────────────────────────────────────────────────────────────────────

-- Enable RLS on tables that might be accessed via Supabase client
ALTER TABLE authz.permission ENABLE ROW LEVEL SECURITY;
ALTER TABLE authz.role ENABLE ROW LEVEL SECURITY;
ALTER TABLE authz.app_user ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit.security_log ENABLE ROW LEVEL SECURITY;

-- Helper function to check JWT permissions
CREATE OR REPLACE FUNCTION authz.jwt_has_permission(required_permission TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    jwt_permissions TEXT[];
BEGIN
    -- Extract permissions from JWT claims
    jwt_permissions := COALESCE(
        (current_setting('request.jwt.claims', true)::jsonb ->> 'permissions')::TEXT[],
        ARRAY[]::TEXT[]
    );
    RETURN required_permission = ANY(jwt_permissions);
END;
$$ LANGUAGE plpgsql STABLE;

-- Policies for permission table (read-only for most users)
CREATE POLICY "permissions_read_all" ON authz.permission
    FOR SELECT USING (is_active = true);

CREATE POLICY "permissions_admin_write" ON authz.permission
    FOR ALL USING (authz.jwt_has_permission('ADMIN.ROLES.MANAGE_PERMISSIONS'));

-- Policies for role table
CREATE POLICY "roles_read_all" ON authz.role
    FOR SELECT USING (is_active = true);

CREATE POLICY "roles_admin_write" ON authz.role
    FOR ALL USING (authz.jwt_has_permission('ADMIN.ROLES.MANAGE_PERMISSIONS'));

-- Policies for app_user (users can read their own, admins can read all)
CREATE POLICY "users_read_own" ON authz.app_user
    FOR SELECT USING (
        keycloak_sub = current_setting('request.jwt.claims', true)::jsonb ->> 'sub'
        OR authz.jwt_has_permission('ADMIN.USERS.VIEW')
    );

CREATE POLICY "users_admin_write" ON authz.app_user
    FOR ALL USING (authz.jwt_has_permission('ADMIN.USERS.EDIT'));

-- Audit log is append-only via function
CREATE POLICY "audit_admin_read" ON audit.security_log
    FOR SELECT USING (authz.jwt_has_permission('ADMIN.AUDITLOGS.VIEW'));

-- ════════════════════════════════════════════════════════════════════════════
-- GRANTS (for backend service role)
-- ════════════════════════════════════════════════════════════════════════════

-- Grant usage on schemas
GRANT USAGE ON SCHEMA authz TO service_role;
GRANT USAGE ON SCHEMA audit TO service_role;

-- Grant full access to service role (backend API)
GRANT ALL ON ALL TABLES IN SCHEMA authz TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA audit TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA authz TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA audit TO service_role;

-- Grant limited access to authenticated users (via RLS)
GRANT SELECT ON authz.permission TO authenticated;
GRANT SELECT ON authz.role TO authenticated;
GRANT SELECT ON authz.app_user TO authenticated;
GRANT SELECT ON audit.security_log TO authenticated;
