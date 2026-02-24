-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 005: FAMILY CODES, MEMBER CODES, AND ANNUAL INCOME
-- ═══════════════════════════════════════════════════════════════════════════
-- Purpose: Add human-readable codes (F123, F123M001) and annual income tracking
-- ═══════════════════════════════════════════════════════════════════════════

-- STEP 1: Create sequences for code generation
CREATE SEQUENCE IF NOT EXISTS family.family_code_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS family.member_code_seq START WITH 1 INCREMENT BY 1;

-- STEP 2: Add family_code to family table
ALTER TABLE family.family 
  ADD COLUMN IF NOT EXISTS family_code VARCHAR(20) UNIQUE;

-- STEP 3: Add member_code and annual_income to family_member table
ALTER TABLE family.family_member 
  ADD COLUMN IF NOT EXISTS member_code VARCHAR(30) UNIQUE;

ALTER TABLE family.family_member 
  ADD COLUMN IF NOT EXISTS annual_income NUMERIC(12, 2) DEFAULT 0;

-- STEP 4: Populate existing families with codes (F1, F2, F3, etc.)
-- Only update rows where family_code is null
DO $$
DECLARE
  family_rec RECORD;
  next_seq INTEGER;
BEGIN
  FOR family_rec IN 
    SELECT family_id FROM family.family 
    WHERE family_code IS NULL 
    ORDER BY created_at
  LOOP
    next_seq := nextval('family.family_code_seq');
    UPDATE family.family 
      SET family_code = 'F' || next_seq 
      WHERE family_id = family_rec.family_id;
  END LOOP;
END $$;

-- STEP 5: Populate existing members with codes (F1M001, F1M002, etc.)
-- Groups by family and assigns sequential member numbers
DO $$
DECLARE
  member_rec RECORD;
  current_family_id UUID := NULL;
  member_counter INTEGER := 0;
  fam_code VARCHAR(20);
BEGIN
  FOR member_rec IN 
    SELECT m.member_id, m.family_id, f.family_code
    FROM family.family_member m
    JOIN family.family f ON m.family_id = f.family_id
    WHERE m.member_code IS NULL 
    ORDER BY f.family_id, m.created_at
  LOOP
    -- Reset counter for new family
    IF current_family_id IS NULL OR current_family_id != member_rec.family_id THEN
      current_family_id := member_rec.family_id;
      member_counter := 0;
    END IF;
    
    member_counter := member_counter + 1;
    fam_code := member_rec.family_code;
    
    UPDATE family.family_member 
      SET member_code = fam_code || 'M' || LPAD(member_counter::TEXT, 3, '0')
      WHERE member_id = member_rec.member_id;
  END LOOP;
END $$;

-- STEP 6: Make family_code NOT NULL after populating
ALTER TABLE family.family 
  ALTER COLUMN family_code SET NOT NULL;

-- STEP 7: Create function to generate next family code
CREATE OR REPLACE FUNCTION family.generate_family_code()
RETURNS VARCHAR(20) AS $$
DECLARE
  next_seq INTEGER;
BEGIN
  next_seq := nextval('family.family_code_seq');
  RETURN 'F' || next_seq;
END;
$$ LANGUAGE plpgsql;

-- STEP 8: Create function to generate next member code for a family
CREATE OR REPLACE FUNCTION family.generate_member_code(p_family_id UUID)
RETURNS VARCHAR(30) AS $$
DECLARE
  fam_code VARCHAR(20);
  member_count INTEGER;
BEGIN
  -- Get family code
  SELECT family_code INTO fam_code 
  FROM family.family 
  WHERE family_id = p_family_id;
  
  IF fam_code IS NULL THEN
    RAISE EXCEPTION 'Family not found';
  END IF;
  
  -- Count existing members in this family
  SELECT COUNT(*) + 1 INTO member_count 
  FROM family.family_member 
  WHERE family_id = p_family_id;
  
  RETURN fam_code || 'M' || LPAD(member_count::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- Done!
SELECT 'Migration 005 complete - family_code, member_code, annual_income added' as status;
