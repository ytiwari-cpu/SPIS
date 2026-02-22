-- ============================================================================
-- COMPREHENSIVE RBAC SCHEMA MIGRATION
-- ============================================================================
-- 
-- This migration adds:
-- 1. Proper roles table with full CRUD support
-- 2. Programmes table with full CRUD
-- 3. Audit logs table for all API actions
-- 4. Excel import templates table
--
-- Apply to: IAM database (wrxrstmncezssrscrkxs)
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- PART 1: ROLES TABLE (if not exists or needs update)
-- ────────────────────────────────────────────────────────────────────────────

-- Create proper roles table (independent of enum)
CREATE TABLE IF NOT EXISTS roles (
    role_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_name       VARCHAR(100) NOT NULL UNIQUE,
    display_name    VARCHAR(200) NOT NULL,
    description     TEXT,
    role_type       VARCHAR(50) NOT NULL DEFAULT 'custom',  -- 'system', 'custom'
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      UUID,
    
    CONSTRAINT roles_type_check CHECK (role_type IN ('system', 'custom'))
);

CREATE INDEX IF NOT EXISTS idx_roles_name ON roles (role_name);
CREATE INDEX IF NOT EXISTS idx_roles_active ON roles (is_active) WHERE is_active = true;

-- Seed system roles if not already present
INSERT INTO roles (role_name, display_name, description, role_type) VALUES
    ('SuperAdmin', 'Super Administrator', 'Full system access with all permissions', 'system'),
    ('Admin', 'Administrator', 'System administrator with management access', 'system'),
    ('ProgrammeManager', 'Programme Manager', 'Staff managing social protection programmes', 'system'),
    ('CaseWorker', 'Case Worker', 'Staff managing citizen cases and applications', 'system'),
    ('Citizen', 'Citizen', 'Regular citizens accessing the portal', 'system')
ON CONFLICT (role_name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    role_type = EXCLUDED.role_type;

-- Update trigger for roles
CREATE OR REPLACE FUNCTION update_roles_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_roles_updated ON roles;
CREATE TRIGGER trg_roles_updated
    BEFORE UPDATE ON roles
    FOR EACH ROW
    EXECUTE FUNCTION update_roles_timestamp();

-- ────────────────────────────────────────────────────────────────────────────
-- PART 2: PROGRAMMES TABLE
-- ────────────────────────────────────────────────────────────────────────────

-- Programme status enum
DO $$ BEGIN
    CREATE TYPE programme_status AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'COMPLETED', 'DRAFT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Programme type enum
DO $$ BEGIN
    CREATE TYPE programme_type AS ENUM (
        'CASH_TRANSFER', 
        'FOOD_SECURITY', 
        'HEALTH', 
        'EDUCATION', 
        'HOUSING', 
        'EMPLOYMENT',
        'OTHER'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Main programmes table
CREATE TABLE IF NOT EXISTS programmes (
    programme_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code                VARCHAR(50) NOT NULL UNIQUE,       -- e.g., 'PATH', 'FOOD-01'
    name                VARCHAR(200) NOT NULL,
    description         TEXT,
    programme_type      programme_type NOT NULL DEFAULT 'OTHER',
    status              programme_status NOT NULL DEFAULT 'DRAFT',
    
    -- Programme details
    start_date          DATE,
    end_date            DATE,
    budget              DECIMAL(15, 2),
    currency            VARCHAR(3) DEFAULT 'TZS',
    
    -- Eligibility criteria (JSON for flexibility)
    eligibility_criteria JSONB DEFAULT '{}',
    
    -- Benefits configuration
    benefit_amount      DECIMAL(12, 2),
    benefit_frequency   VARCHAR(50),  -- 'MONTHLY', 'QUARTERLY', 'ONE_TIME'
    
    -- Statistics (cached, updated via triggers or scheduled jobs)
    enrolled_count      INTEGER DEFAULT 0,
    eligible_count      INTEGER DEFAULT 0,
    benefits_disbursed  DECIMAL(15, 2) DEFAULT 0,
    
    -- Soft delete
    is_deleted          BOOLEAN NOT NULL DEFAULT false,
    deleted_at          TIMESTAMPTZ,
    deleted_by          UUID,
    
    -- Metadata
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          UUID,
    updated_by          UUID,
    
    CONSTRAINT programmes_dates_check CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_programmes_code ON programmes (code);
CREATE INDEX IF NOT EXISTS idx_programmes_status ON programmes (status);
CREATE INDEX IF NOT EXISTS idx_programmes_type ON programmes (programme_type);
CREATE INDEX IF NOT EXISTS idx_programmes_active ON programmes (is_deleted) WHERE is_deleted = false;

-- Update trigger for programmes
DROP TRIGGER IF EXISTS trg_programmes_updated ON programmes;
CREATE TRIGGER trg_programmes_updated
    BEFORE UPDATE ON programmes
    FOR EACH ROW
    EXECUTE FUNCTION update_roles_timestamp();

-- Programme enrollment mapping table
CREATE TABLE IF NOT EXISTS programme_enrollments (
    enrollment_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    programme_id        UUID NOT NULL REFERENCES programmes(programme_id) ON DELETE CASCADE,
    family_uuid         UUID NOT NULL,  -- References family table in family-service DB
    
    enrollment_status   VARCHAR(50) NOT NULL DEFAULT 'ENROLLED',  -- ENROLLED, ELIGIBLE, PENDING, SUSPENDED, EXITED
    enrolled_at         TIMESTAMPTZ DEFAULT NOW(),
    exited_at           TIMESTAMPTZ,
    exit_reason         TEXT,
    
    -- Benefits received
    total_benefits      DECIMAL(12, 2) DEFAULT 0,
    last_benefit_date   TIMESTAMPTZ,
    
    -- Metadata
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT programme_enrollments_unique UNIQUE (programme_id, family_uuid)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_programme ON programme_enrollments (programme_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_family ON programme_enrollments (family_uuid);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON programme_enrollments (enrollment_status);

-- ────────────────────────────────────────────────────────────────────────────
-- PART 3: AUDIT LOGS TABLE
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Actor information (from JWT)
    actor_sub           VARCHAR(255),           -- Keycloak sub / user_id
    actor_email         VARCHAR(255),
    actor_roles         TEXT[],                 -- Array of role names (for reference only)
    
    -- Request information
    action              VARCHAR(100) NOT NULL,  -- e.g., 'PROGRAMME_CREATED', 'FAMILY_UPDATED'
    method              VARCHAR(10) NOT NULL,   -- GET, POST, PUT, PATCH, DELETE
    path                VARCHAR(500) NOT NULL,  -- /api/v1/programmes/123
    
    -- Resource information
    resource_type       VARCHAR(100),           -- 'programme', 'family', 'role', 'user'
    resource_id         VARCHAR(255),           -- UUID or other identifier
    
    -- Request/Response details
    status_code         INTEGER NOT NULL,
    request_id          VARCHAR(100),           -- Correlation ID for tracing
    
    -- Client information
    ip_address          VARCHAR(45),            -- IPv4 or IPv6
    user_agent          TEXT,
    
    -- Payload summary (NEVER store sensitive data like passwords/tokens)
    request_summary     JSONB,                  -- Sanitized request body summary
    response_summary    JSONB,                  -- Response summary (optional)
    
    -- Duration
    duration_ms         INTEGER,                -- Request processing time
    
    -- Timestamp (immutable)
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs (actor_sub);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_method ON audit_logs (method);
CREATE INDEX IF NOT EXISTS idx_audit_status ON audit_logs (status_code);
CREATE INDEX IF NOT EXISTS idx_audit_path ON audit_logs (path);

-- Partition by month (optional, for large-scale deployments)
-- This is commented out for now, but can be enabled for performance
-- CREATE TABLE audit_logs_2026_02 PARTITION OF audit_logs
--     FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

COMMENT ON TABLE audit_logs IS 'Immutable audit log for all API actions - NEVER DELETE or UPDATE';
COMMENT ON COLUMN audit_logs.request_summary IS 'Sanitized request body - NEVER store passwords, tokens, or secrets';

-- ────────────────────────────────────────────────────────────────────────────
-- PART 4: EXCEL IMPORT TRACKING
-- ────────────────────────────────────────────────────────────────────────────

-- Import job status enum
DO $$ BEGIN
    CREATE TYPE import_status AS ENUM ('PENDING', 'VALIDATING', 'VALIDATED', 'IMPORTING', 'COMPLETED', 'FAILED', 'PARTIAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS import_jobs (
    job_id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Import metadata
    resource_type       VARCHAR(100) NOT NULL,  -- 'programmes', 'families', 'users'
    file_name           VARCHAR(500) NOT NULL,
    file_size           INTEGER,
    
    -- Status tracking
    status              import_status NOT NULL DEFAULT 'PENDING',
    
    -- Validation results
    total_rows          INTEGER DEFAULT 0,
    valid_rows          INTEGER DEFAULT 0,
    error_rows          INTEGER DEFAULT 0,
    validation_errors   JSONB,                  -- Array of {row, field, error} objects
    
    -- Import results
    imported_count      INTEGER DEFAULT 0,
    skipped_count       INTEGER DEFAULT 0,
    updated_count       INTEGER DEFAULT 0,
    
    -- Processing
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    
    -- Actor
    uploaded_by         UUID,
    uploaded_by_email   VARCHAR(255),
    
    -- Metadata
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON import_jobs (status);
CREATE INDEX IF NOT EXISTS idx_import_jobs_resource ON import_jobs (resource_type);
CREATE INDEX IF NOT EXISTS idx_import_jobs_user ON import_jobs (uploaded_by);

-- ────────────────────────────────────────────────────────────────────────────
-- PART 5: ADDITIONAL PERMISSIONS FOR NEW FEATURES
-- ────────────────────────────────────────────────────────────────────────────

-- Insert new permissions for Excel import/export
INSERT INTO permissions (permission_key, permission_name, description, module) VALUES
    -- Role management
    ('ADMIN.ROLES.CREATE', 'Create Roles', 'Create new roles', 'admin'),
    ('ADMIN.ROLES.EDIT', 'Edit Roles', 'Edit role name and description', 'admin'),
    ('ADMIN.ROLES.DELETE', 'Delete Roles', 'Delete custom roles', 'admin'),
    ('ADMIN.ROLES.MANAGE_PERMISSIONS', 'Manage Role Permissions', 'Add/remove permissions from roles', 'admin'),
    
    -- Programme management
    ('ADMIN.PROGRAMMES.CREATE', 'Create Programmes', 'Create new programmes', 'admin'),
    ('ADMIN.PROGRAMMES.EDIT', 'Edit Programmes', 'Edit programme details', 'admin'),
    ('ADMIN.PROGRAMMES.DELETE', 'Delete Programmes', 'Delete/archive programmes', 'admin'),
    ('ADMIN.PROGRAMMES.IMPORT', 'Import Programmes', 'Bulk import programmes from Excel', 'admin'),
    
    -- Family import
    ('ADMIN.FAMILIES.IMPORT', 'Import Families', 'Bulk import families from Excel', 'admin'),
    
    -- Audit logs
    ('ADMIN.AUDITLOGS.EXPORT', 'Export Audit Logs', 'Export audit log data', 'admin')
ON CONFLICT (permission_key) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    description = EXCLUDED.description;

-- Grant new permissions to SuperAdmin
INSERT INTO role_permissions (role_name, permission_key, granted_by)
SELECT 'SuperAdmin', permission_key, 'migration'
FROM permissions
WHERE permission_key IN (
    'ADMIN.ROLES.CREATE',
    'ADMIN.ROLES.EDIT',
    'ADMIN.ROLES.DELETE',
    'ADMIN.ROLES.MANAGE_PERMISSIONS',
    'ADMIN.PROGRAMMES.CREATE',
    'ADMIN.PROGRAMMES.EDIT',
    'ADMIN.PROGRAMMES.DELETE',
    'ADMIN.PROGRAMMES.IMPORT',
    'ADMIN.FAMILIES.IMPORT',
    'ADMIN.AUDITLOGS.EXPORT'
)
ON CONFLICT (role_name, permission_key) DO NOTHING;

-- Grant programme permissions to Admin
INSERT INTO role_permissions (role_name, permission_key, granted_by)
SELECT 'Admin', permission_key, 'migration'
FROM permissions
WHERE permission_key IN (
    'ADMIN.PROGRAMMES.CREATE',
    'ADMIN.PROGRAMMES.EDIT',
    'ADMIN.PROGRAMMES.IMPORT'
)
ON CONFLICT (role_name, permission_key) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ════════════════════════════════════════════════════════════════════════════

-- Count created objects
DO $$
DECLARE
    roles_count INTEGER;
    programmes_count INTEGER;
    permissions_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO roles_count FROM roles;
    SELECT COUNT(*) INTO permissions_count FROM permissions;
    
    RAISE NOTICE 'Migration complete:';
    RAISE NOTICE '  - Roles: %', roles_count;
    RAISE NOTICE '  - Permissions: %', permissions_count;
    RAISE NOTICE '  - Tables created: roles, programmes, programme_enrollments, audit_logs, import_jobs';
END $$;
