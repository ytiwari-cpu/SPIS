-- ═══════════════════════════════════════════════════════════════════════════
-- SPIS FAMILY MODULE - FINAL SCHEMA NORMALIZATION
-- Run this ONCE in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 1: FAMILY TABLE CHANGES
-- Add head contact fields, drop old FK column
-- ═══════════════════════════════════════════════════════════════════════════

-- Add new columns to family table
ALTER TABLE family.family 
  ADD COLUMN IF NOT EXISTS head_first_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS head_last_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Drop the old permanent_address_id FK (we use polymorphic addresses now)
ALTER TABLE family.family 
  DROP CONSTRAINT IF EXISTS family_permanent_address_id_fkey;

ALTER TABLE family.family 
  DROP COLUMN IF EXISTS permanent_address_id;

-- Update registration_status check constraint to allow UPPERCASE values
ALTER TABLE family.family 
  DROP CONSTRAINT IF EXISTS family_registration_status_check;

ALTER TABLE family.family 
  ADD CONSTRAINT family_registration_status_check 
  CHECK (registration_status IN ('draft', 'pending_verification', 'verified', 'rejected', 'DRAFT', 'SUBMITTED', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED'));

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 2: FAMILY_MEMBER TABLE CHANGES
-- Add phone/email, drop old FK column
-- ═══════════════════════════════════════════════════════════════════════════

-- Add new columns to family_member table
ALTER TABLE family.family_member 
  ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Drop the old current_address_id FK (we use polymorphic addresses now)
ALTER TABLE family.family_member 
  DROP CONSTRAINT IF EXISTS family_member_current_address_id_fkey;

ALTER TABLE family.family_member 
  DROP COLUMN IF EXISTS current_address_id;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 3: ADDRESS TABLE - ENSURE POLYMORPHIC COLUMNS EXIST
-- ═══════════════════════════════════════════════════════════════════════════

-- Add polymorphic columns if they don't exist
ALTER TABLE family.address 
  ADD COLUMN IF NOT EXISTS entity_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS entity_id UUID,
  ADD COLUMN IF NOT EXISTS address_type VARCHAR(20);

-- FIRST: Convert existing lowercase values to UPPERCASE before adding constraints
UPDATE family.address SET entity_type = UPPER(entity_type) WHERE entity_type IS NOT NULL;
UPDATE family.address SET address_type = UPPER(address_type) WHERE address_type IS NOT NULL;

-- Add check constraints for entity_type and address_type
ALTER TABLE family.address 
  DROP CONSTRAINT IF EXISTS address_entity_type_check;

ALTER TABLE family.address 
  ADD CONSTRAINT address_entity_type_check 
  CHECK (entity_type IN ('FAMILY', 'MEMBER'));

ALTER TABLE family.address 
  DROP CONSTRAINT IF EXISTS address_address_type_check;

ALTER TABLE family.address 
  ADD CONSTRAINT address_address_type_check 
  CHECK (address_type IN ('PERMANENT', 'CURRENT'));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_address_entity 
  ON family.address(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_address_type 
  ON family.address(address_type);

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 4: DOCUMENTS TABLE - ENSURE POLYMORPHIC COLUMNS EXIST
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE family.documents 
  ADD COLUMN IF NOT EXISTS owner_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS owner_id UUID,
  ADD COLUMN IF NOT EXISTS file_url TEXT,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'UPLOADED';

-- Convert existing lowercase values to UPPERCASE before adding constraints
UPDATE family.documents SET owner_type = UPPER(owner_type) WHERE owner_type IS NOT NULL;
UPDATE family.documents SET status = UPPER(status) WHERE status IS NOT NULL;

-- Add check constraint for owner_type
ALTER TABLE family.documents 
  DROP CONSTRAINT IF EXISTS documents_owner_type_check;

ALTER TABLE family.documents 
  ADD CONSTRAINT documents_owner_type_check 
  CHECK (owner_type IN ('FAMILY', 'MEMBER'));

-- Add check constraint for status
ALTER TABLE family.documents 
  DROP CONSTRAINT IF EXISTS documents_status_check;

ALTER TABLE family.documents 
  ADD CONSTRAINT documents_status_check 
  CHECK (status IN ('UPLOADED', 'PENDING', 'VERIFIED', 'REJECTED'));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_documents_owner 
  ON family.documents(owner_type, owner_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 5: FAMILY_HISTORY TABLE - ENSURE POLYMORPHIC COLUMNS EXIST
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE family.family_history 
  ADD COLUMN IF NOT EXISTS entity_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS entity_id UUID;

-- Convert existing lowercase values to UPPERCASE before adding constraints
UPDATE family.family_history SET entity_type = UPPER(entity_type) WHERE entity_type IS NOT NULL;

-- Add check constraint for entity_type
ALTER TABLE family.family_history 
  DROP CONSTRAINT IF EXISTS family_history_entity_type_check;

ALTER TABLE family.family_history 
  ADD CONSTRAINT family_history_entity_type_check 
  CHECK (entity_type IN ('FAMILY', 'MEMBER', 'ADDRESS', 'DOCUMENT', 'ACCOUNT'));

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 6: DATA CLEANUP (DEV ONLY - REMOVES ALL TEST DATA)
-- ═══════════════════════════════════════════════════════════════════════════

-- Clear all existing test data (order matters due to FKs)
DELETE FROM family.family_event_outbox;
DELETE FROM family.family_history;
DELETE FROM family.document_verification;
DELETE FROM family.documents;
DELETE FROM family.account_details;
DELETE FROM family.biometric_metadata;
DELETE FROM family.identity_match;
DELETE FROM family.family_member;
DELETE FROM family.address;
DELETE FROM family.family;

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION QUERY - Run after to confirm
-- ═══════════════════════════════════════════════════════════════════════════

-- SELECT 
--   'family' as table_name,
--   column_name,
--   data_type
-- FROM information_schema.columns 
-- WHERE table_schema = 'family' 
--   AND table_name = 'family'
--   AND column_name IN ('head_first_name', 'head_last_name', 'phone', 'email', 'permanent_address_id')
-- UNION ALL
-- SELECT 
--   'family_member' as table_name,
--   column_name,
--   data_type
-- FROM information_schema.columns 
-- WHERE table_schema = 'family' 
--   AND table_name = 'family_member'
--   AND column_name IN ('phone', 'email', 'current_address_id')
-- UNION ALL
-- SELECT 
--   'address' as table_name,
--   column_name,
--   data_type
-- FROM information_schema.columns 
-- WHERE table_schema = 'family' 
--   AND table_name = 'address'
--   AND column_name IN ('entity_type', 'entity_id', 'address_type');

SELECT 'SCHEMA FIX COMPLETE' as result;
