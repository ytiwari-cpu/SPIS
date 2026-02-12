/**
 * FAMILY HISTORY SERVICE - V2 CORRECTED
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * CRITICAL: STRICT ENFORCEMENT OF AUDIT TRAIL
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * This service writes to family_history table for EVERY database change.
 * NO EXCEPTIONS. NO PARTIAL HISTORY. NO SKIPPED FIELDS.
 * 
 * POLYMORPHIC ENTITY TYPES (STRICT - UPPERCASE):
 * - entity_type: 'FAMILY' | 'MEMBER' | 'ADDRESS' | 'DOCUMENT' | 'ACCOUNT'
 * - entity_id: UUID of the entity being changed
 * 
 * ACTION TYPES (UPPERCASE):
 * - action_type: 'CREATE' | 'UPDATE' | 'DELETE' | 'SUBMIT' | 'VERIFY' | 'REJECT'
 * 
 * VALUES (FULL JSON - NO PARTIAL):
 * - old_values: JSONB - FULL previous state (null for CREATE)
 * - new_values: JSONB - FULL new state (null for DELETE)
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { supabase } from '../lib/supabase.js'

// STRICT entity types - UPPERCASE only
export type EntityType = 'FAMILY' | 'MEMBER' | 'ADDRESS' | 'DOCUMENT' | 'ACCOUNT'

// STRICT action types - UPPERCASE per schema
export type ActionType = 'CREATE' | 'UPDATE' | 'DELETE' | 'SUBMIT' | 'VERIFY' | 'REJECT'

export interface HistoryEntry {
  family_id: string        // Required: Every history entry must link to a family
  entity_type: EntityType  // What type of entity changed
  entity_id: string        // UUID of the changed entity
  action_type: ActionType  // What action was performed
  old_values?: Record<string, unknown> | null  // FULL previous state
  new_values?: Record<string, unknown> | null  // FULL new state
  changed_by?: string      // User or system identifier
  change_reason?: string   // Optional reason for change
}

const VALID_ENTITY_TYPES: EntityType[] = ['FAMILY', 'MEMBER', 'ADDRESS', 'DOCUMENT', 'ACCOUNT']
const VALID_ACTION_TYPES: ActionType[] = ['CREATE', 'UPDATE', 'DELETE', 'SUBMIT', 'VERIFY', 'REJECT']

/**
 * Write a single history entry
 * 
 * ENFORCES: Full JSON values for old_values and new_values
 */
export async function writeHistory(entry: HistoryEntry): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate required fields
    if (!entry.family_id) {
      console.error('HISTORY ERROR: family_id is required')
      return { success: false, error: 'family_id is required for history' }
    }
    
    if (!entry.entity_type || !VALID_ENTITY_TYPES.includes(entry.entity_type)) {
      console.error('HISTORY ERROR: Invalid entity_type:', entry.entity_type)
      return { success: false, error: `entity_type must be one of: ${VALID_ENTITY_TYPES.join(', ')}` }
    }

    if (!entry.entity_id) {
      console.error('HISTORY ERROR: entity_id is required')
      return { success: false, error: 'entity_id is required for history' }
    }

    if (!entry.action_type || !VALID_ACTION_TYPES.includes(entry.action_type)) {
      console.error('HISTORY ERROR: Invalid action_type:', entry.action_type)
      return { success: false, error: `action_type must be one of: ${VALID_ACTION_TYPES.join(', ')}` }
    }

    // Enforce FULL values based on action type
    if (entry.action_type === 'CREATE' && !entry.new_values) {
      console.error('HISTORY ERROR: new_values is required for CREATE')
      return { success: false, error: 'new_values is required for CREATE action' }
    }

    if (entry.action_type === 'DELETE' && !entry.old_values) {
      console.error('HISTORY ERROR: old_values is required for DELETE')
      return { success: false, error: 'old_values is required for DELETE action' }
    }

    if (entry.action_type === 'UPDATE' && (!entry.old_values || !entry.new_values)) {
      console.error('HISTORY ERROR: old_values and new_values are required for UPDATE')
      return { success: false, error: 'old_values and new_values are required for UPDATE action' }
    }

    const { error } = await supabase
      .from('family_history')
      .insert({
        family_id: entry.family_id,
        entity_type: entry.entity_type,
        entity_id: entry.entity_id,
        action_type: entry.action_type,
        old_values: entry.old_values || null,
        new_values: entry.new_values || null,
        changed_by: entry.changed_by || 'system',
        change_reason: entry.change_reason || null,
      })

    if (error) {
      console.error('HISTORY WRITE FAILED:', error)
      return { success: false, error: error.message }
    }

    console.log(`HISTORY: ${entry.action_type} ${entry.entity_type} ${entry.entity_id}`)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('HISTORY EXCEPTION:', message)
    return { success: false, error: message }
  }
}

/**
 * Write multiple history entries (for batch operations)
 */
export async function writeHistoryBatch(entries: HistoryEntry[]): Promise<{ success: boolean; error?: string }> {
  try {
    const records = entries.map(entry => ({
      family_id: entry.family_id,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id,
      action_type: entry.action_type,
      old_values: entry.old_values || null,
      new_values: entry.new_values || null,
      changed_by: entry.changed_by || 'system',
      change_reason: entry.change_reason || null,
    }))

    const { error } = await supabase
      .from('family_history')
      .insert(records)

    if (error) {
      console.error('HISTORY BATCH WRITE FAILED:', error)
      return { success: false, error: error.message }
    }

    console.log(`HISTORY BATCH: ${entries.length} entries written`)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('HISTORY BATCH EXCEPTION:', message)
    return { success: false, error: message }
  }
}

/**
 * Helper: Create a CREATE history entry with FULL new values
 */
export function createHistoryEntry(
  familyId: string,
  entityType: EntityType,
  entityId: string,
  newValues: Record<string, unknown>,
  changedBy?: string
): HistoryEntry {
  return {
    family_id: familyId,
    entity_type: entityType,
    entity_id: entityId,
    action_type: 'CREATE',
    old_values: null,
    new_values: newValues, // FULL JSON - no skipped fields
    changed_by: changedBy,
  }
}

/**
 * Helper: Create an UPDATE history entry with FULL old and new values
 */
export function updateHistoryEntry(
  familyId: string,
  entityType: EntityType,
  entityId: string,
  oldValues: Record<string, unknown>,
  newValues: Record<string, unknown>,
  changedBy?: string,
  changeReason?: string
): HistoryEntry {
  return {
    family_id: familyId,
    entity_type: entityType,
    entity_id: entityId,
    action_type: 'UPDATE',
    old_values: oldValues,  // FULL JSON - no skipped fields
    new_values: newValues,  // FULL JSON - no skipped fields
    changed_by: changedBy,
    change_reason: changeReason,
  }
}

/**
 * Helper: Create a DELETE history entry with FULL old values
 */
export function deleteHistoryEntry(
  familyId: string,
  entityType: EntityType,
  entityId: string,
  oldValues: Record<string, unknown>,
  changedBy?: string,
  changeReason?: string
): HistoryEntry {
  return {
    family_id: familyId,
    entity_type: entityType,
    entity_id: entityId,
    action_type: 'DELETE',
    old_values: oldValues,  // FULL JSON - no skipped fields
    new_values: null,
    changed_by: changedBy,
    change_reason: changeReason,
  }
}

/**
 * Helper: Create a SUBMIT history entry
 * Used when registration is submitted for verification
 */
export function submitHistoryEntry(
  familyId: string,
  entityType: EntityType,
  entityId: string,
  oldValues: Record<string, unknown>,
  newValues: Record<string, unknown>,
  changedBy?: string
): HistoryEntry {
  return {
    family_id: familyId,
    entity_type: entityType,
    entity_id: entityId,
    action_type: 'SUBMIT',
    old_values: oldValues,
    new_values: newValues,
    changed_by: changedBy,
  }
}

export default {
  writeHistory,
  writeHistoryBatch,
  createHistoryEntry,
  updateHistoryEntry,
  deleteHistoryEntry,
  submitHistoryEntry,
}
