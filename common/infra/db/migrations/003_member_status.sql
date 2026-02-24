-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 003: MEMBER STATUS AND TRANSFER TRACKING
-- ═══════════════════════════════════════════════════════════════════════════
-- Purpose: Add member_status field for tracking active/inactive/deceased/transferred
--          Add transfer_reason for documenting why a member left or joined
--          Add joined_date and left_date for lifecycle tracking
-- ═══════════════════════════════════════════════════════════════════════════

-- STEP 1: Add member_status to family_member
-- Values: ACTIVE (living with family), INACTIVE (temporarily away), 
--         DECEASED (passed away), TRANSFERRED_OUT (left family - marriage, etc.)
ALTER TABLE family.family_member 
  ADD COLUMN IF NOT EXISTS member_status VARCHAR(30) 
    DEFAULT 'ACTIVE' 
    CHECK (member_status IN ('ACTIVE', 'INACTIVE', 'DECEASED', 'TRANSFERRED_OUT'));

-- STEP 2: Add transfer/status change reason
-- Tracks WHY a member's status changed
ALTER TABLE family.family_member 
  ADD COLUMN IF NOT EXISTS status_reason VARCHAR(100);

-- STEP 3: Add lifecycle dates
ALTER TABLE family.family_member 
  ADD COLUMN IF NOT EXISTS joined_date DATE;

ALTER TABLE family.family_member 
  ADD COLUMN IF NOT EXISTS left_date DATE;

-- STEP 4: Add transfer type for more detail
-- Values: BIRTH (new baby), MARRIAGE_IN (spouse joined), MARRIAGE_OUT (left for marriage),
--         ADOPTION_IN, ADOPTION_OUT, DEATH, RELOCATION, OTHER
ALTER TABLE family.family_member 
  ADD COLUMN IF NOT EXISTS change_type VARCHAR(30)
    CHECK (change_type IN (
      'BIRTH', 'MARRIAGE_IN', 'MARRIAGE_OUT', 
      'ADOPTION_IN', 'ADOPTION_OUT', 
      'DEATH', 'RELOCATION', 'OTHER', NULL
    ));

-- STEP 5: Update existing records
-- Set all existing members to ACTIVE if alive_flag is true
UPDATE family.family_member 
  SET member_status = CASE 
    WHEN alive_flag = false THEN 'DECEASED'
    ELSE 'ACTIVE'
  END
  WHERE member_status IS NULL;

-- STEP 6: Create member_transfer_log table for audit trail
CREATE TABLE IF NOT EXISTS family.member_transfer_log (
  log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID NOT NULL REFERENCES family.family_member(member_id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES family.family(family_id) ON DELETE CASCADE,
  action VARCHAR(30) NOT NULL CHECK (action IN ('JOINED', 'LEFT', 'STATUS_CHANGE', 'DEATH')),
  old_status VARCHAR(30),
  new_status VARCHAR(30),
  change_type VARCHAR(30),
  reason TEXT,
  effective_date DATE DEFAULT CURRENT_DATE,
  recorded_by VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- STEP 7: Create index for transfer log queries
CREATE INDEX IF NOT EXISTS idx_member_transfer_log_member 
  ON family.member_transfer_log(member_id);

CREATE INDEX IF NOT EXISTS idx_member_transfer_log_family 
  ON family.member_transfer_log(family_id);

-- STEP 8: Comment for documentation
COMMENT ON COLUMN family.family_member.member_status IS 
  'Current status: ACTIVE (in household), INACTIVE (temp away), DECEASED, TRANSFERRED_OUT';

COMMENT ON COLUMN family.family_member.status_reason IS 
  'Reason for current status (e.g., "Married and moved to spouse family", "Passed away - illness")';

COMMENT ON COLUMN family.family_member.change_type IS 
  'Type of change that led to current status: BIRTH, MARRIAGE_IN/OUT, ADOPTION_IN/OUT, DEATH, etc.';

COMMENT ON TABLE family.member_transfer_log IS 
  'Audit trail for all member status changes including joins, leaves, and deaths';

-- Done!
SELECT 'Migration 003: Member status and transfer tracking - COMPLETE' as status;
