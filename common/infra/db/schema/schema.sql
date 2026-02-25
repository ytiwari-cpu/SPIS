-- ═══════════════════════════════════════════════════════════════════════════
-- SPIS IAM — RBAC CURRENT SCHEMA REFERENCE
-- Supabase Project: wrxrstmncezssrscrkxs (IAM DB)
--
-- This file documents the CURRENT state of RBAC / permission tables
-- in the IAM database after all migrations have been applied.
--
-- Tables live in the public schema alongside the base IAM tables.
-- Apply in order: iam-service-schema.sql → this file
-- ═══════════════════════════════════════════════════════════════════════════

-- NOTE: roles, permissions, role_permissions, user_permissions, audit_logs,
-- and import_jobs are now documented as part of iam-service-schema.sql.
-- This file contains the PERMISSION SEED DATA reflecting the current
-- system state after migrations 002, 011, 013, and 014.

-- ════════════════════════════════════════════════════════════════════════════
-- ADMIN MODULE PERMISSIONS
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO permissions (permission_key, permission_name, description, module) VALUES
-- Overview
('ADMIN.OVERVIEW.VIEW',           'View Admin Overview',    'Access the admin dashboard overview',           'admin'),
-- Families
('ADMIN.FAMILIES.VIEW',           'View Families',          'View all registered families',                  'admin'),
('ADMIN.FAMILIES.CREATE',         'Create Families',        'Register new families',                         'admin'),
('ADMIN.FAMILIES.EDIT',           'Edit Families',          'Modify family records',                         'admin'),
('ADMIN.FAMILIES.ARCHIVE',        'Archive Families',       'Archive family records',                        'admin'),
('ADMIN.FAMILIES.IMPORT',         'Import Families',        'Bulk import families from Excel',               'admin'),
-- Programmes
('ADMIN.PROGRAMMES.VIEW',         'View Programmes',        'View all programmes',                           'admin'),
('ADMIN.PROGRAMMES.CREATE',       'Create Programmes',      'Create new programmes',                         'admin'),
('ADMIN.PROGRAMMES.EDIT',         'Edit Programmes',        'Modify programme details',                      'admin'),
('ADMIN.PROGRAMMES.ARCHIVE',      'Archive Programmes',     'Archive programmes',                            'admin'),
('ADMIN.PROGRAMMES.IMPORT',       'Import Programmes',      'Bulk import programmes from Excel',             'admin'),
-- Grievances
('ADMIN.GRIEVANCES.VIEW',         'View Grievances',        'View all grievances',                           'admin'),
('ADMIN.GRIEVANCES.CREATE',       'Create Grievances',      'Create grievances on behalf of users',          'admin'),
('ADMIN.GRIEVANCES.EDIT',         'Edit Grievances',        'Update grievance status',                       'admin'),
('ADMIN.GRIEVANCES.ARCHIVE',      'Archive Grievances',     'Archive grievances',                            'admin'),
('ADMIN.GRIEVANCES.ASSIGN',       'Assign Grievances',      'Assign grievances to case workers',             'admin'),
-- Appeals
('ADMIN.APPEALS.VIEW',            'View Appeals',           'View all appeals',                              'admin'),
('ADMIN.APPEALS.EDIT',            'Edit Appeals',           'Update appeal status',                          'admin'),
('ADMIN.APPEALS.REVIEW',          'Review Appeals',         'Approve or deny appeals',                       'admin'),
('ADMIN.APPEALS.ARCHIVE',         'Archive Appeals',        'Archive appeals',                               'admin'),
-- Users / Case Workers
('ADMIN.USERS.VIEW',              'View Users',             'View all user accounts',                        'admin'),
('ADMIN.CASEWORKERS.VIEW',        'View Case Workers',      'View case worker list',                         'admin'),
('ADMIN.CASEWORKERS.CREATE',      'Create Case Workers',    'Invite case workers',                           'admin'),
('ADMIN.CASEWORKERS.EDIT',        'Edit Case Workers',      'Manage case worker accounts',                   'admin'),
-- Admins & Access
('ADMIN.ACCESS.VIEW',             'View Admin Access',      'View admin accounts and roles',                 'admin'),
('ADMIN.ACCESS.CREATE',           'Create Admin',           'Invite administrators',                         'admin'),
('ADMIN.ACCESS.EDIT',             'Edit Admin',             'Modify administrator accounts',                 'admin'),
-- Roles
('ADMIN.ROLES.VIEW',              'View Roles',             'View all roles and their permissions',          'admin'),
('ADMIN.ROLES.CREATE',            'Create Roles',           'Create new roles',                              'admin'),
('ADMIN.ROLES.EDIT',              'Edit Roles',             'Edit role name and description',                'admin'),
('ADMIN.ROLES.DELETE',            'Delete Roles',           'Delete custom roles',                           'admin'),
('ADMIN.ROLES.MANAGE_PERMISSIONS','Manage Role Permissions','Add/remove permissions from roles',             'admin'),
-- Audit Logs
('ADMIN.AUDITLOGS.VIEW',          'View Audit Logs',        'View system-wide audit log',                    'admin')
ON CONFLICT (permission_key) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- PROGRAMME MANAGER PERMISSIONS (module = 'programme')
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO permissions (permission_key, permission_name, description, module) VALUES
('PROGRAMME.PROGRAMMES.VIEW',       'View Programmes',          'View programme list and details',             'programme'),
('PROGRAMME.PROGRAMMES.CREATE',     'Create Programmes',        'Create new programmes',                       'programme'),
('PROGRAMME.PROGRAMMES.EDIT',       'Edit Programmes',          'Edit programme settings and configuration',   'programme'),
('PROGRAMME.PROGRAMMES.DELETE',     'Delete Programmes',        'Delete or archive programmes',                'programme'),
('PROGRAMME.PROGRAMMES.PUBLISH',    'Publish Programmes',       'Activate and publish draft programmes',       'programme'),
('PROGRAMME.BENEFICIARIES.VIEW',    'View Beneficiaries',       'View programme beneficiaries and enrolments', 'programme'),
('PROGRAMME.BENEFICIARIES.ENROLL',  'Enroll Beneficiaries',     'Enroll families into programmes',             'programme'),
('PROGRAMME.BENEFICIARIES.MANAGE',  'Manage Beneficiaries',     'Approve, suspend, or exit beneficiaries',     'programme'),
('PROGRAMME.RULES.VIEW',            'View Rules',               'View rule groups, rules, and variables',      'programme'),
('PROGRAMME.RULES.MANAGE',          'Manage Rules',             'Create, edit, and delete eligibility rules',  'programme'),
('PROGRAMME.REPORTS.VIEW',          'View Reports',             'View programme reports and analytics',        'programme'),
('PROGRAMME.MANAGERS.VIEW',         'View Programme Managers',  'View users assigned as programme managers',   'programme'),
('PROGRAMME.MANAGERS.MANAGE',       'Manage Programme Managers','Assign or remove programme managers',         'programme'),
('PROGRAMME.ENGINE.RUN',            'Run Eligibility Engine',   'Run the eligibility evaluation engine',       'programme'),
('PROGRAMME.AUDITLOGS.VIEW',        'View Programme Audit Logs','View programme change and exit audit logs',   'programme')
ON CONFLICT (permission_key) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- CITIZEN PERMISSIONS
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO permissions (permission_key, permission_name, description, module) VALUES
('CITIZEN.DASHBOARD.VIEW',  'View Dashboard',    'Access citizen dashboard',          'citizen'),
('CITIZEN.FAMILY.VIEW',     'View Family',       'View own family details',           'citizen'),
('CITIZEN.FAMILY.EDIT',     'Edit Family',       'Edit own family details',           'citizen'),
('CITIZEN.PROFILE.VIEW',    'View Profile',      'View own profile',                  'citizen'),
('CITIZEN.PROFILE.EDIT',    'Edit Profile',      'Edit own profile',                  'citizen'),
('CITIZEN.DOCUMENTS.VIEW',  'View Documents',    'View own documents',                'citizen'),
('CITIZEN.DOCUMENTS.CREATE','Upload Documents',  'Upload documents',                  'citizen'),
('CITIZEN.DOCUMENTS.DELETE','Delete Documents',  'Remove own documents',              'citizen'),
('CITIZEN.PROGRAMMES.VIEW', 'View Programmes',   'View available programmes',         'citizen'),
('CITIZEN.PROGRAMMES.APPLY','Apply to Programmes','Apply for programmes',             'citizen'),
('CITIZEN.BENEFITS.VIEW',   'View Benefits',     'View benefits and payments',        'citizen'),
('CITIZEN.GRIEVANCES.VIEW', 'View Grievances',   'View and submit grievances',        'citizen'),
('CITIZEN.GRIEVANCES.CREATE','Submit Grievances','Submit new grievances',             'citizen')
ON CONFLICT (permission_key) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- SYSTEM-LEVEL PERMISSIONS
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO permissions (permission_key, permission_name, description, module) VALUES
('SYSTEM.EXPORT', 'Export Data', 'Export any data from the system as CSV/Excel', 'system')
ON CONFLICT (permission_key) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- ROLE → PERMISSION GRANTS
-- SuperAdmin gets all; Admin gets admin.*; ProgrammeManager gets programme.*;
-- CaseWorker and Citizen get minimal sets
-- ════════════════════════════════════════════════════════════════════════════

-- SuperAdmin: all permissions
INSERT INTO role_permissions (role_name, permission_key, granted_by)
SELECT 'SuperAdmin', permission_key, 'system' FROM permissions
ON CONFLICT (role_name, permission_key) DO NOTHING;

-- Admin: all ADMIN.* + SYSTEM.EXPORT
INSERT INTO role_permissions (role_name, permission_key, granted_by)
SELECT 'Admin', permission_key, 'system' FROM permissions
WHERE module IN ('admin', 'system')
ON CONFLICT (role_name, permission_key) DO NOTHING;

-- ProgrammeManager: gateway + all PROGRAMME.*
INSERT INTO role_permissions (role_name, permission_key, granted_by) VALUES
('ProgrammeManager', 'ADMIN.PROGRAMMES.VIEW', 'system')
ON CONFLICT (role_name, permission_key) DO NOTHING;

INSERT INTO role_permissions (role_name, permission_key, granted_by)
SELECT 'ProgrammeManager', permission_key, 'system' FROM permissions
WHERE module = 'programme'
ON CONFLICT (role_name, permission_key) DO NOTHING;

-- Citizen: citizen.* permissions
INSERT INTO role_permissions (role_name, permission_key, granted_by)
SELECT 'Citizen', permission_key, 'system' FROM permissions
WHERE module = 'citizen'
ON CONFLICT (role_name, permission_key) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- DONE — RBAC seed complete
-- ════════════════════════════════════════════════════════════════════════════

