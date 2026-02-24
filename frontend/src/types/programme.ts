// ═══════════════════════════════════════════════════════════════════════════════
// Programme Module — Frontend TypeScript Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface Programme {
    programme_id: string
    programme_code: string
    programme_name: string
    description: string | null
    active_flag: boolean
    status: 'DRAFT' | 'ACTIVE' | 'INACTIVE'
    created_by: string | null
    rules_tree: RulesTreeNode | null
    created_at: string
    updated_at: string
    programme_config?: ProgrammeConfig
    programme_payment_settings?: ProgrammePaymentSettings
    programme_rules?: ProgrammeRule[]
}

// ── AND/OR Rule Builder Types ────────────────────────────────────────────────

export interface RuleCondition {
    field: string
    operator: string
    value: string
    weight?: number   // Optional scoring weight (used by rule engine)
}

export interface RulesTreeNode {
    combinator: 'AND' | 'OR'
    rules: (RuleCondition | RulesTreeNode)[]
}

export function isRulesTreeGroup(node: RuleCondition | RulesTreeNode): node is RulesTreeNode {
    return 'combinator' in node
}

// ── Programme Manager Link ───────────────────────────────────────────────────

export interface ProgrammeManagerLink {
    id: string
    programme_id: string
    user_id: string
    added_by: string
    created_at: string
    // populated from IAM API
    email?: string
}

export interface ProgrammeConfig {
    programme_id: string
    ranking_required: boolean
    quota_limit: number | null
    benefit_type: string
    benefit_frequency: string
    effective_from: string
    effective_to: string | null
}

export interface ProgrammePaymentSettings {
    programme_id: string
    payment_frequency: string | null
    payment_mode: string | null
    total_budget_allocated: number | null
    currency: string
}

export interface RuleVariable {
    variable_code: string
    display_name: string
    category: string
    data_type: string
    source_table: string
    source_column: string
    enum_values: string[] | null
    is_system_field: boolean
    is_active: boolean
}

export interface RuleGroup {
    rule_group_id: string
    group_code: string
    group_name: string
    description: string | null
    scoring_method: 'weighted_sum' | 'average' | 'min' | 'max'
    is_active: boolean
    rule_group_rules?: RuleGroupRule[]
}

export interface RuleGroupRule {
    rule_group_rule_id: string
    rule_group_id: string
    variable_code: string
    operator: string
    threshold_value: string
    weight: number
    mandatory_flag: boolean
    rule_variable_catalog?: RuleVariable
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
}

export interface Beneficiary {
    programme_id: string
    subject_type: 'Individual' | 'Family'
    subject_id: string
    active_from: string | null
    active_till: string | null
    status: 'Active' | 'Suspended' | 'Exited' | 'Pending'
    calculated_score: number | null
    group_scores: Record<string, number> | null
    approved_at: string | null
    created_at: string
}

export interface CustomField {
    field_id: string
    field_name: string
    display_name: string
    target_table: string
    data_type: string
    enum_values: string[] | null
    is_required: boolean
    default_value: string | null
    description: string | null
    variable_code: string | null
    is_active: boolean
    created_at: string
}

export interface EvaluationResult {
    subject_id: string
    subject_type: string
    eligible: boolean
    calculated_score: number
    group_scores: Record<string, number>
    rule_results: {
        rule_code: string | null
        variable_code: string | null
        rule_group_id: string | null
        passed: boolean
        actual_value: unknown
        threshold: string | null
        score: number
    }[]
}

export interface ImpactAnalysis {
    total_families: number
    would_be_eligible: number
    would_be_ineligible: number
    average_score: number
}

export interface AuditLog {
    history_id: string
    programme_id: string
    change_type: string
    old_value: unknown
    new_value: unknown
    changed_by: string | null
    changed_at: string
}

export type OperatorType = '==' | '!=' | '>' | '<' | '>=' | '<=' | 'IN' | 'NOT IN' | 'BETWEEN'

export const OPERATORS: { value: OperatorType; label: string }[] = [
    { value: '==', label: 'Equals' },
    { value: '!=', label: 'Not Equals' },
    { value: '>', label: 'Greater Than' },
    { value: '<', label: 'Less Than' },
    { value: '>=', label: 'Greater or Equal' },
    { value: '<=', label: 'Less or Equal' },
    { value: 'IN', label: 'In List' },
    { value: 'NOT IN', label: 'Not In List' },
    { value: 'BETWEEN', label: 'Between' },
]
