/**
 * programme-service table name constants.
 * Kept in the service (not the shared base) since table names are service-specific.
 */

export const TABLES = {
  // ── Programme Core ──────────────────────────────────────────────────────
  PROGRAMME_MASTER:           'programme_master',
  PROGRAMME_CONFIG:           'programme_config',
  PROGRAMME_PAYMENT_SETTINGS: 'programme_payment_settings',
  PROGRAMME_HISTORY:          'programme_history',
  PROGRAMME_RULES:            'programme_rules',
  PROGRAMME_RULES_HISTORY:    'programme_rules_history',
  PROGRAMME_MANAGER_LINK:     'programme_manager_link',

  // ── Beneficiaries / Citizens ────────────────────────────────────────────
  PROGRAMME_CITIZENS:         'programme_citizens',
  PROGRAMME_EXIT_HISTORY:     'programme_exit_history',

  // ── Rules & Variables ───────────────────────────────────────────────────
  RULE_MASTER:                'rule_master',
  RULE_VERSION_MASTER:        'rule_version_master',
  RULE_GROUP:                 'rule_group',
  RULE_GROUP_RULES:           'rule_group_rules',
  RULE_VARIABLE_CATALOG:      'rule_variable_catalog',

  // ── Custom Fields ───────────────────────────────────────────────────────
  CUSTOM_FIELD_DEFINITIONS:   'custom_field_definitions',

  // ── Conditionality ──────────────────────────────────────────────────────
  CONDITIONALITY_COMPLIANCE:  'conditionality_compliance',
}
