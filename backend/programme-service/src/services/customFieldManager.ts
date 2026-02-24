/**
 * Custom Field Manager Service
 * Handles creation & management of custom fields.
 * When a new custom field is added:
 *   1. ALTER TABLE to add the column in the family DB
 *   2. Insert into rule_variable_catalog
 *   3. Store in custom_field_definitions
 */
import { supabase, familySupabase } from '../lib/supabase.js'
import { createVariable } from './variableCatalog.js'
import type { CustomFieldDefinition } from '../types/index.js'

// Map our data types to PostgreSQL column types
const PG_TYPE_MAP: Record<string, string> = {
    text: 'VARCHAR(255)',
    number: 'DECIMAL(18,2)',
    boolean: 'BOOLEAN DEFAULT false',
    date: 'DATE',
    enum: 'VARCHAR(100)',
}

/**
 * Creates a custom field:
 *  - Generates a safe column name from the display name
 *  - Executes ALTER TABLE on the family DB
 *  - Creates a variable catalog entry
 *  - Stores the custom field definition
 */
export async function createCustomField(
    input: {
        display_name: string
        target_table: string
        data_type: string
        enum_values?: string[]
        is_required?: boolean
        default_value?: string
        description?: string
    },
    createdBy?: string,
): Promise<CustomFieldDefinition> {
    // Generate safe column name
    const fieldName = `custom_${input.display_name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`
    const variableCode = `${input.target_table}.${fieldName}`
    const pgType = PG_TYPE_MAP[input.data_type] || 'VARCHAR(255)'

    // Step 1: ALTER TABLE on family DB
    if (familySupabase) {
        // Use Supabase RPC to run raw SQL — or fall back to noting the alteration is needed
        const schemaPrefix = input.target_table === 'house_services' ? 'family' : 'family'
        const alterSQL = `ALTER TABLE ${schemaPrefix}.${input.target_table} ADD COLUMN IF NOT EXISTS ${fieldName} ${pgType};`

        try {
            const { error } = await familySupabase.rpc('exec_sql', { sql: alterSQL })
            if (error) {
                console.warn(`⚠️  ALTER TABLE failed (may need manual execution): ${error.message}`)
                console.warn(`   SQL: ${alterSQL}`)
            }
        } catch (err) {
            console.warn(`⚠️  ALTER TABLE via RPC not available. Run manually:`)
            console.warn(`   ${alterSQL}`)
        }
    }

    // Step 2: Create variable catalog entry
    await createVariable({
        variable_code: variableCode,
        display_name: input.display_name,
        category: 'Custom',
        data_type: input.data_type,
        source_table: input.target_table,
        source_column: fieldName,
        enum_values: input.enum_values ? input.enum_values as unknown as string[] : null,
        is_system_field: false,
        is_active: true,
        created_by: createdBy || null,
    })

    // Step 3: Store custom field definition
    const { data, error } = await supabase
        .from('custom_field_definitions')
        .insert({
            field_name: fieldName,
            display_name: input.display_name,
            target_table: input.target_table,
            data_type: input.data_type,
            enum_values: input.enum_values || null,
            is_required: input.is_required || false,
            default_value: input.default_value || null,
            description: input.description || null,
            variable_code: variableCode,
            created_by: createdBy || null,
        })
        .select()
        .single()

    if (error) throw new Error(`Failed to save custom field: ${error.message}`)
    return data
}

/**
 * Get all custom field definitions.
 */
export async function getAllCustomFields(): Promise<CustomFieldDefinition[]> {
    const { data, error } = await supabase
        .from('custom_field_definitions')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch custom fields: ${error.message}`)
    return data || []
}

/**
 * Get custom fields for a specific table.
 */
export async function getCustomFieldsByTable(table: string): Promise<CustomFieldDefinition[]> {
    const { data, error } = await supabase
        .from('custom_field_definitions')
        .select('*')
        .eq('target_table', table)
        .eq('is_active', true)
        .order('display_name')

    if (error) throw new Error(`Failed to fetch custom fields for ${table}: ${error.message}`)
    return data || []
}

/**
 * Update a custom field (only display_name, description, enum_values allowed).
 */
export async function updateCustomField(
    fieldId: string,
    update: { display_name?: string; description?: string; enum_values?: string[] },
    updatedBy?: string,
): Promise<CustomFieldDefinition> {
    const updatePayload: Record<string, unknown> = { ...update, updated_by: updatedBy, updated_at: new Date().toISOString() }

    const { data, error } = await supabase
        .from('custom_field_definitions')
        .update(updatePayload)
        .eq('field_id', fieldId)
        .select()
        .single()

    if (error) throw new Error(`Failed to update custom field: ${error.message}`)

    // Also update the variable catalog display name if changed
    if (data.variable_code && update.display_name) {
        await supabase
            .from('rule_variable_catalog')
            .update({ display_name: update.display_name, updated_at: new Date().toISOString() })
            .eq('variable_code', data.variable_code)
    }

    return data
}

/**
 * Deactivate a custom field (soft delete).
 */
export async function deactivateCustomField(fieldId: string): Promise<void> {
    // Get the field to find variable_code
    const { data: field } = await supabase
        .from('custom_field_definitions')
        .select('variable_code')
        .eq('field_id', fieldId)
        .single()

    // Deactivate the custom field definition
    await supabase
        .from('custom_field_definitions')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('field_id', fieldId)

    // Deactivate the variable catalog entry
    if (field?.variable_code) {
        await supabase
            .from('rule_variable_catalog')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('variable_code', field.variable_code)
    }
}
