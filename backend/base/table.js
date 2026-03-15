/**
 * backend/base/table.js
 *
 * Single source of truth for ALL table names across all SPIS backend services.
 * Every repository MUST import table names from here — never use raw strings.
 *
 * Grouped by service. Each service has its own Supabase project and schema.
 *
 * Table name format rules:
 *  - IAM and Email services use the PUBLIC schema — plain table names, no prefix.
 *  - Family service uses the 'family' schema — AUDIT_LOG uses 'family.<table>'
 *    because it is accessed via pool (no schema-scoping), all other tables use
 *    plain names via the schema-scoped Supabase JS client.
 *  - Programme service uses the 'programme' schema — same rule as family.
 *
 * DO NOT rename any table or column — these match the deployed schema exactly.
 */

// ═══════════════════════════════════════════════════════════════
// FAMILY SERVICE  (Supabase — family schema)
// ═══════════════════════════════════════════════════════════════

export const FAMILY = {
  FAMILY:                'family',
  FAMILY_MEMBER:         'family_member',
  ADDRESS:               'address',
  DOCUMENTS:             'documents',
  DOCUMENT_VERIFICATION: 'document_verification',
  BIOMETRIC_METADATA:    'biometric_metadata',
  ACCOUNT_DETAILS:       'account_details',
  IDENTITY_MATCH:        'identity_match',
  FAMILY_HISTORY:        'family_history',
  FAMILY_EVENT_OUTBOX:   'family_event_outbox',
  HOUSE_SERVICES:        'house_services',
  AUDIT_LOG:             'family.audit_logs',  // schema-qualified — accessed via pool
}

// ═══════════════════════════════════════════════════════════════
// IAM SERVICE  (Supabase — public schema)
// ═══════════════════════════════════════════════════════════════

export const IAM = {
  USERS:                 'users',
  USER_ROLES:            'user_roles',
  MFA_FACTORS:           'mfa_factors',
  LOGIN_EVENTS:          'login_events',
  PASSWORD_RESET_TOKENS: 'password_reset_tokens',
  ROLES:                 'roles',
  PERMISSIONS:           'permissions',
  ROLE_PERMISSIONS:      'role_permissions',
  AUDIT_LOG:             'audit_logs',  // business-logic audit (uuid, user_id, created_by, logs)
}

// ═══════════════════════════════════════════════════════════════
// EMAIL SERVICE  (Supabase — public schema)
// ═══════════════════════════════════════════════════════════════

export const EMAIL = {
  EMAIL_REQUESTS:    'email_requests',
  EMAIL_PROVIDERS:   'email_providers',
  BOUNCE_FEEDBACK:   'bounce_feedback',
  RATE_LIMITS:       'rate_limits',
  TEMPLATE_VERSIONS: 'template_versions',
  AUDIT_LOG:         'audit_logs',
}

// ═══════════════════════════════════════════════════════════════
// PROGRAMME SERVICE  (Supabase — programme schema)
// ═══════════════════════════════════════════════════════════════

export const PROGRAMME = {
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
  AUDIT_LOG:                  'programme.audit_logs',  // schema-qualified — accessed via pool
}

// ═══════════════════════════════════════════════════════════════
// TABLES — grouped by service for quick access
//   Usage: TABLES.family.AUDIT_LOG, TABLES.iam.USERS, etc.
//   Or import the service object directly: import { FAMILY } from './table.js'
// ═══════════════════════════════════════════════════════════════

export const TABLES = {
  family:    FAMILY,
  iam:       IAM,
  email:     EMAIL,
  programme: PROGRAMME,
}
