-- ═══════════════════════════════════════════════════════════════════════════════
-- PROGRAMME ADMINISTRATION MODULE — COMPLETE SCHEMA
-- Supabase Project: fwtcccwgijfcngtuawlx
-- Run in: https://supabase.com/dashboard/project/fwtcccwgijfcngtuawlx/sql/new
-- ═══════════════════════════════════════════════════════════════════════════════

-- Create schema
CREATE SCHEMA IF NOT EXISTS programme;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. programme_master — Core programme record
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS programme.programme_master (
    programme_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    programme_code VARCHAR(50) UNIQUE NOT NULL,
    programme_name VARCHAR(255) NOT NULL,
    description TEXT,
    active_flag BOOLEAN DEFAULT true,
    status VARCHAR(20) DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'ACTIVE', 'INACTIVE')),
    rules_tree JSONB,                    -- nested AND/OR eligibility rule tree
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. programme_config — 1:1 with programme_master
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS programme.programme_config (
    programme_id UUID PRIMARY KEY REFERENCES programme.programme_master(programme_id) ON DELETE CASCADE,
    ranking_required BOOLEAN DEFAULT false,
    quota_limit INTEGER,
    benefit_type VARCHAR(20) CHECK (benefit_type IN ('Cash', 'In-Kind', 'Hybrid', 'Service')),
    benefit_frequency VARCHAR(20) CHECK (benefit_frequency IN ('Monthly', 'Quarterly', 'Annual', 'One-Time')),
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. programme_payment_settings — 1:1 with programme_master
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS programme.programme_payment_settings (
    programme_id UUID PRIMARY KEY REFERENCES programme.programme_master(programme_id) ON DELETE CASCADE,
    payment_frequency VARCHAR(20),
    payment_mode VARCHAR(50),
    total_budget_allocated DECIMAL(18,2),
    currency VARCHAR(10) DEFAULT 'JMD',
    effective_from DATE,
    effective_to DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. rule_variable_catalog — Available variables/fields for rules
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS programme.rule_variable_catalog (
    variable_code VARCHAR(100) PRIMARY KEY,
    display_name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    data_type VARCHAR(20) NOT NULL,
    source_table VARCHAR(100) NOT NULL,
    source_column VARCHAR(100) NOT NULL,
    enum_values JSONB,
    is_system_field BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. rule_group — Composite rule sets (PMT, MT, etc.)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS programme.rule_group (
    rule_group_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_code VARCHAR(50) UNIQUE NOT NULL,
    group_name VARCHAR(255) NOT NULL,
    description TEXT,
    scoring_method VARCHAR(30) DEFAULT 'weighted_sum' CHECK (scoring_method IN ('weighted_sum', 'average', 'min', 'max')),
    is_active BOOLEAN DEFAULT true,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. rule_group_rules — Rules within a group
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS programme.rule_group_rules (
    rule_group_rule_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_group_id UUID NOT NULL REFERENCES programme.rule_group(rule_group_id) ON DELETE CASCADE,
    variable_code VARCHAR(100) NOT NULL REFERENCES programme.rule_variable_catalog(variable_code),
    operator VARCHAR(10) NOT NULL CHECK (operator IN ('==', '!=', '>', '<', '>=', '<=', 'IN', 'NOT IN', 'BETWEEN')),
    threshold_value VARCHAR(255) NOT NULL,
    weight DECIMAL(5,2) DEFAULT 1.0,
    mandatory_flag BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. rule_master — Global catalog of available rules (variable or group type)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS programme.rule_master (
    rule_code VARCHAR(50) PRIMARY KEY,
    rule_type VARCHAR(20) NOT NULL DEFAULT 'variable' CHECK (rule_type IN ('variable', 'group')),
    category VARCHAR(50) NOT NULL,
    rule_name VARCHAR(255) NOT NULL,
    description TEXT,
    data_type VARCHAR(20),
    variable_code VARCHAR(100) REFERENCES programme.rule_variable_catalog(variable_code),
    rule_group_id UUID REFERENCES programme.rule_group(rule_group_id),
    source_entity VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 8. custom_field_definitions — Custom fields added by admins
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS programme.custom_field_definitions (
    field_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    field_name VARCHAR(100) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    target_table VARCHAR(100) NOT NULL CHECK (target_table IN ('family', 'family_member', 'address', 'house_services')),
    data_type VARCHAR(20) NOT NULL CHECK (data_type IN ('text', 'number', 'boolean', 'date', 'enum')),
    enum_values JSONB,
    is_required BOOLEAN DEFAULT false,
    default_value VARCHAR(255),
    description TEXT,
    variable_code VARCHAR(100) REFERENCES programme.rule_variable_catalog(variable_code),
    is_active BOOLEAN DEFAULT true,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 9. rule_version_master — Tracks published rule sets
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS programme.rule_version_master (
    rule_version VARCHAR(20) PRIMARY KEY,
    description TEXT,
    effective_from DATE,
    effective_to DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 10. programme_rules — Links rules to programmes
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS programme.programme_rules (
    programme_rule_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    programme_id UUID NOT NULL REFERENCES programme.programme_master(programme_id) ON DELETE CASCADE,
    rule_type VARCHAR(20) NOT NULL DEFAULT 'variable' CHECK (rule_type IN ('variable', 'group')),
    rule_code VARCHAR(50) REFERENCES programme.rule_master(rule_code),
    variable_code VARCHAR(100) REFERENCES programme.rule_variable_catalog(variable_code),
    rule_group_id UUID REFERENCES programme.rule_group(rule_group_id),
    operator VARCHAR(10) CHECK (operator IN ('==', '!=', '>', '<', '>=', '<=', 'IN', 'NOT IN', 'BETWEEN')),
    threshold_value VARCHAR(255),
    weight DECIMAL(5,2) DEFAULT 0,
    mandatory_flag BOOLEAN DEFAULT false,
    rule_version VARCHAR(20) REFERENCES programme.rule_version_master(rule_version),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 11. programme_citizens — Enrollment records
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS programme.programme_citizens (
    programme_id UUID NOT NULL REFERENCES programme.programme_master(programme_id),
    subject_type VARCHAR(20) NOT NULL CHECK (subject_type IN ('Individual', 'Family')),
    subject_id UUID NOT NULL,
    active_from DATE,
    active_till DATE,
    status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Suspended', 'Exited', 'Pending')),
    rule_version VARCHAR(20) REFERENCES programme.rule_version_master(rule_version),
    calculated_score DECIMAL(8,2),
    group_scores JSONB,
    approved_at TIMESTAMPTZ,
    approved_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (programme_id, subject_id)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 12. programme_history — Audit trail for programme changes
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS programme.programme_history (
    history_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    programme_id UUID NOT NULL REFERENCES programme.programme_master(programme_id),
    change_type VARCHAR(50) NOT NULL,
    old_value JSONB,
    new_value JSONB,
    changed_by UUID,
    changed_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 13. programme_rules_history — Audit trail for rule changes
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS programme.programme_rules_history (
    history_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    programme_id UUID NOT NULL REFERENCES programme.programme_master(programme_id),
    rule_code VARCHAR(50),
    old_value JSONB,
    new_value JSONB,
    rule_version VARCHAR(20),
    changed_by UUID,
    changed_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 14. programme_exit_history — Tracks citizen exits
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS programme.programme_exit_history (
    exit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    programme_id UUID NOT NULL REFERENCES programme.programme_master(programme_id),
    subject_type VARCHAR(20),
    subject_id UUID NOT NULL,
    exit_reason VARCHAR(100),
    remarks TEXT,
    exited_by UUID,
    exited_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 15. conditionality_compliance — Tracks conditionality checks
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS programme.conditionality_compliance (
    compliance_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    programme_id UUID NOT NULL REFERENCES programme.programme_master(programme_id),
    subject_type VARCHAR(20),
    subject_id UUID NOT NULL,
    condition_code VARCHAR(50) NOT NULL,
    compliance_status VARCHAR(20) CHECK (compliance_status IN ('Compliant', 'Non-Compliant', 'Pending', 'Exempt')),
    evaluated_at TIMESTAMPTZ DEFAULT now(),
    remarks TEXT
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_programme_citizens_subject ON programme.programme_citizens(subject_id);
CREATE INDEX IF NOT EXISTS idx_programme_citizens_status ON programme.programme_citizens(status);
CREATE INDEX IF NOT EXISTS idx_programme_history_programme ON programme.programme_history(programme_id);
CREATE INDEX IF NOT EXISTS idx_programme_rules_programme ON programme.programme_rules(programme_id);
CREATE INDEX IF NOT EXISTS idx_rule_group_rules_group ON programme.rule_group_rules(rule_group_id);
CREATE INDEX IF NOT EXISTS idx_rule_variable_catalog_table ON programme.rule_variable_catalog(source_table);
CREATE INDEX IF NOT EXISTS idx_rule_variable_catalog_category ON programme.rule_variable_catalog(category);
CREATE INDEX IF NOT EXISTS idx_custom_field_defs_table ON programme.custom_field_definitions(target_table);
CREATE INDEX IF NOT EXISTS idx_programme_rules_history_programme ON programme.programme_rules_history(programme_id);
CREATE INDEX IF NOT EXISTS idx_programme_exit_history_programme ON programme.programme_exit_history(programme_id);
CREATE INDEX IF NOT EXISTS idx_conditionality_compliance_programme ON programme.conditionality_compliance(programme_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 16. programme_manager_link — Users assigned as managers of a programme
-- Added via: migration 002_programme_redesign
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS programme.programme_manager_link (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    programme_id UUID NOT NULL REFERENCES programme.programme_master(programme_id) ON DELETE CASCADE,
    user_id      UUID NOT NULL,
    added_by     UUID NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT now(),
    UNIQUE(programme_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_prog_mgr_link_user ON programme.programme_manager_link(user_id);
CREATE INDEX IF NOT EXISTS idx_prog_mgr_link_prog ON programme.programme_manager_link(programme_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SEED DATA: rule_variable_catalog
-- Logical/evaluable columns from the family database
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Family table variables ──
INSERT INTO programme.rule_variable_catalog (variable_code, display_name, category, data_type, source_table, source_column, enum_values) VALUES
('family.household_size',         'Household Size',               'Demographic',    'number',  'family', 'household_size',         NULL),
('family.vulnerability_flag',     'Vulnerability Flag',           'Demographic',    'boolean', 'family', 'vulnerability_flag',     NULL),
('family.geo_code',               'Geographic Code',              'Geographic',     'string',  'family', 'geo_code',               NULL),
('family.status',                 'Family Status',                'Administrative', 'enum',    'family', 'status',                 '["active","inactive","suspended","archived"]'),
('family.registration_status',    'Registration Status',          'Administrative', 'enum',    'family', 'registration_status',    '["draft","pending_verification","verified","rejected"]'),
('family.programme',              'Current Programme',            'Administrative', 'string',  'family', 'programme',              NULL),
('family.payment_option',         'Payment Option',               'Economic',       'string',  'family', 'payment_option',         NULL),
('family.constituency_code',      'Constituency Code',            'Geographic',     'string',  'family', 'constituency_code',      NULL),
('family.mailing_address_different','Mailing Address Different',  'Administrative', 'boolean', 'family', 'mailing_address_different', NULL)
ON CONFLICT (variable_code) DO NOTHING;

-- ── Family Member table variables ──
INSERT INTO programme.rule_variable_catalog (variable_code, display_name, category, data_type, source_table, source_column, enum_values) VALUES
('family_member.date_of_birth',       'Date of Birth (Age)',          'Demographic',    'date',    'family_member', 'date_of_birth',       NULL),
('family_member.gender',              'Gender',                       'Demographic',    'enum',    'family_member', 'gender',              '["male","female","other"]'),
('family_member.relationship_to_head','Relationship to Head',         'Demographic',    'enum',    'family_member', 'relationship_to_head','["head","spouse","child","parent","sibling","grandparent","grandchild","other"]'),
('family_member.alive_flag',          'Alive Status',                 'Demographic',    'boolean', 'family_member', 'alive_flag',          NULL),
('family_member.marital_status',      'Marital Status',               'Demographic',    'enum',    'family_member', 'marital_status',      '["single","married","divorced","widowed","separated"]'),
('family_member.union_status',        'Union Status',                 'Demographic',    'enum',    'family_member', 'union_status',        '["married","common_law","divorced","separated","widowed","visiting","single","none"]'),
('family_member.occupation',          'Occupation',                   'Economic',       'string',  'family_member', 'occupation',          NULL),
('family_member.trn',                 'TRN (Has Tax ID)',             'Identification', 'string',  'family_member', 'trn',                 NULL),
('family_member.nis_no',              'NIS Number (Has NIS)',         'Identification', 'string',  'family_member', 'nis_no',              NULL),
('family_member.is_disabled',         'Is Disabled',                  'Health',         'boolean', 'family_member', 'is_disabled',         NULL),
('family_member.is_mentally_ill',     'Is Mentally Ill',              'Health',         'boolean', 'family_member', 'is_mentally_ill',     NULL),
('family_member.is_chronically_ill',  'Is Chronically Ill',           'Health',         'boolean', 'family_member', 'is_chronically_ill',  NULL),
('family_member.is_shut_in',          'Is Shut-In',                   'Health',         'boolean', 'family_member', 'is_shut_in',          NULL),
('family_member.is_nis_pensioner',    'Is NIS Pensioner',             'Economic',       'boolean', 'family_member', 'is_nis_pensioner',    NULL),
('family_member.pregnant',            'Pregnancy Status',             'Health',         'enum',    'family_member', 'pregnant',            '["yes","no","lactating"]'),
('family_member.last_school_completed','Last School Completed',       'Education',      'enum',    'family_member', 'last_school_completed','["completed_primary","some_secondary","completed_secondary","post_secondary","tertiary","none"]'),
('family_member.sex_code',            'Sex Code',                     'Demographic',    'number',  'family_member', 'sex_code',            NULL),
('family_member.is_twin',             'Is Twin',                      'Demographic',    'boolean', 'family_member', 'is_twin',             NULL),
('family_member.reg_doc_birth_cert',  'Has Birth Certificate',        'Compliance',     'boolean', 'family_member', 'reg_doc_birth_cert',  NULL),
('family_member.reg_doc_declaration', 'Has Declaration',              'Compliance',     'boolean', 'family_member', 'reg_doc_declaration', NULL),
('family_member.reg_doc_school_records','Has School Records',         'Compliance',     'boolean', 'family_member', 'reg_doc_school_records', NULL)
ON CONFLICT (variable_code) DO NOTHING;

-- ── Address table variables ──
INSERT INTO programme.rule_variable_catalog (variable_code, display_name, category, data_type, source_table, source_column, enum_values) VALUES
('address.city',        'City',         'Geographic', 'string', 'address', 'city',      NULL),
('address.region',      'Region/Parish','Geographic', 'string', 'address', 'region',    NULL),
('address.area_type',   'Area Type',    'Geographic', 'enum',   'address', 'area_type', '["KMA","other_town","rural"]'),
('address.post_office', 'Post Office',  'Geographic', 'string', 'address', 'post_office', NULL)
ON CONFLICT (variable_code) DO NOTHING;

-- ── House Services table variables ──
INSERT INTO programme.rule_variable_catalog (variable_code, display_name, category, data_type, source_table, source_column, enum_values) VALUES
('house_services.dwelling_tenure',          'Dwelling Tenure',            'Housing',  'enum',    'house_services', 'dwelling_tenure',          '["own","rent","lease","government_rent","live_rent_free","squat"]'),
('house_services.own_house',                'Owns House',                 'Housing',  'boolean', 'house_services', 'own_house',                NULL),
('house_services.house_insurance',          'Has House Insurance',        'Housing',  'boolean', 'house_services', 'house_insurance',          NULL),
('house_services.has_landline',             'Has Landline',               'Housing',  'boolean', 'house_services', 'has_landline',             NULL),
('house_services.has_internet',             'Has Internet',               'Housing',  'boolean', 'house_services', 'has_internet',             NULL),
('house_services.lighting_source',          'Lighting Source',            'Housing',  'enum',    'house_services', 'lighting_source',          '["electricity","kerosene","other"]'),
('house_services.pays_for_electricity',     'Pays for Electricity',       'Housing',  'boolean', 'house_services', 'pays_for_electricity',     NULL),
('house_services.outer_wall_material',      'Outer Wall Material',        'Housing',  'enum',    'house_services', 'outer_wall_material',      '["wood","stone","brick","concrete","other"]'),
('house_services.water_source',             'Water Source',               'Housing',  'enum',    'house_services', 'water_source',             '["indoor_tap","outdoor_pipe","standpipe","well","other"]'),
('house_services.garbage_disposal',         'Garbage Disposal',           'Housing',  'enum',    'house_services', 'garbage_disposal',         '["collected","dump","burn","garbage_truck","other"]'),
('house_services.toilet_facility',          'Toilet Facility',            'Housing',  'enum',    'house_services', 'toilet_facility',          '["water_closet_sewer","water_closet_not_sewer","pit","other","none"]'),
('house_services.toilet_count',             'Toilet Count',               'Housing',  'number',  'house_services', 'toilet_count',             NULL),
('house_services.toilet_exclusive_use',     'Toilet Exclusive Use',       'Housing',  'boolean', 'house_services', 'toilet_exclusive_use',     NULL),
('house_services.drinking_water_source',    'Drinking Water Source',      'Housing',  'enum',    'house_services', 'drinking_water_source',    NULL),
('house_services.rooms_occupied',           'Rooms Occupied',             'Housing',  'number',  'house_services', 'rooms_occupied',           NULL),
('house_services.kitchen_location',         'Kitchen Location',           'Housing',  'enum',    'house_services', 'kitchen_location',         '["indoor","outdoor","none"]'),
('house_services.weekly_family_spending',   'Weekly Family Spending',     'Economic', 'number',  'house_services', 'weekly_family_spending',   NULL),
('house_services.head_has_resident_partner','Head Has Resident Partner',  'Demographic','boolean','house_services','head_has_resident_partner', NULL),
-- Household assets
('house_services.has_laptop',               'Has Laptop',                 'Economic', 'boolean', 'house_services', 'has_laptop',               NULL),
('house_services.has_desktop',              'Has Desktop',                'Economic', 'boolean', 'house_services', 'has_desktop',              NULL),
('house_services.has_washing_machine',      'Has Washing Machine',        'Economic', 'boolean', 'house_services', 'has_washing_machine',      NULL),
('house_services.has_refrigerator',         'Has Refrigerator',           'Economic', 'boolean', 'house_services', 'has_refrigerator',         NULL),
('house_services.has_gas_stove',            'Has Gas Stove',              'Economic', 'boolean', 'house_services', 'has_gas_stove',            NULL),
('house_services.has_electric_stove',       'Has Electric Stove',         'Economic', 'boolean', 'house_services', 'has_electric_stove',       NULL),
('house_services.has_car',                  'Has Car',                    'Economic', 'boolean', 'house_services', 'has_car',                  NULL),
('house_services.has_fan',                  'Has Fan',                    'Economic', 'boolean', 'house_services', 'has_fan',                  NULL),
('house_services.has_air_conditioner',      'Has Air Conditioner',        'Economic', 'boolean', 'house_services', 'has_air_conditioner',      NULL),
('house_services.has_motorcycle',           'Has Motorcycle',             'Economic', 'boolean', 'house_services', 'has_motorcycle',           NULL),
('house_services.has_water_heater',         'Has Water Heater',           'Economic', 'boolean', 'house_services', 'has_water_heater',         NULL),
('house_services.has_generator',            'Has Generator',              'Economic', 'boolean', 'house_services', 'has_generator',            NULL),
('house_services.has_sewing_machine',       'Has Sewing Machine',         'Economic', 'boolean', 'house_services', 'has_sewing_machine',       NULL),
('house_services.has_stereo',              'Has Stereo',                 'Economic', 'boolean', 'house_services', 'has_stereo',              NULL),
('house_services.has_dvd_player',          'Has DVD Player',             'Economic', 'boolean', 'house_services', 'has_dvd_player',          NULL),
('house_services.has_video_equipment',     'Has Video Equipment',        'Economic', 'boolean', 'house_services', 'has_video_equipment',     NULL),
('house_services.has_dryer',               'Has Dryer',                  'Economic', 'boolean', 'house_services', 'has_dryer',               NULL),
('house_services.has_scanner',             'Has Scanner',                'Economic', 'boolean', 'house_services', 'has_scanner',             NULL)
ON CONFLICT (variable_code) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SEED DATA: rule_group (PMT, MT)
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO programme.rule_group (group_code, group_name, description, scoring_method) VALUES
('PMT', 'Proxy Means Test', 'Composite score based on household assets, housing quality, and spending patterns to estimate economic status', 'weighted_sum'),
('MT',  'Means Test',       'Direct income/pension-based assessment of family economic capacity', 'weighted_sum')
ON CONFLICT (group_code) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SEED DATA: rule_group_rules
-- ═══════════════════════════════════════════════════════════════════════════════

-- PMT group rules
INSERT INTO programme.rule_group_rules (rule_group_id, variable_code, operator, threshold_value, weight) VALUES
((SELECT rule_group_id FROM programme.rule_group WHERE group_code = 'PMT'), 'house_services.weekly_family_spending', '<=', '5000', 3.0),
((SELECT rule_group_id FROM programme.rule_group WHERE group_code = 'PMT'), 'house_services.rooms_occupied',         '<=', '3',    1.5),
((SELECT rule_group_id FROM programme.rule_group WHERE group_code = 'PMT'), 'house_services.has_car',               '==', 'false', 2.0),
((SELECT rule_group_id FROM programme.rule_group WHERE group_code = 'PMT'), 'house_services.lighting_source',       '!=', 'electricity', 1.0),
((SELECT rule_group_id FROM programme.rule_group WHERE group_code = 'PMT'), 'house_services.water_source',          '!=', 'indoor_tap', 1.5);

-- MT group rules
INSERT INTO programme.rule_group_rules (rule_group_id, variable_code, operator, threshold_value, weight) VALUES
((SELECT rule_group_id FROM programme.rule_group WHERE group_code = 'MT'), 'house_services.weekly_family_spending', '<=', '3000', 4.0),
((SELECT rule_group_id FROM programme.rule_group WHERE group_code = 'MT'), 'family_member.is_nis_pensioner',       '==', 'false', 2.0),
((SELECT rule_group_id FROM programme.rule_group WHERE group_code = 'MT'), 'family_member.occupation',             '==', 'unemployed', 3.0);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SEED DATA: rule_version_master
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO programme.rule_version_master (rule_version, description, effective_from) VALUES
('v1.0', 'Initial rule set', '2026-01-01')
ON CONFLICT (rule_version) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SEED DATA: rule_master (sample rules)
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO programme.rule_master (rule_code, rule_type, category, rule_name, description, data_type, variable_code) VALUES
('AGE_MIN',        'variable', 'Demographic', 'Minimum Age',           'Check if member age meets minimum threshold',      'date',    'family_member.date_of_birth'),
('INC_MAX',        'variable', 'Economic',    'Maximum Weekly Income', 'Check if weekly family spending is under threshold','number',  'house_services.weekly_family_spending'),
('DISABILITY_FLAG','variable', 'Health',      'Disability Status',     'Check if member has a disability',                 'boolean', 'family_member.is_disabled')
ON CONFLICT (rule_code) DO NOTHING;

-- Rule master entries for rule groups
INSERT INTO programme.rule_master (rule_code, rule_type, category, rule_name, description, data_type, rule_group_id) VALUES
('PMT_SCORE', 'group', 'Composite', 'Proxy Means Test Score', 'Composite PMT score from household indicators', 'number', (SELECT rule_group_id FROM programme.rule_group WHERE group_code = 'PMT')),
('MT_SCORE',  'group', 'Composite', 'Means Test Score',       'Composite MT score from income/pension data',   'number', (SELECT rule_group_id FROM programme.rule_group WHERE group_code = 'MT'))
ON CONFLICT (rule_code) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
SELECT 'PROGRAMME SCHEMA CREATED SUCCESSFULLY' AS result;
-- ═══════════════════════════════════════════════════════════════════════════════
