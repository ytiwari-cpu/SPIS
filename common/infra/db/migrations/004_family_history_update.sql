-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 004: UPDATE FAMILY_HISTORY FOR JSON AUDIT TRAIL (MINIMAL)
-- ═══════════════════════════════════════════════════════════════════════════

-- Add new columns only
ALTER TABLE family.family_history 
  ADD COLUMN IF NOT EXISTS entity_type VARCHAR(30) DEFAULT 'FAMILY';

ALTER TABLE family.family_history 
  ADD COLUMN IF NOT EXISTS entity_id UUID;

ALTER TABLE family.family_history 
  ADD COLUMN IF NOT EXISTS change_type VARCHAR(30) DEFAULT 'modified';

ALTER TABLE family.family_history 
  ADD COLUMN IF NOT EXISTS reason TEXT;

-- Done!
SELECT 'Migration 004 complete' as status;
