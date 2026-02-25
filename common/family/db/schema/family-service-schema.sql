-- ═══════════════════════════════════════════════════════════════
-- FAMILY SERVICE DATABASE SCHEMA
-- Supabase Project: xdupcfxxcbltjmdgzzhf
-- Run this in: https://supabase.com/dashboard/project/xdupcfxxcbltjmdgzzhf/sql/new
--
-- COMPLETE current schema (base tables + all migrations applied).
-- Schema: family.*
-- ═══════════════════════════════════════════════════════════════

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create schema
CREATE SCHEMA IF NOT EXISTS family;

-- ═══════════════════════════════════════════════════════════════
-- 1. ADDRESS
-- Polymorphic address table shared by families and members
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS family.address (
    address_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type         VARCHAR(20) CHECK (entity_type IN ('FAMILY', 'MEMBER')),
    entity_id           UUID,
    address_type        VARCHAR(20) CHECK (address_type IN ('PERMANENT', 'CURRENT', 'MAILING')),
    line1               VARCHAR(255),
    line2               VARCHAR(255),
    parish              VARCHAR(100),
    district            VARCHAR(100),
    geo_code            VARCHAR(50),
    lot_apt             VARCHAR(100),     -- Lot / Apt / P.O. Box
    street_district     VARCHAR(255),     -- Street / District
    post_office         VARCHAR(100),     -- Post Office / Postal Agency
    post_code           VARCHAR(20),
    area_type           VARCHAR(20) CHECK (area_type IN ('KMA', 'other_town', 'rural')),
    valid_from          DATE,
    valid_to            DATE
);

CREATE INDEX IF NOT EXISTS idx_address_entity ON family.address (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_address_type   ON family.address (address_type);

-- ═══════════════════════════════════════════════════════════════
-- 2. FAMILY
-- Core household record. uuid = internal PK, family_id = F-code.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS family.family (
    uuid                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id                   VARCHAR(20) UNIQUE NOT NULL,   -- e.g. F0001
    permanent_address_id        UUID NOT NULL REFERENCES family.address(address_id),
    head_member_id              UUID,
    head_first_name             VARCHAR(100),
    head_last_name              VARCHAR(100),
    head_middle_names           VARCHAR(255),
    head_alias                  VARCHAR(100),
    head_mothers_maiden_name    VARCHAR(255),
    phone                       VARCHAR(50),
    email                       VARCHAR(255),
    household_size              INTEGER,
    geo_code                    VARCHAR(50),
    vulnerability_flag          BOOLEAN DEFAULT false,
    status                      VARCHAR(20) DEFAULT 'active',
    intake_channel              VARCHAR(50),   -- 'field_registration', 'web_portal', etc.
    registration_status         VARCHAR(30)
        CHECK (registration_status IN (
            'draft', 'pending_verification', 'verified', 'rejected',
            'DRAFT', 'SUBMITTED', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED'
        )),
    submitted_at                TIMESTAMPTZ,
    verified_at                 TIMESTAMPTZ,
    -- Registration form fields (migration 010)
    programme                   VARCHAR(50),   -- 'PATH', 'other'
    payment_option              VARCHAR(20),   -- 'KCC', 'cheque'
    social_worker_zone          VARCHAR(50),
    social_worker_code          VARCHAR(50),
    application_no              VARCHAR(50),
    constituency_code           VARCHAR(50),
    mailing_address_different   BOOLEAN DEFAULT false,
    directions_to_house         TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_family_family_id           ON family.family (family_id);
CREATE INDEX IF NOT EXISTS idx_family_status              ON family.family (status);
CREATE INDEX IF NOT EXISTS idx_family_registration_status ON family.family (registration_status);
CREATE INDEX IF NOT EXISTS idx_family_head_member         ON family.family (head_member_id);

-- ═══════════════════════════════════════════════════════════════
-- 3. FAMILY_MEMBER
-- Individual members. uuid = internal PK, member_id = code.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS family.family_member (
    uuid                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id               VARCHAR(30) UNIQUE NOT NULL,   -- e.g. F0001M001
    family_uuid             UUID NOT NULL REFERENCES family.family(uuid) ON DELETE CASCADE,
    national_id             VARCHAR(50),
    first_name              VARCHAR(100),
    last_name               VARCHAR(100),
    middle_names            VARCHAR(255),
    alias                   VARCHAR(100),
    date_of_birth           DATE,
    gender                  VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
    sex_code                INTEGER,           -- 1=Male, 2=Female
    relationship_to_head    VARCHAR(30),       -- 'head', 'spouse', 'child', 'parent', etc.
    alive_flag              BOOLEAN DEFAULT true,
    marital_status          VARCHAR(20),
    union_status            VARCHAR(20),       -- 'married', 'common_law', 'single', etc.
    order_number            INTEGER,
    -- Identification
    trn                     VARCHAR(50),       -- Tax Registration Number
    nis_no                  VARCHAR(50),       -- NIS Number
    id_type                 VARCHAR(30),       -- 'drivers_license','passport','voters_id', etc.
    id_number               VARCHAR(50),
    birth_entry_number      VARCHAR(50),
    mothers_maiden_name     VARCHAR(255),
    -- Education
    last_school_completed   VARCHAR(50),
    school_name             VARCHAR(255),
    school_code             VARCHAR(50),
    school_grade            VARCHAR(20),
    school_class            VARCHAR(20),
    school_shift            VARCHAR(20),
    -- Employment
    occupation              VARCHAR(100),
    -- Contact
    contact_no_1            VARCHAR(30),
    contact_no_2            VARCHAR(30),
    phone                   VARCHAR(50),
    email                   VARCHAR(255),
    -- Health
    pregnant                VARCHAR(20) CHECK (pregnant IN ('yes', 'no', 'lactating')),
    pregnancy_due_date      DATE,
    is_disabled             BOOLEAN DEFAULT false,
    is_mentally_ill         BOOLEAN DEFAULT false,
    is_chronically_ill      BOOLEAN DEFAULT false,
    is_shut_in              BOOLEAN DEFAULT false,
    -- Financial
    is_nis_pensioner        BOOLEAN DEFAULT false,
    pension_number          VARCHAR(50),
    -- Medical
    clinic_name             VARCHAR(255),
    clinic_code             VARCHAR(50),
    -- Registration documents
    reg_doc_birth_cert      BOOLEAN DEFAULT false,
    reg_doc_declaration     BOOLEAN DEFAULT false,
    reg_doc_school_records  BOOLEAN DEFAULT false,
    reg_doc_none            BOOLEAN DEFAULT false,
    -- Other
    is_twin                 BOOLEAN DEFAULT false,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_family_member_family     ON family.family_member (family_uuid);
CREATE INDEX IF NOT EXISTS idx_family_member_nat_id     ON family.family_member (national_id);
CREATE INDEX IF NOT EXISTS idx_family_member_member_id  ON family.family_member (member_id);

-- ═══════════════════════════════════════════════════════════════
-- 4. HOUSE_SERVICES
-- Housing conditions and assets per family
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS family.house_services (
    service_id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_uuid             UUID NOT NULL REFERENCES family.family(uuid) ON DELETE CASCADE,
    -- Housing
    dwelling_tenure         VARCHAR(30),   -- 'own','rent','lease','government_rent', etc.
    own_house               BOOLEAN,
    house_insurance         BOOLEAN,
    outer_wall_material     VARCHAR(30),
    -- Utilities
    lighting_source         VARCHAR(30),
    pays_for_electricity    BOOLEAN,
    water_source            VARCHAR(30),
    drinking_water_source   VARCHAR(30),
    -- Sanitation
    toilet_facility         VARCHAR(30),
    toilet_count            INTEGER,
    toilet_exclusive_use    BOOLEAN,
    garbage_disposal        VARCHAR(30),
    kitchen_location        VARCHAR(20),
    rooms_occupied          INTEGER,
    -- Connectivity
    has_landline            BOOLEAN,
    has_internet            BOOLEAN,
    -- Household assets
    has_laptop              BOOLEAN,
    has_desktop             BOOLEAN,
    has_washing_machine     BOOLEAN,
    has_refrigerator        BOOLEAN,
    has_gas_stove           BOOLEAN,
    has_electric_stove      BOOLEAN,
    has_car                 BOOLEAN,
    has_fan                 BOOLEAN,
    has_air_conditioner     BOOLEAN,
    has_motorcycle          BOOLEAN,
    has_water_heater        BOOLEAN,
    has_generator           BOOLEAN,
    has_sewing_machine      BOOLEAN,
    has_stereo              BOOLEAN,
    has_dvd_player          BOOLEAN,
    has_video_equipment     BOOLEAN,
    has_dryer               BOOLEAN,
    has_scanner             BOOLEAN,
    -- Economic
    weekly_family_spending  DECIMAL(12,2),
    head_has_resident_partner BOOLEAN,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_house_services_family ON family.house_services (family_uuid);

-- ═══════════════════════════════════════════════════════════════
-- 5. DOCUMENTS
-- Polymorphic — owned by family OR member
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS family.documents (
    document_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_type      VARCHAR(20) CHECK (owner_type IN ('FAMILY', 'MEMBER')),
    owner_id        UUID,
    document_type   VARCHAR(50),
    document_number VARCHAR(100),
    file_url        TEXT,
    status          VARCHAR(20) DEFAULT 'UPLOADED'
        CHECK (status IN ('UPLOADED', 'PENDING', 'VERIFIED', 'REJECTED')),
    uploaded_at     TIMESTAMPTZ DEFAULT NOW(),
    uploaded_by     UUID
);

CREATE INDEX IF NOT EXISTS idx_documents_owner ON family.documents (owner_type, owner_id);

-- ═══════════════════════════════════════════════════════════════
-- 6. ACCOUNT_DETAILS
-- Bank/mobile-money accounts (polymorphic)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS family.account_details (
    account_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_type          VARCHAR(20),
    owner_id            UUID,
    account_type        VARCHAR(20),           -- 'bank', 'mobile_money', etc.
    masked_account_no   VARCHAR(50),
    verification_status VARCHAR(20) DEFAULT 'pending',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- 7. BIOMETRIC_METADATA
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS family.biometric_metadata (
    biometric_id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id               UUID,
    biometric_type          VARCHAR(20),   -- 'fingerprint', 'face', 'iris'
    external_reference_id   TEXT,
    enrollment_status       VARCHAR(20),   -- 'pending', 'enrolled', 'failed'
    enrolled_at             TIMESTAMPTZ,
    last_verified_at        TIMESTAMPTZ
);

-- ═══════════════════════════════════════════════════════════════
-- 8. IDENTITY_MATCH
-- Duplicate detection
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS family.identity_match (
    match_id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    primary_member_id   UUID,
    duplicate_member_id UUID,
    match_score         DECIMAL(5,2),
    match_status        VARCHAR(30),   -- 'pending_review', 'confirmed_duplicate', 'false_positive'
    reviewed_by         UUID,
    reviewed_at         TIMESTAMPTZ
);

-- ═══════════════════════════════════════════════════════════════
-- 9. FAMILY_HISTORY
-- Audit trail for all changes (immutable)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS family.family_history (
    history_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type     VARCHAR(20) CHECK (entity_type IN ('FAMILY', 'MEMBER', 'ADDRESS', 'DOCUMENT', 'ACCOUNT')),
    entity_id       UUID,
    change_type     VARCHAR(50),   -- 'CREATED', 'UPDATED', 'ARCHIVED', 'DELETED', etc.
    changed_by      UUID,
    old_value       JSONB,
    new_value       JSONB,
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_family_history_entity ON family.family_history (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_family_history_date   ON family.family_history (changed_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- 10. FAMILY_EVENT_OUTBOX
-- Transactional outbox for RabbitMQ events
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS family.family_event_outbox (
    event_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    aggregate_type  VARCHAR(50) NOT NULL,
    aggregate_id    UUID NOT NULL,
    event_type      VARCHAR(100) NOT NULL,
    payload         JSONB NOT NULL DEFAULT '{}',
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
    attempts        INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_outbox_status    ON family.family_event_outbox (status);
CREATE INDEX IF NOT EXISTS idx_outbox_aggregate ON family.family_event_outbox (aggregate_type, aggregate_id);

-- ═══════════════════════════════════════════════════════════════
-- HELPER FUNCTIONS (REST API adapter)
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

GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.exec_ddl(text) TO service_role;

-- ═══════════════════════════════════════════════════════════════
-- DONE! Family service database ready.
-- ═══════════════════════════════════════════════════════════════
