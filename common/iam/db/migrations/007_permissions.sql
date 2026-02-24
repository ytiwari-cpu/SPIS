/**
 * IAM Database Migration 007 - Role-Based Permission System
 * 
 * Creates tables for fine-grained permission control:
 * - permissions: Define what actions exist (e.g., view_grievances, manage_users)
 * - role_permissions: Link roles to permissions
 */

-- ═══════════════════════════════════════════════════════════════
-- PERMISSIONS TABLE
-- Defines all available permissions in the system
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS permissions (
  permission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_key VARCHAR(100) UNIQUE NOT NULL,  -- e.g., 'view_grievances', 'manage_users'
  permission_name VARCHAR(200) NOT NULL,         -- Display name
  description TEXT,
  module VARCHAR(50) NOT NULL,                   -- e.g., 'citizen', 'admin', 'grievances'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_permissions_key ON permissions(permission_key);
CREATE INDEX idx_permissions_module ON permissions(module);

-- ═══════════════════════════════════════════════════════════════
-- ROLE_PERMISSIONS TABLE
-- Links roles to permissions (many-to-many)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS role_permissions (
  role_permission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name VARCHAR(50) NOT NULL,                -- References user_roles.role_name
  permission_key VARCHAR(100) NOT NULL,          -- References permissions.permission_key
  granted_by VARCHAR(255),                       -- Who granted this permission
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(role_name, permission_key),
  FOREIGN KEY (permission_key) REFERENCES permissions(permission_key) ON DELETE CASCADE
);

CREATE INDEX idx_role_permissions_role ON role_permissions(role_name);
CREATE INDEX idx_role_permissions_permission ON role_permissions(permission_key);

-- ═══════════════════════════════════════════════════════════════
-- SEED DEFAULT PERMISSIONS
-- ═══════════════════════════════════════════════════════════════

INSERT INTO permissions (permission_key, permission_name, description, module) VALUES
  -- Citizen Portal Permissions
  ('view_dashboard', 'View Dashboard', 'Access citizen dashboard', 'citizen'),
  ('view_family', 'View Family', 'View family information', 'citizen'),
  ('edit_family', 'Edit Family', 'Edit family information', 'citizen'),
  ('view_profile', 'View Profile', 'View personal profile', 'citizen'),
  ('edit_profile', 'Edit Profile', 'Edit personal profile', 'citizen'),
  ('view_documents', 'View Documents', 'View uploaded documents', 'citizen'),
  ('upload_documents', 'Upload Documents', 'Upload new documents', 'citizen'),
  ('view_programmes', 'View Programmes', 'View available programmes', 'citizen'),
  ('apply_programmes', 'Apply to Programmes', 'Apply for programmes', 'citizen'),
  ('view_benefits', 'View Benefits', 'View benefits and payments', 'citizen'),
  ('view_grievances', 'View Grievances', 'View and submit grievances', 'citizen'),
  ('submit_grievances', 'Submit Grievances', 'Submit new grievances', 'citizen'),
  
  -- Admin Permissions
  ('manage_roles', 'Manage Roles', 'Create and manage user roles', 'admin'),
  ('manage_permissions', 'Manage Permissions', 'Assign permissions to roles', 'admin'),
  ('manage_users', 'Manage Users', 'View and manage all users', 'admin'),
  ('view_audit_logs', 'View Audit Logs', 'Access system audit logs', 'admin'),
  
  -- Case Worker Permissions
  ('verify_documents', 'Verify Documents', 'Verify citizen documents', 'caseworker'),
  ('review_applications', 'Review Applications', 'Review programme applications', 'caseworker'),
  ('manage_cases', 'Manage Cases', 'Manage citizen cases', 'caseworker')

ON CONFLICT (permission_key) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- SEED DEFAULT ROLE PERMISSIONS
-- ═══════════════════════════════════════════════════════════════

-- Citizen Role: Full access except grievances (will be disabled initially)
INSERT INTO role_permissions (role_name, permission_key, granted_by) VALUES
  ('Citizen', 'view_dashboard', 'system'),
  ('Citizen', 'view_family', 'system'),
  ('Citizen', 'edit_family', 'system'),
  ('Citizen', 'view_profile', 'system'),
  ('Citizen', 'edit_profile', 'system'),
  ('Citizen', 'view_documents', 'system'),
  ('Citizen', 'upload_documents', 'system'),
  ('Citizen', 'view_programmes', 'system'),
  ('Citizen', 'apply_programmes', 'system'),
  ('Citizen', 'view_benefits', 'system')
  -- NOTE: view_grievances and submit_grievances are intentionally EXCLUDED
  
ON CONFLICT (role_name, permission_key) DO NOTHING;

-- Admin Role: All permissions
INSERT INTO role_permissions (role_name, permission_key, granted_by)
SELECT 'Admin', permission_key, 'system'
FROM permissions
ON CONFLICT (role_name, permission_key) DO NOTHING;

-- SuperAdmin Role: All permissions (same as Admin for now)
INSERT INTO role_permissions (role_name, permission_key, granted_by)
SELECT 'SuperAdmin', permission_key, 'system'
FROM permissions
ON CONFLICT (role_name, permission_key) DO NOTHING;

-- Case Worker Role: Citizen permissions + verification
INSERT INTO role_permissions (role_name, permission_key, granted_by) VALUES
  ('CaseWorker', 'view_dashboard', 'system'),
  ('CaseWorker', 'verify_documents', 'system'),
  ('CaseWorker', 'review_applications', 'system'),
  ('CaseWorker', 'manage_cases', 'system')
ON CONFLICT (role_name, permission_key) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES
-- ═══════════════════════════════════════════════════════════════

-- View all permissions
-- SELECT * FROM permissions ORDER BY module, permission_key;

-- View permissions by role
-- SELECT r.role_name, p.permission_key, p.permission_name, p.module
-- FROM role_permissions r
-- JOIN permissions p ON r.permission_key = p.permission_key
-- ORDER BY r.role_name, p.module, p.permission_key;

-- Check if Citizen has grievances permission (should be empty)
-- SELECT * FROM role_permissions 
-- WHERE role_name = 'Citizen' 
-- AND permission_key IN ('view_grievances', 'submit_grievances');

SELECT 'PERMISSIONS SYSTEM INITIALIZED' as result;
