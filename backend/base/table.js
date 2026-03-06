/**
 * backend/base/table.js
 *
 * Single source of truth for ALL table names across all SPIS backend services.
 * Every repository MUST import table names from here — never use raw strings.
 *
 * Grouped by service/schema.
 * DO NOT rename any table or column — these match the deployed schema exactly.
 */

// ═══════════════════════════════════════════════════════════════
// FAMILY SERVICE TABLES (Supabase — family schema)
// ═══════════════════════════════════════════════════════════════

export const FAMILY_TABLES = {
  FAMILY:               'family',
  FAMILY_MEMBER:        'family_member',
  ADDRESS:              'address',
  DOCUMENTS:            'documents',
  DOCUMENT_VERIFICATION:'document_verification',
  BIOMETRIC_METADATA:   'biometric_metadata',
  ACCOUNT_DETAILS:      'account_details',
  IDENTITY_MATCH:       'identity_match',
  FAMILY_HISTORY:       'family_history',
  FAMILY_EVENT_OUTBOX:  'family_event_outbox',
  HOUSE_SERVICES:       'house_services',
}

// ═══════════════════════════════════════════════════════════════
// IAM SERVICE TABLES (PostgreSQL — auth_db)
// ═══════════════════════════════════════════════════════════════

export const IAM_TABLES = {
  USERS:                'users',
  USER_ROLES:           'user_roles',
  MFA_FACTORS:          'mfa_factors',
  LOGIN_EVENTS:         'login_events',
  PASSWORD_RESET_TOKENS:'password_reset_tokens',
  PERMISSIONS:          'permissions',
  ROLE_PERMISSIONS:     'role_permissions',
  AUDIT_LOGS:           'audit_logs',
}

// ═══════════════════════════════════════════════════════════════
// EMAIL SERVICE TABLES (PostgreSQL — email_db)
// ═══════════════════════════════════════════════════════════════

export const EMAIL_TABLES = {
  EMAIL_REQUESTS:       'email_requests',
  EMAIL_PROVIDERS:      'email_providers',
  BOUNCE_FEEDBACK:      'bounce_feedback',
  RATE_LIMITS:          'rate_limits',
  TEMPLATE_VERSIONS:    'template_versions',
}

// ═══════════════════════════════════════════════════════════════
// PROGRAMME SERVICE TABLES (Supabase — programme schema)
// ═══════════════════════════════════════════════════════════════

export const PROGRAMME_TABLES = {
  PROGRAMME_MASTER:           'programme_master',
  PROGRAMME_CONFIG:           'programme_config',
  PROGRAMME_PAYMENT_SETTINGS: 'programme_payment_settings',
  PROGRAMME_HISTORY:          'programme_history',
  PROGRAMME_RULES:            'programme_rules',
  PROGRAMME_RULES_HISTORY:    'programme_rules_history',
  PROGRAMME_MANAGER_LINK:     'programme_manager_link',
  PROGRAMME_CITIZENS:         'programme_citizens',
  PROGRAMME_EXIT_HISTORY:     'programme_exit_history',
  RULE_MASTER:                'rule_master',
  RULE_VERSION_MASTER:        'rule_version_master',
  RULE_GROUP:                 'rule_group',
  RULE_GROUP_RULES:           'rule_group_rules',
  RULE_VARIABLE_CATALOG:      'rule_variable_catalog',
  CUSTOM_FIELD_DEFINITIONS:   'custom_field_definitions',
  CONDITIONALITY_COMPLIANCE:  'conditionality_compliance',
}

// ═══════════════════════════════════════════════════════════════
// COMBINED — flat export for quick access: TABLES.FAMILY, TABLES.USERS, etc.
// ═══════════════════════════════════════════════════════════════

export const TABLES = {
  ...FAMILY_TABLES,
  ...IAM_TABLES,
  ...EMAIL_TABLES,
  ...PROGRAMME_TABLES,
}
