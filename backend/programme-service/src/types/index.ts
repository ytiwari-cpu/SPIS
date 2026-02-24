// ═══════════════════════════════════════════════════════════════════════════════
// Programme Module — TypeScript Interfaces
// ═══════════════════════════════════════════════════════════════════════════════

export interface ProgrammeMaster {
    programme_id: string
    programme_code: string
    programme_name: string
    description: string | null
    active_flag: boolean
    created_by: string | null
    updated_by: string | null
    created_at: string
    updated_at: string
}

export interface ProgrammeConfig {
    programme_id: string
    ranking_required: boolean
    quota_limit: number | null
    benefit_type: 'Cash' | 'In-Kind' | 'Hybrid' | 'Service'
    benefit_frequency: 'Monthly' | 'Quarterly' | 'Annual' | 'One-Time'
    effective_from: string
    effective_to: string | null
    created_at: string
    updated_at: string
}

export interface ProgrammePaymentSettings {
    programme_id: string
    payment_frequency: string | null
    payment_mode: string | null
    total_budget_allocated: number | null
    currency: string
    effective_from: string | null
    effective_to: string | null
    created_at: string
    updated_at: string
}

export interface RuleVariableCatalog {
    variable_code: string
    display_name: string
    category: string
    data_type: string
    source_table: string
    source_column: string
    enum_values: string[] | null
    is_system_field: boolean
    is_active: boolean
    created_by: string | null
    created_at: string
    updated_at: string
}

export interface RuleGroup {
    rule_group_id: string
    group_code: string
    group_name: string
    description: string | null
    scoring_method: 'weighted_sum' | 'average' | 'min' | 'max'
    is_active: boolean
    created_by: string | null
    updated_by: string | null
    created_at: string
    updated_at: string
}

export interface RuleGroupRule {
    rule_group_rule_id: string
    rule_group_id: string
    variable_code: string
    operator: string
    threshold_value: string
    weight: number
    mandatory_flag: boolean
    created_at: string
    updated_at: string
}

export interface RuleMaster {
    rule_code: string
    rule_type: 'variable' | 'group'
    category: string
    rule_name: string
    description: string | null
    data_type: string | null
    variable_code: string | null
    rule_group_id: string | null
    source_entity: string | null
    created_at: string
}

export interface ProgrammeRule {
    programme_rule_id: string
    programme_id: string
    rule_type: 'variable' | 'group'
    rule_code: string | null
    variable_code: string | null
    rule_group_id: string | null
    operator: string | null
    threshold_value: string | null
    weight: number
    mandatory_flag: boolean
    rule_version: string | null
    created_at: string
    updated_at: string
}

export interface ProgrammeCitizen {
    programme_id: string
    subject_type: 'Individual' | 'Family'
    subject_id: string
    active_from: string | null
    active_till: string | null
    status: 'Active' | 'Suspended' | 'Exited' | 'Pending'
    rule_version: string | null
    calculated_score: number | null
    group_scores: Record<string, number> | null
    approved_at: string | null
    approved_by: string | null
    created_at: string
}

export interface CustomFieldDefinition {
    field_id: string
    field_name: string
    display_name: string
    target_table: 'family' | 'family_member' | 'address' | 'house_services'
    data_type: 'text' | 'number' | 'boolean' | 'date' | 'enum'
    enum_values: string[] | null
    is_required: boolean
    default_value: string | null
    description: string | null
    variable_code: string | null
    is_active: boolean
    created_by: string | null
    updated_by: string | null
    created_at: string
    updated_at: string
}

export interface ProgrammeHistory {
    history_id: string
    programme_id: string
    change_type: string
    old_value: unknown
    new_value: unknown
    changed_by: string | null
    changed_at: string
}

export interface RuleVersionMaster {
    rule_version: string
    description: string | null
    effective_from: string | null
    effective_to: string | null
    created_at: string
}

export interface ConditionalityCompliance {
    compliance_id: string
    programme_id: string
    subject_type: string | null
    subject_id: string
    condition_code: string
    compliance_status: 'Compliant' | 'Non-Compliant' | 'Pending' | 'Exempt'
    evaluated_at: string
    remarks: string | null
}
