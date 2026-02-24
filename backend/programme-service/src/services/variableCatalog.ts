/**
 * Variable Catalog Service
 * Manages the rule_variable_catalog — the available fields for rule creation.
 * Provides refresh functionality that scans the family DB for logical columns.
 */
import { supabase } from '../lib/supabase.js'
import type { RuleVariableCatalog } from '../types/index.js'

// Non-logical fields to exclude when scanning family DB tables
const EXCLUDED_COLUMNS = new Set([
    'uuid', 'id', 'family_id', 'member_id', 'family_uuid',
    'permanent_address_id', 'mailing_address_id', 'current_address_id',
    'first_name', 'last_name', 'middle_name', 'head_first_name', 'head_last_name',
    'phone', 'email', 'national_id',
    'line1', 'line2', 'line3',
    'file_path', 'file_name', 'file_type', 'file_size',
    'created_at', 'updated_at', 'submitted_at', 'verified_at',
    'intake_channel',
    'application_no', 'social_worker_zone', 'social_worker_code',
])

export async function getAllVariables(): Promise<RuleVariableCatalog[]> {
    const { data, error } = await supabase
        .from('rule_variable_catalog')
        .select('*')
        .eq('is_active', true)
        .order('category')
        .order('display_name')

    if (error) throw new Error(`Failed to fetch variables: ${error.message}`)
    return data || []
}

export async function getVariablesByCategory(): Promise<Record<string, RuleVariableCatalog[]>> {
    const variables = await getAllVariables()
    const grouped: Record<string, RuleVariableCatalog[]> = {}
    for (const v of variables) {
        if (!grouped[v.category]) grouped[v.category] = []
        grouped[v.category].push(v)
    }
    return grouped
}

export async function getVariable(variableCode: string): Promise<RuleVariableCatalog | null> {
    const { data, error } = await supabase
        .from('rule_variable_catalog')
        .select('*')
        .eq('variable_code', variableCode)
        .single()

    if (error) return null
    return data
}

/**
 * Creates a new variable entry in the catalog (typically for custom fields).
 */
export async function createVariable(variable: Partial<RuleVariableCatalog>): Promise<RuleVariableCatalog> {
    const { data, error } = await supabase
        .from('rule_variable_catalog')
        .insert(variable)
        .select()
        .single()

    if (error) throw new Error(`Failed to create variable: ${error.message}`)
    return data
}

/**
 * Returns whether a column should be excluded from the variable catalog.
 */
export function isExcludedColumn(column: string): boolean {
    return EXCLUDED_COLUMNS.has(column)
}
