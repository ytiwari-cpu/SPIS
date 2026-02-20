/**
 * EVENT OUTBOX SERVICE
 *
 * Publishes domain events to family_event_outbox table.
 * The code supports both historical outbox shapes seen in this repo:
 * 1) status-based: { status, aggregate_type, aggregate_id, published_at }
 * 2) boolean-based: { published }
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
  | 'member.deleted'
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

function inferAggregateType(payload: EventPayload): string {
  if (payload.entity_type) return String(payload.entity_type).toLowerCase()
  return 'family'
}

function inferAggregateId(payload: EventPayload): string {
  return String(payload.entity_id || payload.family_id || '')
}

function normalizePayload(payload: EventPayload): EventPayload {
  return {
    ...payload,
    timestamp: payload.timestamp || new Date().toISOString(),
  }
}

async function insertEvent(
  eventType: FamilyEventType,
  payload: EventPayload,
): Promise<{ success: boolean; event_id?: string; error?: string }> {
  const normalized = normalizePayload(payload)

  // Schema variant A
  const primary = await supabase
    .from('family_event_outbox')
    .insert({
      event_type: eventType,
      aggregate_type: inferAggregateType(payload),
      aggregate_id: inferAggregateId(payload),
      payload: normalized,
      status: 'pending',
    })
    .select('event_id')
    .single()

  if (!primary.error && primary.data?.event_id) {
    return { success: true, event_id: primary.data.event_id as string }
  }

  // Schema variant B
  const fallback = await supabase
    .from('family_event_outbox')
    .insert({
      event_type: eventType,
      payload: normalized,
      published: false,
    })
    .select('event_id')
    .single()

  if (!fallback.error && fallback.data?.event_id) {
    return { success: true, event_id: fallback.data.event_id as string }
  }

  return {
    success: false,
    error: fallback.error?.message || primary.error?.message || 'Failed to write outbox event',
  }
}

/**
 * Publish a single event to the outbox.
 */
export async function publishEvent(
  eventType: FamilyEventType,
  payload: EventPayload,
): Promise<{ success: boolean; event_id?: string; error?: string }> {
  try {
    return await insertEvent(eventType, payload)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Event publish exception:', message)
    return { success: false, error: message }
  }
}

/**
 * Publish multiple events.
 */
export async function publishEventBatch(
  events: { eventType: FamilyEventType; payload: EventPayload }[],
): Promise<{ success: boolean; error?: string }> {
  try {
    for (const event of events) {
      const result = await insertEvent(event.eventType, event.payload)
      if (!result.success) {
        return { success: false, error: result.error || 'Failed to publish one or more events' }
      }
    }
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Event batch publish exception:', message)
    return { success: false, error: message }
  }
}

/**
 * Mark events as published.
 */
export async function markEventsPublished(eventIds: string[]): Promise<{ success: boolean; error?: string }> {
  try {
    const primary = await supabase
      .from('family_event_outbox')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .in('event_id', eventIds)

    if (!primary.error) {
      return { success: true }
    }

    const fallback = await supabase
      .from('family_event_outbox')
      .update({ published: true })
      .in('event_id', eventIds)

    if (fallback.error) {
      return { success: false, error: fallback.error.message }
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}

/**
 * Mark events as failed (status-based schema only).
 */
export async function markEventsFailed(eventIds: string[], reason: string): Promise<void> {
  await supabase
    .from('family_event_outbox')
    .update({ status: 'failed', error_message: reason })
    .in('event_id', eventIds)
}

/**
 * Get unpublished events.
 */
export async function getUnpublishedEvents(limit = 100): Promise<{
  success: boolean
  data?: Array<{ event_id: string; event_type: string; payload: Record<string, unknown>; created_at: string }>
  error?: string
}> {
  try {
    const primary = await supabase
      .from('family_event_outbox')
      .select('event_id, event_type, payload, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(limit)

    if (!primary.error) {
      return { success: true, data: primary.data || [] }
    }

    const fallback = await supabase
      .from('family_event_outbox')
      .select('event_id, event_type, payload, created_at')
      .eq('published', false)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (fallback.error) {
      return { success: false, error: fallback.error.message }
    }

    return { success: true, data: fallback.data || [] }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}

export default {
  publishEvent,
  publishEventBatch,
  markEventsPublished,
  markEventsFailed,
  getUnpublishedEvents,
}
