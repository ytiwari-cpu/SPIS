import { z } from 'zod'

// ─── Programme Master ─────────────────────────────────────────────────────────
export const createProgrammeSchema = z.object({
    programme_code: z.string().min(1).max(50),
    programme_name: z.string().min(1).max(255),
    description: z.string().optional(),
    // Config fields
    ranking_required: z.boolean().optional().default(false),
    quota_limit: z.number().int().positive().optional(),
    benefit_type: z.enum(['Cash', 'In-Kind', 'Hybrid', 'Service']),
    benefit_frequency: z.enum(['Monthly', 'Quarterly', 'Annual', 'One-Time']),
    effective_from: z.string().min(1),
    effective_to: z.string().optional(),
    // Payment settings
    payment_frequency: z.string().optional(),
    payment_mode: z.string().optional(),
    total_budget_allocated: z.number().positive().optional(),
    currency: z.string().optional().default('JMD'),
})

export const updateProgrammeSchema = createProgrammeSchema.partial()

// ─── Programme Rules ──────────────────────────────────────────────────────────
export const addProgrammeRuleSchema = z.object({
    rule_type: z.enum(['variable', 'group']),
    rule_code: z.string().optional(),
    variable_code: z.string().optional(),
    rule_group_id: z.string().uuid().optional(),
    operator: z.enum(['==', '!=', '>', '<', '>=', '<=', 'IN', 'NOT IN', 'BETWEEN']).optional(),
    threshold_value: z.string().optional(),
    weight: z.number().optional().default(0),
    mandatory_flag: z.boolean().optional().default(false),
    rule_version: z.string().optional(),
})

// ─── Rule Groups ──────────────────────────────────────────────────────────────
export const createRuleGroupSchema = z.object({
    group_code: z.string().min(1).max(50),
    group_name: z.string().min(1).max(255),
    description: z.string().optional(),
    scoring_method: z.enum(['weighted_sum', 'average', 'min', 'max']).optional().default('weighted_sum'),
})

export const updateRuleGroupSchema = createRuleGroupSchema.partial()

export const addRuleGroupRuleSchema = z.object({
    variable_code: z.string().min(1),
    operator: z.enum(['==', '!=', '>', '<', '>=', '<=', 'IN', 'NOT IN', 'BETWEEN']),
    threshold_value: z.string().min(1),
    weight: z.number().optional().default(1.0),
    mandatory_flag: z.boolean().optional().default(false),
})

// ─── Custom Fields ────────────────────────────────────────────────────────────
export const createCustomFieldSchema = z.object({
    display_name: z.string().min(1).max(255),
    target_table: z.enum(['family', 'family_member', 'address', 'house_services']),
    data_type: z.enum(['text', 'number', 'boolean', 'date', 'enum']),
    enum_values: z.array(z.string()).optional(),
    is_required: z.boolean().optional().default(false),
    default_value: z.string().optional(),
    description: z.string().optional(),
})

export const updateCustomFieldSchema = z.object({
    display_name: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
    enum_values: z.array(z.string()).optional(),
})

// ─── Rule Version ─────────────────────────────────────────────────────────────
export const createRuleVersionSchema = z.object({
    rule_version: z.string().min(1).max(20),
    description: z.string().optional(),
    effective_from: z.string().optional(),
    effective_to: z.string().optional(),
})

// ─── Enrollment ───────────────────────────────────────────────────────────────
export const enrollCitizenSchema = z.object({
    subject_type: z.enum(['Individual', 'Family']),
    subject_id: z.string().uuid(),
    active_from: z.string().optional(),
    active_till: z.string().optional(),
})
