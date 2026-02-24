-- ═══════════════════════════════════════════════════════════════════════════════
-- PROGRAMME MODULE REDESIGN — MIGRATION
-- Run in: https://supabase.com/dashboard/project/fwtcccwgijfcngtuawlx/sql/new
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Add status column to programme_master (DRAFT → ACTIVE → INACTIVE)
ALTER TABLE programme.programme_master
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'ACTIVE', 'INACTIVE'));

-- Update existing programmes to ACTIVE (since they were created before status existed)
UPDATE programme.programme_master SET status = 'ACTIVE' WHERE active_flag = true AND status IS NULL;
UPDATE programme.programme_master SET status = 'INACTIVE' WHERE active_flag = false AND status IS NULL;

-- 2. Junction table: links programmes to manager user_ids
CREATE TABLE IF NOT EXISTS programme.programme_manager_link (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  programme_id UUID NOT NULL REFERENCES programme.programme_master(programme_id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  added_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(programme_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_prog_mgr_link_user ON programme.programme_manager_link(user_id);
CREATE INDEX IF NOT EXISTS idx_prog_mgr_link_prog ON programme.programme_manager_link(programme_id);

-- 3. Add rules_tree JSONB column to programme_master for nested AND/OR rule logic
ALTER TABLE programme.programme_master
  ADD COLUMN IF NOT EXISTS rules_tree JSONB;

-- ═══════════════════════════════════════════════════════════════════════════════
SELECT 'PROGRAMME REDESIGN MIGRATION COMPLETE' AS result;
-- ═══════════════════════════════════════════════════════════════════════════════
