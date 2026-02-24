-- ============================================================================
-- SPIS Permission Registry Seed
-- ============================================================================
-- 
-- This file seeds the permission catalog with all known permissions.
-- 
-- NAMING CONVENTION: MODULE.RESOURCE.ACTION (UPPERCASE)
--   MODULE:   ADMIN, CITIZEN, SYSTEM
--   RESOURCE: FAMILIES, USERS, PROGRAMMES, etc.
--   ACTION:   VIEW, CREATE, EDIT, DELETE, EXPORT, ARCHIVE, etc.
-- 
-- Run after: 001_authz_schema.sql
-- ============================================================================

-- ════════════════════════════════════════════════════════════════════════════
-- ADMIN MODULE PERMISSIONS
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO authz.permission (code, label, description, module, resource, action) VALUES
-- Overview
('ADMIN.OVERVIEW.VIEW', 'View Admin Overview', 'Access the admin dashboard overview', 'ADMIN', 'OVERVIEW', 'VIEW'),

-- Families Management
('ADMIN.FAMILIES.VIEW', 'View Families', 'View all registered families', 'ADMIN', 'FAMILIES', 'VIEW'),
('ADMIN.FAMILIES.CREATE', 'Create Families', 'Register new families', 'ADMIN', 'FAMILIES', 'CREATE'),
('ADMIN.FAMILIES.EDIT', 'Edit Families', 'Modify family records', 'ADMIN', 'FAMILIES', 'EDIT'),
('ADMIN.FAMILIES.DELETE', 'Delete Families', 'Remove family records', 'ADMIN', 'FAMILIES', 'DELETE'),
('ADMIN.FAMILIES.EXPORT', 'Export Families', 'Export family data', 'ADMIN', 'FAMILIES', 'EXPORT'),
('ADMIN.FAMILIES.ARCHIVE', 'Archive Families', 'Archive family records', 'ADMIN', 'FAMILIES', 'ARCHIVE'),

-- Programmes Management
('ADMIN.PROGRAMMES.VIEW', 'View Programmes', 'View all programmes', 'ADMIN', 'PROGRAMMES', 'VIEW'),
('ADMIN.PROGRAMMES.CREATE', 'Create Programmes', 'Create new programmes', 'ADMIN', 'PROGRAMMES', 'CREATE'),
('ADMIN.PROGRAMMES.EDIT', 'Edit Programmes', 'Modify programme details', 'ADMIN', 'PROGRAMMES', 'EDIT'),
('ADMIN.PROGRAMMES.DELETE', 'Delete Programmes', 'Remove programmes', 'ADMIN', 'PROGRAMMES', 'DELETE'),
('ADMIN.PROGRAMMES.EXPORT', 'Export Programmes', 'Export programme data', 'ADMIN', 'PROGRAMMES', 'EXPORT'),
('ADMIN.PROGRAMMES.ASSIGN', 'Assign Programmes', 'Assign families to programmes', 'ADMIN', 'PROGRAMMES', 'ASSIGN'),

-- Grievances Management
('ADMIN.GRIEVANCES.VIEW', 'View Grievances', 'View all grievances', 'ADMIN', 'GRIEVANCES', 'VIEW'),
('ADMIN.GRIEVANCES.CREATE', 'Create Grievances', 'Create grievances on behalf of users', 'ADMIN', 'GRIEVANCES', 'CREATE'),
('ADMIN.GRIEVANCES.EDIT', 'Edit Grievances', 'Update grievance status', 'ADMIN', 'GRIEVANCES', 'EDIT'),
('ADMIN.GRIEVANCES.DELETE', 'Delete Grievances', 'Remove grievances', 'ADMIN', 'GRIEVANCES', 'DELETE'),
('ADMIN.GRIEVANCES.RESOLVE', 'Resolve Grievances', 'Mark grievances as resolved', 'ADMIN', 'GRIEVANCES', 'RESOLVE'),

-- Appeals Management
('ADMIN.APPEALS.VIEW', 'View Appeals', 'View all appeals', 'ADMIN', 'APPEALS', 'VIEW'),
('ADMIN.APPEALS.CREATE', 'Create Appeals', 'Create appeals', 'ADMIN', 'APPEALS', 'CREATE'),
('ADMIN.APPEALS.EDIT', 'Edit Appeals', 'Update appeal status', 'ADMIN', 'APPEALS', 'EDIT'),
('ADMIN.APPEALS.DELETE', 'Delete Appeals', 'Remove appeals', 'ADMIN', 'APPEALS', 'DELETE'),
('ADMIN.APPEALS.RESOLVE', 'Resolve Appeals', 'Resolve appeals', 'ADMIN', 'APPEALS', 'RESOLVE'),

-- User Management (Citizens)
('ADMIN.USERS.VIEW', 'View Users', 'View all citizen users', 'ADMIN', 'USERS', 'VIEW'),
('ADMIN.USERS.CREATE', 'Create Users', 'Create new users', 'ADMIN', 'USERS', 'CREATE'),
('ADMIN.USERS.EDIT', 'Edit Users', 'Modify user details', 'ADMIN', 'USERS', 'EDIT'),
('ADMIN.USERS.DELETE', 'Delete Users', 'Remove users', 'ADMIN', 'USERS', 'DELETE'),
('ADMIN.USERS.SUSPEND', 'Suspend Users', 'Suspend user accounts', 'ADMIN', 'USERS', 'SUSPEND'),

-- Case Workers Management
('ADMIN.CASEWORKERS.VIEW', 'View Case Workers', 'View case worker list', 'ADMIN', 'CASEWORKERS', 'VIEW'),
('ADMIN.CASEWORKERS.CREATE', 'Create Case Workers', 'Add new case workers', 'ADMIN', 'CASEWORKERS', 'CREATE'),
('ADMIN.CASEWORKERS.EDIT', 'Edit Case Workers', 'Modify case worker details', 'ADMIN', 'CASEWORKERS', 'EDIT'),
('ADMIN.CASEWORKERS.DELETE', 'Delete Case Workers', 'Remove case workers', 'ADMIN', 'CASEWORKERS', 'DELETE'),
('ADMIN.CASEWORKERS.ASSIGN', 'Assign Case Workers', 'Assign cases to workers', 'ADMIN', 'CASEWORKERS', 'ASSIGN'),

-- Admin Access Management
('ADMIN.ACCESS.VIEW', 'View Admin Access', 'View admin users', 'ADMIN', 'ACCESS', 'VIEW'),
('ADMIN.ACCESS.CREATE', 'Create Admin Access', 'Add admin users', 'ADMIN', 'ACCESS', 'CREATE'),
('ADMIN.ACCESS.EDIT', 'Edit Admin Access', 'Modify admin access', 'ADMIN', 'ACCESS', 'EDIT'),
('ADMIN.ACCESS.DELETE', 'Delete Admin Access', 'Remove admin access', 'ADMIN', 'ACCESS', 'DELETE'),
('ADMIN.ACCESS.MANAGE_PERMISSIONS', 'Manage Admin Permissions', 'Assign roles to admin users', 'ADMIN', 'ACCESS', 'MANAGE_PERMISSIONS'),

-- Role Management
('ADMIN.ROLES.VIEW', 'View Roles', 'View role definitions', 'ADMIN', 'ROLES', 'VIEW'),
('ADMIN.ROLES.CREATE', 'Create Roles', 'Create new roles', 'ADMIN', 'ROLES', 'CREATE'),
('ADMIN.ROLES.EDIT', 'Edit Roles', 'Modify role details', 'ADMIN', 'ROLES', 'EDIT'),
('ADMIN.ROLES.DELETE', 'Delete Roles', 'Remove roles', 'ADMIN', 'ROLES', 'DELETE'),
('ADMIN.ROLES.MANAGE_PERMISSIONS', 'Manage Role Permissions', 'Assign permissions to roles', 'ADMIN', 'ROLES', 'MANAGE_PERMISSIONS'),

-- Archived Records
('ADMIN.ARCHIVED.VIEW', 'View Archived', 'View archived records', 'ADMIN', 'ARCHIVED', 'VIEW'),
('ADMIN.ARCHIVED.RESTORE', 'Restore Archived', 'Restore archived records', 'ADMIN', 'ARCHIVED', 'RESTORE'),
('ADMIN.ARCHIVED.DELETE', 'Delete Archived', 'Permanently delete archived records', 'ADMIN', 'ARCHIVED', 'DELETE'),

-- Audit Logs
('ADMIN.AUDITLOGS.VIEW', 'View Audit Logs', 'View security audit logs', 'ADMIN', 'AUDITLOGS', 'VIEW'),
('ADMIN.AUDITLOGS.EXPORT', 'Export Audit Logs', 'Export audit log data', 'ADMIN', 'AUDITLOGS', 'EXPORT'),

-- ════════════════════════════════════════════════════════════════════════════
-- CITIZEN MODULE PERMISSIONS
-- ════════════════════════════════════════════════════════════════════════════

-- Dashboard
('CITIZEN.DASHBOARD.VIEW', 'View Dashboard', 'Access citizen dashboard', 'CITIZEN', 'DASHBOARD', 'VIEW'),

-- Family (Own)
('CITIZEN.FAMILY.VIEW', 'View Family', 'View own family details', 'CITIZEN', 'FAMILY', 'VIEW'),
('CITIZEN.FAMILY.EDIT', 'Edit Family', 'Edit own family details', 'CITIZEN', 'FAMILY', 'EDIT'),

-- Profile (Own)
('CITIZEN.PROFILE.VIEW', 'View Profile', 'View own profile', 'CITIZEN', 'PROFILE', 'VIEW'),
('CITIZEN.PROFILE.EDIT', 'Edit Profile', 'Edit own profile', 'CITIZEN', 'PROFILE', 'EDIT'),

-- Documents (Own)
('CITIZEN.DOCUMENTS.VIEW', 'View Documents', 'View own documents', 'CITIZEN', 'DOCUMENTS', 'VIEW'),
('CITIZEN.DOCUMENTS.UPLOAD', 'Upload Documents', 'Upload documents', 'CITIZEN', 'DOCUMENTS', 'UPLOAD'),
('CITIZEN.DOCUMENTS.DELETE', 'Delete Documents', 'Remove own documents', 'CITIZEN', 'DOCUMENTS', 'DELETE'),

-- Programmes (Own)
('CITIZEN.PROGRAMMES.VIEW', 'View Programmes', 'View available programmes', 'CITIZEN', 'PROGRAMMES', 'VIEW'),
('CITIZEN.PROGRAMMES.APPLY', 'Apply to Programmes', 'Apply to programmes', 'CITIZEN', 'PROGRAMMES', 'APPLY'),

-- Benefits (Own)
('CITIZEN.BENEFITS.VIEW', 'View Benefits', 'View received benefits', 'CITIZEN', 'BENEFITS', 'VIEW'),

-- Grievances (Own)
('CITIZEN.GRIEVANCES.VIEW', 'View Grievances', 'View own grievances', 'CITIZEN', 'GRIEVANCES', 'VIEW'),
('CITIZEN.GRIEVANCES.CREATE', 'Create Grievances', 'Submit grievances', 'CITIZEN', 'GRIEVANCES', 'CREATE'),

-- ════════════════════════════════════════════════════════════════════════════
-- SYSTEM MODULE PERMISSIONS
-- ════════════════════════════════════════════════════════════════════════════

('SYSTEM.SETTINGS.VIEW', 'View System Settings', 'View system configuration', 'SYSTEM', 'SETTINGS', 'VIEW'),
('SYSTEM.SETTINGS.EDIT', 'Edit System Settings', 'Modify system configuration', 'SYSTEM', 'SETTINGS', 'EDIT'),
('SYSTEM.MAINTENANCE.EXECUTE', 'Execute Maintenance', 'Run maintenance tasks', 'SYSTEM', 'MAINTENANCE', 'EXECUTE'),
('SYSTEM.BACKUP.CREATE', 'Create Backups', 'Create system backups', 'SYSTEM', 'BACKUP', 'CREATE'),
('SYSTEM.BACKUP.RESTORE', 'Restore Backups', 'Restore from backups', 'SYSTEM', 'BACKUP', 'RESTORE')

ON CONFLICT (code) DO UPDATE SET
    label = EXCLUDED.label,
    description = EXCLUDED.description,
    module = EXCLUDED.module,
    resource = EXCLUDED.resource,
    action = EXCLUDED.action,
    updated_at = now();

-- Log the seed operation
SELECT audit.log_event(
    'SEED_PERMISSIONS',
    'Seeded permission registry',
    NULL,
    'PERMISSION',
    NULL,
    NULL,
    jsonb_build_object('count', (SELECT count(*) FROM authz.permission)),
    true,
    NULL,
    NULL,
    'INFO',
    'ADMIN'
);
