-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 006: RENAME ID COLUMNS TO PRIORITIZE HUMAN-READABLE IDS
-- ═══════════════════════════════════════════════════════════════════════════
-- Purpose: 
--   - Rename family_id (UUID) → uuid, family_code (F123) → family_id
--   - Rename member_id (UUID) → uuid, member_code (F123M01) → member_id  
--   - Update foreign key family_member.family_id → family_member.family_uuid
-- ═══════════════════════════════════════════════════════════════════════════

-- STEP 1: Drop existing constraints that reference the columns
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop foreign key on family_member.family_id
ALTER TABLE family.family_member 
  DROP CONSTRAINT IF EXISTS family_member_family_id_fkey;

-- Drop unique constraint on family_code and member_code
ALTER TABLE family.family 
  DROP CONSTRAINT IF EXISTS family_family_code_key;

ALTER TABLE family.family_member 
  DROP CONSTRAINT IF EXISTS family_member_member_code_key;

-- STEP 2: Rename columns in family table
-- ═══════════════════════════════════════════════════════════════════════════

-- First rename family_id to uuid
ALTER TABLE family.family 
  RENAME COLUMN family_id TO uuid;

-- Then rename family_code to family_id
ALTER TABLE family.family 
  RENAME COLUMN family_code TO family_id;

-- STEP 3: Rename columns in family_member table
-- ═══════════════════════════════════════════════════════════════════════════

-- First rename family_id to family_uuid (the FK reference)
ALTER TABLE family.family_member 
  RENAME COLUMN family_id TO family_uuid;

-- Rename member_id to uuid
ALTER TABLE family.family_member 
  RENAME COLUMN member_id TO uuid;

-- Rename member_code to member_id
ALTER TABLE family.family_member 
  RENAME COLUMN member_code TO member_id;

-- STEP 4: Recreate constraints
-- ═══════════════════════════════════════════════════════════════════════════

-- Add primary key constraint on family.uuid if not exists
-- (The PK should auto-rename, but let's ensure it)

-- Add unique constraint on new family_id (human-readable)
ALTER TABLE family.family 
  ADD CONSTRAINT family_family_id_key UNIQUE (family_id);

-- Add unique constraint on new member_id (human-readable)
ALTER TABLE family.family_member 
  ADD CONSTRAINT family_member_member_id_key UNIQUE (member_id);

-- Recreate foreign key: family_member.family_uuid → family.uuid
ALTER TABLE family.family_member 
  ADD CONSTRAINT family_member_family_uuid_fkey 
  FOREIGN KEY (family_uuid) REFERENCES family.family(uuid) ON DELETE CASCADE;

-- STEP 5: Update the code generation functions
-- ═══════════════════════════════════════════════════════════════════════════

-- Update generate_family_code → generate_family_id
DROP FUNCTION IF EXISTS family.generate_family_code();

CREATE OR REPLACE FUNCTION family.generate_family_id()
RETURNS VARCHAR(20) AS $$
DECLARE
  next_seq INTEGER;
BEGIN
  next_seq := nextval('family.family_code_seq');
  RETURN 'F' || next_seq;
END;
$$ LANGUAGE plpgsql;

-- Update generate_member_code → generate_member_id
DROP FUNCTION IF EXISTS family.generate_member_code(UUID);

CREATE OR REPLACE FUNCTION family.generate_member_id(p_family_uuid UUID)
RETURNS VARCHAR(30) AS $$
DECLARE
  fam_id VARCHAR(20);
  member_count INTEGER;
BEGIN
  -- Get family_id (human readable F123)
  SELECT family_id INTO fam_id 
  FROM family.family 
  WHERE uuid = p_family_uuid;
  
  IF fam_id IS NULL THEN
    RAISE EXCEPTION 'Family not found';
  END IF;
  
  -- Count existing members
  SELECT COUNT(*) INTO member_count
  FROM family.family_member
  WHERE family_uuid = p_family_uuid;
  
  -- Return formatted member_id: F123M001
  RETURN fam_id || 'M' || LPAD((member_count + 1)::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- STEP 6: Update address table entity_id references (polymorphic)
-- ═══════════════════════════════════════════════════════════════════════════
-- Note: The address table uses entity_id which stores UUIDs.
-- We need to keep UUIDs there but the column names make more sense.
-- No change needed as entity_id is already correctly named.

-- STEP 7: Create a view for easier querying (optional, helpful)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW family.family_with_members AS
SELECT 
  f.uuid AS family_uuid,
  f.family_id,
  f.household_size,
  f.head_first_name,
  f.head_last_name,
  f.phone,
  f.email,
  f.vulnerability_flag,
  f.status,
  f.registration_status,
  fm.uuid AS member_uuid,
  fm.member_id,
  fm.first_name,
  fm.last_name,
  fm.relationship_to_head,
  fm.member_status
FROM family.family f
LEFT JOIN family.family_member fm ON fm.family_uuid = f.uuid;

-- STEP 8: Update family_history references
-- ═══════════════════════════════════════════════════════════════════════════
-- Note: family_history.entity_id stores UUIDs, which is correct.
-- The polymorphic references remain UUID-based for internal consistency.

-- STEP 9: Update documents and account_details references  
-- ═══════════════════════════════════════════════════════════════════════════
-- Note: These use owner_id which stores UUIDs. No change needed.

-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION COMPLETE
-- ═══════════════════════════════════════════════════════════════════════════
-- Summary of changes:
--   family table:
--     - family_id (UUID) → uuid
--     - family_code (F123) → family_id
--   
--   family_member table:
--     - member_id (UUID) → uuid  
--     - family_id (UUID FK) → family_uuid
--     - member_code (F123M01) → member_id
--
--   Functions:
--     - generate_family_code() → generate_family_id()
--     - generate_member_code(UUID) → generate_member_id(UUID)
-- ═══════════════════════════════════════════════════════════════════════════
