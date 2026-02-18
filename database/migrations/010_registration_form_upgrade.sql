-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 010: Registration Form Upgrade
-- Aligns DB schema with Government of Jamaica Social Assistance Application
-- ══════════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. FAMILY TABLE — Add programme, payment option, social worker info, 
--    family head extended fields, and application metadata
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE family.family ADD COLUMN IF NOT EXISTS programme VARCHAR(50) DEFAULT 'PATH';
ALTER TABLE family.family ADD COLUMN IF NOT EXISTS payment_option VARCHAR(50);
ALTER TABLE family.family ADD COLUMN IF NOT EXISTS social_worker_zone VARCHAR(100);
ALTER TABLE family.family ADD COLUMN IF NOT EXISTS social_worker_code VARCHAR(50);
ALTER TABLE family.family ADD COLUMN IF NOT EXISTS application_no VARCHAR(50);
ALTER TABLE family.family ADD COLUMN IF NOT EXISTS constituency_code VARCHAR(50);

-- Family head extended name fields (stored on family for quick access)
ALTER TABLE family.family ADD COLUMN IF NOT EXISTS head_middle_names VARCHAR(200);
ALTER TABLE family.family ADD COLUMN IF NOT EXISTS head_alias VARCHAR(100);
ALTER TABLE family.family ADD COLUMN IF NOT EXISTS head_mothers_maiden_name VARCHAR(100);

-- Mailing address flag
ALTER TABLE family.family ADD COLUMN IF NOT EXISTS mailing_address_different BOOLEAN DEFAULT false;

-- Directions to house
ALTER TABLE family.family ADD COLUMN IF NOT EXISTS directions_to_house TEXT;

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. ADDRESS TABLE — Add post_code, post_office, lot_apt, street, area_type
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE family.address ADD COLUMN IF NOT EXISTS lot_apt VARCHAR(100);
ALTER TABLE family.address ADD COLUMN IF NOT EXISTS street_district VARCHAR(255);
ALTER TABLE family.address ADD COLUMN IF NOT EXISTS post_office VARCHAR(200);
ALTER TABLE family.address ADD COLUMN IF NOT EXISTS post_code VARCHAR(20);
ALTER TABLE family.address ADD COLUMN IF NOT EXISTS area_type VARCHAR(30);
-- area_type: 'KMA', 'other_town', 'rural'

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. FAMILY_MEMBER TABLE — Extensive new fields from the form
-- ──────────────────────────────────────────────────────────────────────────────

-- Extended name fields
ALTER TABLE family.family_member ADD COLUMN IF NOT EXISTS middle_names VARCHAR(200);
ALTER TABLE family.family_member ADD COLUMN IF NOT EXISTS alias VARCHAR(100);

-- Identification
ALTER TABLE family.family_member ADD COLUMN IF NOT EXISTS trn VARCHAR(30);
ALTER TABLE family.family_member ADD COLUMN IF NOT EXISTS nis_no VARCHAR(30);
ALTER TABLE family.family_member ADD COLUMN IF NOT EXISTS id_type VARCHAR(30);
-- id_type: 'drivers_license','passport','voters_id','senior_citizen_id','none'
ALTER TABLE family.family_member ADD COLUMN IF NOT EXISTS id_number VARCHAR(50);
ALTER TABLE family.family_member ADD COLUMN IF NOT EXISTS birth_entry_number VARCHAR(50);

-- Family info
ALTER TABLE family.family_member ADD COLUMN IF NOT EXISTS mothers_maiden_name VARCHAR(100);
ALTER TABLE family.family_member ADD COLUMN IF NOT EXISTS is_twin BOOLEAN DEFAULT false;
ALTER TABLE family.family_member ADD COLUMN IF NOT EXISTS order_number INTEGER;
ALTER TABLE family.family_member ADD COLUMN IF NOT EXISTS occupation VARCHAR(200);

-- Contacts
ALTER TABLE family.family_member ADD COLUMN IF NOT EXISTS contact_no_1 VARCHAR(30);
ALTER TABLE family.family_member ADD COLUMN IF NOT EXISTS contact_no_2 VARCHAR(30);

-- Union/marital (extended from simple marital_status)
ALTER TABLE family.family_member ADD COLUMN IF NOT EXISTS union_status VARCHAR(30);
-- union_status: 'married','common_law','divorced','separated','widowed','visiting','single','none'

-- Education
ALTER TABLE family.family_member ADD COLUMN IF NOT EXISTS last_school_completed VARCHAR(50);
-- 'completed_primary','some_secondary','completed_secondary','post_secondary','tertiary','none'
ALTER TABLE family.family_member ADD COLUMN IF NOT EXISTS school_name VARCHAR(200);
ALTER TABLE family.family_member ADD COLUMN IF NOT EXISTS school_code VARCHAR(50);
ALTER TABLE family.family_member ADD COLUMN IF NOT EXISTS school_grade VARCHAR(20);
ALTER TABLE family.family_member ADD COLUMN IF NOT EXISTS school_class VARCHAR(20);
ALTER TABLE family.family_member ADD COLUMN IF NOT EXISTS school_shift VARCHAR(30);

-- Health
ALTER TABLE family.family_member ADD COLUMN IF NOT EXISTS pregnant VARCHAR(20);
-- 'yes','no','lactating'
ALTER TABLE family.family_member ADD COLUMN IF NOT EXISTS pregnancy_due_date DATE;
ALTER TABLE family.family_member ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN DEFAULT false;
ALTER TABLE family.family_member ADD COLUMN IF NOT EXISTS is_mentally_ill BOOLEAN DEFAULT false;
ALTER TABLE family.family_member ADD COLUMN IF NOT EXISTS is_chronically_ill BOOLEAN DEFAULT false;
ALTER TABLE family.family_member ADD COLUMN IF NOT EXISTS is_shut_in BOOLEAN DEFAULT false;
ALTER TABLE family.family_member ADD COLUMN IF NOT EXISTS is_nis_pensioner BOOLEAN DEFAULT false;
ALTER TABLE family.family_member ADD COLUMN IF NOT EXISTS pension_number VARCHAR(50);

-- Clinic
ALTER TABLE family.family_member ADD COLUMN IF NOT EXISTS clinic_name VARCHAR(200);
ALTER TABLE family.family_member ADD COLUMN IF NOT EXISTS clinic_code VARCHAR(50);

-- Registration documents submitted (bitmask/flags)
ALTER TABLE family.family_member ADD COLUMN IF NOT EXISTS reg_doc_birth_cert BOOLEAN DEFAULT false;
ALTER TABLE family.family_member ADD COLUMN IF NOT EXISTS reg_doc_declaration BOOLEAN DEFAULT false;
ALTER TABLE family.family_member ADD COLUMN IF NOT EXISTS reg_doc_school_records BOOLEAN DEFAULT false;
ALTER TABLE family.family_member ADD COLUMN IF NOT EXISTS reg_doc_none BOOLEAN DEFAULT false;

-- Sex field (1=Male, 2=Female as per form) — we keep gender column, add sex_code
ALTER TABLE family.family_member ADD COLUMN IF NOT EXISTS sex_code SMALLINT;

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. HOUSE_SERVICES TABLE — Section 3 of the form
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS family.house_services (
  house_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_uuid UUID NOT NULL REFERENCES family.family(uuid) ON DELETE CASCADE,

  -- Dwelling (Q35)
  dwelling_tenure VARCHAR(30),
  -- 'own','rent','lease','government_rent','live_rent_free','squat'

  -- House ownership (Q36)
  own_house BOOLEAN DEFAULT false,
  own_house_count INTEGER DEFAULT 0,
  house_insurance BOOLEAN DEFAULT false,

  -- Utilities (Q37-39)
  has_landline BOOLEAN DEFAULT false,
  has_internet BOOLEAN DEFAULT false,
  lighting_source VARCHAR(30),
  -- 'electricity','kerosene','other'
  pays_for_electricity BOOLEAN DEFAULT false,

  -- Water & sanitation (Q40-42)
  outer_wall_material VARCHAR(50),
  -- 'wood','stone','brick','concrete','other'
  water_source VARCHAR(50),
  -- 'indoor_tap','outdoor_pipe','standpipe','well','other'
  garbage_disposal VARCHAR(50),
  -- 'collected','dump','burn','garbage_truck','other'
  toilet_facility VARCHAR(50),
  -- 'water_closet_sewer','water_closet_not_sewer','pit','other','none'
  toilet_count INTEGER DEFAULT 1,

  -- Shared facilities (Q43)
  toilet_exclusive_use BOOLEAN DEFAULT true,
  shared_households INTEGER DEFAULT 0,

  -- Drinking water (Q44)
  drinking_water_source VARCHAR(50),

  -- Rooms & kitchen (Q46-47)
  rooms_occupied INTEGER DEFAULT 1,
  kitchen_location VARCHAR(20),
  -- 'indoor','outdoor','none'

  -- Spending (Q48)
  weekly_family_spending NUMERIC(12,2) DEFAULT 0,

  -- Partner (Q49)
  head_has_resident_partner BOOLEAN DEFAULT false,

  -- ── Household Assets (Q50) ─── stored as boolean columns ──
  has_laptop BOOLEAN DEFAULT false,
  has_desktop BOOLEAN DEFAULT false,
  has_washing_machine BOOLEAN DEFAULT false,
  has_refrigerator BOOLEAN DEFAULT false,
  has_gas_stove BOOLEAN DEFAULT false,
  has_electric_stove BOOLEAN DEFAULT false,
  has_car BOOLEAN DEFAULT false,
  has_fan BOOLEAN DEFAULT false,
  has_dvd_burner BOOLEAN DEFAULT false,
  has_dvd_player BOOLEAN DEFAULT false,
  has_stereo BOOLEAN DEFAULT false,
  has_video_equipment BOOLEAN DEFAULT false,
  has_air_conditioner BOOLEAN DEFAULT false,
  has_other_electrical BOOLEAN DEFAULT false,
  has_sewing_machine BOOLEAN DEFAULT false,
  has_motorcycle BOOLEAN DEFAULT false,
  has_water_heater BOOLEAN DEFAULT false,
  has_generator BOOLEAN DEFAULT false,
  has_scanner BOOLEAN DEFAULT false,
  has_dryer BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT unique_family_house UNIQUE (family_uuid)
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. INDEXES
-- ──────────────────────────────────────────────────────────────────────────────

-- national_id uniqueness (if not already unique)
CREATE UNIQUE INDEX IF NOT EXISTS idx_family_member_national_id_unique 
  ON family.family_member(national_id) 
  WHERE national_id IS NOT NULL AND national_id != '';

CREATE INDEX IF NOT EXISTS idx_house_services_family ON family.house_services(family_uuid);
CREATE INDEX IF NOT EXISTS idx_address_entity_type ON family.address(entity_type, entity_id, address_type);

-- ──────────────────────────────────────────────────────────────────────────────
-- 6. MAILING ADDRESS SUPPORT
-- The address table already supports address_type 'PERMANENT' and 'CURRENT'.
-- We add 'MAILING' as a valid address_type for family-level mailing addresses.
-- No schema change needed — it's a VARCHAR column, just use 'MAILING'.
-- ──────────────────────────────────────────────────────────────────────────────

-- Down migration (rollback):
-- ALTER TABLE family DROP COLUMN IF EXISTS programme;
-- ALTER TABLE family DROP COLUMN IF EXISTS payment_option;
-- ALTER TABLE family DROP COLUMN IF EXISTS social_worker_zone;
-- ALTER TABLE family DROP COLUMN IF EXISTS social_worker_code;
-- ALTER TABLE family DROP COLUMN IF EXISTS application_no;
-- ALTER TABLE family DROP COLUMN IF EXISTS constituency_code;
-- ALTER TABLE family DROP COLUMN IF EXISTS head_middle_names;
-- ALTER TABLE family DROP COLUMN IF EXISTS head_alias;
-- ALTER TABLE family DROP COLUMN IF EXISTS head_mothers_maiden_name;
-- ALTER TABLE family DROP COLUMN IF EXISTS mailing_address_different;
-- ALTER TABLE family DROP COLUMN IF EXISTS directions_to_house;
-- ALTER TABLE address DROP COLUMN IF EXISTS lot_apt;
-- ALTER TABLE address DROP COLUMN IF EXISTS street_district;
-- ALTER TABLE address DROP COLUMN IF EXISTS post_office;
-- ALTER TABLE address DROP COLUMN IF EXISTS post_code;
-- ALTER TABLE address DROP COLUMN IF EXISTS area_type;
-- DROP TABLE IF EXISTS house_services;
-- ... (reverse all family_member alterations)
