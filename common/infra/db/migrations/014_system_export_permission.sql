-- ═══════════════════════════════════════════════════════════════════
-- MIGRATION 014 — Consolidate Export Permissions → SYSTEM.EXPORT
--
-- Rationale:
--   Individual *.EXPORT permissions (ADMIN.FAMILIES.EXPORT,
--   ADMIN.PROGRAMMES.EXPORT, ADMIN.AUDITLOGS.EXPORT,
--   PROGRAMME.REPORTS.EXPORT) are replaced by a single cross-cutting
--   SYSTEM.EXPORT permission.  No feature owns export; it is a
--   system-level capability.
-- ═══════════════════════════════════════════════════════════════════

-- ── 0. Remove dead legacy SYSTEM.* permissions (never used in code) ──
DELETE FROM role_permissions
WHERE permission_key IN ('SYSTEM.EXPORT.ALL', 'SYSTEM.REPORTS.VIEW', 'SYSTEM.REPORTS.CREATE');

DELETE FROM permissions
WHERE permission_key IN ('SYSTEM.EXPORT.ALL', 'SYSTEM.REPORTS.VIEW', 'SYSTEM.REPORTS.CREATE');

-- ── 1. Remove old per-feature export permissions from role assignments ──
DELETE FROM role_permissions
WHERE permission_key IN (
  'ADMIN.FAMILIES.EXPORT',
  'ADMIN.PROGRAMMES.EXPORT',
  'ADMIN.AUDITLOGS.EXPORT',
  'PROGRAMME.REPORTS.EXPORT'
);

-- ── 2. Remove old per-feature export permissions from permissions table ──
DELETE FROM permissions
WHERE permission_key IN (
  'ADMIN.FAMILIES.EXPORT',
  'ADMIN.PROGRAMMES.EXPORT',
  'ADMIN.AUDITLOGS.EXPORT',
  'PROGRAMME.REPORTS.EXPORT'
);

-- ── 3. Add the single SYSTEM.EXPORT permission ──
INSERT INTO permissions (permission_key, permission_name, description, module)
VALUES ('SYSTEM.EXPORT', 'Export Data', 'Export any data from the system as CSV/Excel', 'system')
ON CONFLICT (permission_key) DO NOTHING;

-- ── 4. Grant SYSTEM.EXPORT to Admin and SuperAdmin ──
INSERT INTO role_permissions (role_name, permission_key, granted_by)
VALUES
  ('Admin',        'SYSTEM.EXPORT', 'system'),
  ('SuperAdmin',   'SYSTEM.EXPORT', 'system'),
  ('ProgrammeManager', 'SYSTEM.EXPORT', 'system')
ON CONFLICT (role_name, permission_key) DO NOTHING;

-- ── VERIFICATION ──
SELECT 'SYSTEM.EXPORT CREATED' AS result,
       COUNT(*) AS roles_granted
FROM role_permissions
WHERE permission_key = 'SYSTEM.EXPORT';

SELECT 'OLD EXPORT PERMS REMOVED' AS result,
       COUNT(*) AS remaining
FROM permissions
WHERE permission_key IN (
  'ADMIN.FAMILIES.EXPORT',
  'ADMIN.PROGRAMMES.EXPORT',
  'ADMIN.AUDITLOGS.EXPORT',
  'PROGRAMME.REPORTS.EXPORT'
);
