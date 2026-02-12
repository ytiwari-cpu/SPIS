/**
 * EVENT OUTBOX SERVICE
 * 
 * Publishes domain events to family_event_outbox table.
 * These events can be consumed by external systems for event-driven architecture.
 * 
 * Schema (actual DB):
 * - event_id: UUID (auto-generated)
 * - event_type: string - e.g., 'family.created', 'member.added'
 * - payload: JSONB - event data
 * - published: boolean - whether event has been consumed
 * - created_at: timestamp (auto-generated)
 */

import { supabase } from '../lib/supabase.js'

export type FamilyEventType =
  | 'family.created'
  | 'family.updated'
  | 'family.submitted'
  | 'family.verified'
  | 'family.rejected'
  | 'member.added'
  | 'member.updated'
  | 'member.removed'
  | 'member.status_changed'
  | 'member.transferred'
  | 'address.created'
  | 'address.updated'
  | 'document.uploaded'
  | 'document.verified'
  | 'account.added'

export interface EventPayload {
  family_id: string
  entity_id?: string
  entity_type?: string
  data?: Record<string, unknown>
  timestamp?: string
  triggered_by?: string
}

/**
 * Publish a single event to the outbox
 */
export async function publishEvent(
  eventType: FamilyEventType,
  payload: EventPayload
): Promise<{ success: boolean; event_id?: string; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('family_event_outbox')
      .insert({
        event_type: eventType,
        payload: {
          ...payload,
          timestamp: payload.timestamp || new Date().toISOString(),
        },
        published: false,
      })
      .select('event_id')
      .single()

    if (error) {
      console.error('Failed to publish event:', error)
      return { success: false, error: error.message }
    }

    return { success: true, event_id: data.event_id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Event publish exception:', message)
    return { success: false, error: message }
  }
}

/**
 * Publish multiple events (batch)
 */
export async function publishEventBatch(
  events: { eventType: FamilyEventType; payload: EventPayload }[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const records = events.map(e => ({
      event_type: e.eventType,
      payload: {
        ...e.payload,
        timestamp: e.payload.timestamp || new Date().toISOString(),
      },
      published: false,
    }))

    const { error } = await supabase
      .from('family_event_outbox')
      .insert(records)

    if (error) {
      console.error('Failed to publish event batch:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Event batch publish exception:', message)
    return { success: false, error: message }
  }
}

/**
 * Mark events as published (for consumers)
 */
export async function markEventsPublished(eventIds: string[]): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('family_event_outbox')
      .update({ published: true })
      .in('event_id', eventIds)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}

/**
 * Get unpublished events (for consumers)
 */
export async function getUnpublishedEvents(limit = 100): Promise<{
  success: boolean
  data?: Array<{ event_id: string; event_type: string; payload: Record<string, unknown>; created_at: string }>
  error?: string
}> {
  try {
    const { data, error } = await supabase
      .from('family_event_outbox')
      .select('event_id, event_type, payload, created_at')
      .eq('published', false)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, data: data || [] }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}

export default {
  publishEvent,
  publishEventBatch,
  markEventsPublished,
  getUnpublishedEvents,
}
