/**
 * Migration 013 — Programme Management Permissions
 *
 * Adds the complete PROGRAMME.* permission namespace for the
 * Programme Admin section, fixes the ProgrammeManager role, and
 * grants all new permissions to Admin and SuperAdmin.
 *
 * Permission design:
 *   ADMIN.PROGRAMMES.*   → broad access for full admins (already existed)
 *   PROGRAMME.*          → granular programme-management permissions
 *
 * Role grants after migration:
 *   ProgrammeManager  → ADMIN.PROGRAMMES.VIEW (gateway) + all PROGRAMME.*
 *   Admin             → existing ADMIN.PROGRAMMES.* + all PROGRAMME.*
 *   SuperAdmin        → existing + all PROGRAMME.* (bypass anyway, but for UI display)
 */

-- ═══════════════════════════════════════════════════════════════
-- 1. INSERT PROGRAMME.* PERMISSIONS
-- ═══════════════════════════════════════════════════════════════

INSERT INTO permissions (permission_key, permission_name, description, module) VALUES
  -- Programme CRUD
  ('PROGRAMME.PROGRAMMES.VIEW',       'View Programmes',          'View programme list and details',              'programme'),
  ('PROGRAMME.PROGRAMMES.CREATE',     'Create Programmes',        'Create new programmes',                        'programme'),
  ('PROGRAMME.PROGRAMMES.EDIT',       'Edit Programmes',          'Edit programme settings and configuration',    'programme'),
  ('PROGRAMME.PROGRAMMES.DELETE',     'Delete Programmes',        'Delete or archive programmes',                 'programme'),
  ('PROGRAMME.PROGRAMMES.PUBLISH',    'Publish Programmes',       'Activate and publish draft programmes',        'programme'),

  -- Beneficiary management
  ('PROGRAMME.BENEFICIARIES.VIEW',    'View Beneficiaries',       'View programme beneficiaries and enrolments',  'programme'),
  ('PROGRAMME.BENEFICIARIES.ENROLL',  'Enroll Beneficiaries',     'Enroll families into programmes',              'programme'),
  ('PROGRAMME.BENEFICIARIES.MANAGE',  'Manage Beneficiaries',     'Approve, suspend, or exit beneficiaries',      'programme'),

  -- Rules and variables
  ('PROGRAMME.RULES.VIEW',            'View Rules',               'View rule groups, rules, and variables',       'programme'),
  ('PROGRAMME.RULES.MANAGE',          'Manage Rules',             'Create, edit, and delete eligibility rules',   'programme'),

  -- Reports
  ('PROGRAMME.REPORTS.VIEW',          'View Reports',             'View programme reports and payment analytics',  'programme'),


  -- Programme managers
  ('PROGRAMME.MANAGERS.VIEW',         'View Programme Managers',  'View users assigned as programme managers',    'programme'),
  ('PROGRAMME.MANAGERS.MANAGE',       'Manage Programme Managers','Assign or remove programme managers',          'programme'),

  -- Eligibility engine
  ('PROGRAMME.ENGINE.RUN',            'Run Eligibility Engine',   'Run the eligibility evaluation engine',        'programme'),

  -- Audit logs
  ('PROGRAMME.AUDITLOGS.VIEW',        'View Programme Audit Logs','View programme change and exit audit logs',     'programme')

ON CONFLICT (permission_key) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- 2. FIX PROGRAMMEMANAGER ROLE
--    Old state: only had ADMIN.FAMILIES.VIEW (incorrect)
--    New state: gateway ADMIN.PROGRAMMES.VIEW + all PROGRAMME.*
-- ═══════════════════════════════════════════════════════════════

-- Remove all existing ProgrammeManager permissions (was incorrect)
DELETE FROM role_permissions WHERE role_name = 'ProgrammeManager';

-- Add correct permissions
INSERT INTO role_permissions (role_name, permission_key, granted_by) VALUES
  -- Gateway: determines PROGRAMME mode in getUserMode()
  ('ProgrammeManager', 'ADMIN.PROGRAMMES.VIEW',        'system'),

  -- Granular programme management
  ('ProgrammeManager', 'PROGRAMME.PROGRAMMES.VIEW',      'system'),
  ('ProgrammeManager', 'PROGRAMME.PROGRAMMES.CREATE',    'system'),
  ('ProgrammeManager', 'PROGRAMME.PROGRAMMES.EDIT',      'system'),
  ('ProgrammeManager', 'PROGRAMME.PROGRAMMES.DELETE',    'system'),
  ('ProgrammeManager', 'PROGRAMME.PROGRAMMES.PUBLISH',   'system'),

  ('ProgrammeManager', 'PROGRAMME.BENEFICIARIES.VIEW',   'system'),
  ('ProgrammeManager', 'PROGRAMME.BENEFICIARIES.ENROLL', 'system'),
  ('ProgrammeManager', 'PROGRAMME.BENEFICIARIES.MANAGE', 'system'),

  ('ProgrammeManager', 'PROGRAMME.RULES.VIEW',           'system'),
  ('ProgrammeManager', 'PROGRAMME.RULES.MANAGE',         'system'),

  ('ProgrammeManager', 'PROGRAMME.REPORTS.VIEW',         'system'),

  ('ProgrammeManager', 'PROGRAMME.MANAGERS.VIEW',        'system'),
  ('ProgrammeManager', 'PROGRAMME.MANAGERS.MANAGE',      'system'),

  ('ProgrammeManager', 'PROGRAMME.ENGINE.RUN',           'system'),
  ('ProgrammeManager', 'PROGRAMME.AUDITLOGS.VIEW',       'system')

ON CONFLICT (role_name, permission_key) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- 3. GRANT ALL PROGRAMME.* TO ADMIN ROLE
-- ═══════════════════════════════════════════════════════════════

INSERT INTO role_permissions (role_name, permission_key, granted_by)
SELECT 'Admin', permission_key, 'system'
FROM permissions
WHERE module = 'programme'
ON CONFLICT (role_name, permission_key) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- 4. GRANT ALL PROGRAMME.* TO SUPERADMIN ROLE
--    (SuperAdmin has a frontend/backend bypass, but DB entries are
--     needed so the role-management UI shows them correctly.)
-- ═══════════════════════════════════════════════════════════════

INSERT INTO role_permissions (role_name, permission_key, granted_by)
SELECT 'SuperAdmin', permission_key, 'system'
FROM permissions
WHERE module = 'programme'
ON CONFLICT (role_name, permission_key) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════

SELECT 'PROGRAMME PERMISSIONS SEEDED' AS result,
       COUNT(*) AS total_programme_permissions
FROM permissions
WHERE module = 'programme';

SELECT role_name, COUNT(*) AS permission_count
FROM role_permissions
WHERE role_name IN ('ProgrammeManager', 'Admin', 'SuperAdmin')
GROUP BY role_name
ORDER BY role_name;
