import { Router, Request, Response, NextFunction } from 'express'
import { supabase } from '../lib/supabase.js'
import { validate } from '../middleware/validate.js'
import { NotFoundError, BadRequestError } from '../middleware/errorHandler.js'
import { CreateMemberSchema, UpdateMemberSchema } from '../validators/schemas.js'
import { publishEvent } from '../services/eventService.js'
import type { CreateMemberRequest, UpdateMemberRequest } from '../types/index.js'

export const memberRouter = Router()
export const publicMemberRouter = Router() // For IAM service lookups (no auth required)

function normalizeNationalId(value: string): string {
  return value.replace(/\D/g, '')
}

/**
 * Log member changes to family_history
 */
async function logMemberHistory(
  familyUuid: string,
  actionType: 'create' | 'update' | 'delete',
  changedBy: string | null,
  oldValues: Record<string, unknown> | null,
  newValues: Record<string, unknown> | null,
  changeReason?: string
) {
  try {
    await supabase.from('family_history').insert({
      family_uuid: familyUuid,
      action_type: actionType,
      changed_by: changedBy,
      old_values: oldValues,
      new_values: newValues,
      change_reason: changeReason || null,
    })
  } catch (error) {
    console.error('Failed to log member history:', error)
  }
}

/**
 * GET /api/v1/members/family/:familyId
 * Get all members for a family
 */
memberRouter.get('/family/:familyId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { familyId } = req.params

    // Verify family exists
    const { data: family, error: familyError } = await supabase
      .from('family')
      .select('uuid')
      .eq('uuid', familyId)
      .single()

    if (familyError || !family) {
      throw new NotFoundError('Family not found')
    }

    const { data, error } = await supabase
      .from('family_member')
      .select('*')
      .eq('family_uuid', familyId)
      .order('relationship_to_head', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message,
      })
    }

    res.json({
      success: true,
      data: data || [],
    })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /api/v1/members/lookup?national_id=...
 * Lookup member identity details for IAM password reset/login flows.
 * PUBLIC ENDPOINT - No auth required (used by IAM service)
 */
publicMemberRouter.get('/lookup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const nationalIdRaw = typeof req.query.national_id === 'string'
      ? req.query.national_id
      : ''
    const nationalId = normalizeNationalId(nationalIdRaw)

    if (!nationalId || nationalId.length !== 14) {
      return res.status(400).json({
        success: false,
        error: 'national_id is required and must be exactly 14 digits',
      })
    }

    const { data: member, error: memberError } = await supabase
      .from('family_member')
      .select('*')
      .eq('national_id', nationalId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (memberError) {
      return res.status(400).json({
        success: false,
        error: memberError.message,
      })
    }

    if (!member) {
      return res.status(404).json({
        success: false,
        error: 'Member not found for provided national_id',
      })
    }

    const { data: family } = await supabase
      .from('family')
      .select('*')
      .eq('uuid', member.family_uuid)
      .maybeSingle()

    // Preferred link: member UUID. If unavailable, fallback to national ID.
    const registryId = member.uuid || nationalId
    const email = member.email || family?.email || null
    const phone = member.phone || family?.phone || null

    res.json({
      success: true,
      registry_id: registryId,
      family_uuid: member.family_uuid || null,
      family_id: family?.family_id || null,
      member_uuid: member.uuid || null,
      member_id: member.member_id || null,
      national_id: member.national_id || nationalId,
      email,
      phone,
      first_name: member.first_name || null,
      last_name: member.last_name || null,
      member_status: member.member_status || null,
      family_status: family?.status || null,
      registration_status: family?.registration_status || null,
    })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /api/v1/members/:id
 * Get member by ID with related data
 */
memberRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params

    const { data: member, error } = await supabase
      .from('family_member')
      .select(`
        *,
        documents (*),
        biometric_metadata (*),
        account_details (*),
        identity_match (*)
      `)
      .eq('uuid', id)
      .single()

    if (error || !member) {
      throw new NotFoundError('Member not found')
    }

    // Get address if assigned
    let address = null
    if (member.current_address_id) {
      const { data: addressData } = await supabase
        .from('address')
        .select('*')
        .eq('address_id', member.current_address_id)
        .single()
      address = addressData
    }

    res.json({
      success: true,
      data: {
        ...member,
        address,
      },
    })
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/v1/members
 * Create new member
 */
memberRouter.post('/', validate(CreateMemberSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body: CreateMemberRequest = req.body
    const changedBy = req.headers['x-family-id'] as string || 'system'

    // Verify family exists
    const { data: family, error: familyError } = await supabase
      .from('family')
      .select('uuid')
      .eq('uuid', body.family_uuid)
      .single()

    if (familyError || !family) {
      throw new NotFoundError('Family not found')
    }

    // If adding head, verify no head exists
    if (body.relationship_to_head === 'head') {
      const { data: existingHead } = await supabase
        .from('family_member')
        .select('uuid')
        .eq('family_uuid', body.family_uuid)
        .eq('relationship_to_head', 'head')
        .single()

      if (existingHead) {
        throw new BadRequestError('Family already has a head member')
      }
    }

    // Create member
    const { data: member, error } = await supabase
      .from('family_member')
      .insert({
        family_uuid: body.family_uuid,
        national_id: body.national_id || null,
        first_name: body.first_name,
        last_name: body.last_name,
        date_of_birth: body.date_of_birth || null,
        gender: body.gender || null,
        relationship_to_head: body.relationship_to_head,
        current_address_id: body.current_address_id || null,
        alive_flag: body.alive_flag ?? true,
        marital_status: body.marital_status || null,
        phone: body.phone || null,
        email: body.email || null,
      })
      .select()
      .single()

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message,
      })
    }

    // Update household size
    const { count } = await supabase
      .from('family_member')
      .select('uuid', { count: 'exact' })
      .eq('family_uuid', body.family_uuid)
      .eq('alive_flag', true)

    await supabase
      .from('family')
      .update({ household_size: count || 1 })
      .eq('uuid', body.family_uuid)

    // Log to history
    await logMemberHistory(
      body.family_uuid,
      'create',
      changedBy,
      null,
      member,
      `Member ${member.first_name} ${member.last_name} added`
    )

    await publishEvent('member.added', {
      family_id: body.family_uuid,
      entity_id: member.uuid,
      entity_type: 'MEMBER',
      data: {
        national_id: member.national_id || null,
        email: member.email || null,
        phone: member.phone || null,
        first_name: member.first_name || null,
        last_name: member.last_name || null,
      },
      triggered_by: changedBy,
    })

    res.status(201).json({
      success: true,
      data: member,
    })
  } catch (error) {
    next(error)
  }
})

/**
 * PATCH /api/v1/members/:id
 * Update member
 */
memberRouter.patch('/:id', validate(UpdateMemberSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const updates: UpdateMemberRequest = req.body
    const changedBy = req.headers['x-family-id'] as string || 'system'

    // Get old data
    const { data: oldMember, error: fetchError } = await supabase
      .from('family_member')
      .select('*')
      .eq('uuid', id)
      .single()

    if (fetchError || !oldMember) {
      throw new NotFoundError('Member not found')
    }

    // Prevent changing head to non-head if they're the only head
    if (updates.relationship_to_head && oldMember.relationship_to_head === 'head' && updates.relationship_to_head !== 'head') {
      throw new BadRequestError('Cannot change head to another relationship. Assign a new head first.')
    }

    // Update member
    const { data: member, error } = await supabase
      .from('family_member')
      .update(updates)
      .eq('uuid', id)
      .select()
      .single()

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message,
      })
    }

    // Update household size if alive_flag changed
    if ('alive_flag' in updates) {
      const { count } = await supabase
        .from('family_member')
        .select('uuid', { count: 'exact' })
        .eq('family_uuid', oldMember.family_uuid)
        .eq('alive_flag', true)

      await supabase
        .from('family')
        .update({ household_size: count || 1 })
        .eq('uuid', oldMember.family_uuid)
    }

    // Log to history
    await logMemberHistory(
      oldMember.family_uuid,
      'update',
      changedBy,
      oldMember,
      member,
      `Member ${member.first_name} ${member.last_name} updated`
    )

    await publishEvent('member.updated', {
      family_id: oldMember.family_uuid,
      entity_id: member.uuid,
      entity_type: 'MEMBER',
      data: {
        national_id: member.national_id || null,
        email: member.email || null,
        phone: member.phone || null,
        first_name: member.first_name || null,
        last_name: member.last_name || null,
      },
      triggered_by: changedBy,
    })

    res.json({
      success: true,
      data: member,
    })
  } catch (error) {
    next(error)
  }
})

/**
 * DELETE /api/v1/members/:id
 * Remove member (soft delete by setting alive_flag to false or actual delete)
 */
memberRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const hardDelete = req.query.hard === 'true'
    const changedBy = req.headers['x-family-id'] as string || 'system'

    // Get member
    const { data: member, error: fetchError } = await supabase
      .from('family_member')
      .select('*')
      .eq('uuid', id)
      .single()

    if (fetchError || !member) {
      throw new NotFoundError('Member not found')
    }

    // Prevent deleting head
    if (member.relationship_to_head === 'head') {
      throw new BadRequestError('Cannot delete head of family. Assign a new head first.')
    }

    if (hardDelete) {
      // Hard delete
      const { error } = await supabase
        .from('family_member')
        .delete()
        .eq('uuid', id)

      if (error) {
        return res.status(400).json({
          success: false,
          error: error.message,
        })
      }
    } else {
      // Soft delete - mark as not alive
      const { error } = await supabase
        .from('family_member')
        .update({ alive_flag: false })
        .eq('uuid', id)

      if (error) {
        return res.status(400).json({
          success: false,
          error: error.message,
        })
      }
    }

    // Update household size
    const { count } = await supabase
      .from('family_member')
      .select('uuid', { count: 'exact' })
      .eq('family_uuid', member.family_uuid)
      .eq('alive_flag', true)

    await supabase
      .from('family')
      .update({ household_size: count || 0 })
      .eq('uuid', member.family_uuid)

    // Log to history
    await logMemberHistory(
      member.family_uuid,
      'delete',
      changedBy,
      member,
      null,
      hardDelete ? `Member ${member.first_name} ${member.last_name} permanently deleted` : `Member ${member.first_name} ${member.last_name} marked as deceased`
    )

    await publishEvent(hardDelete ? 'member.deleted' : 'member.removed', {
      family_id: member.family_uuid,
      entity_id: member.uuid,
      entity_type: 'MEMBER',
      data: {
        national_id: member.national_id || null,
        email: member.email || null,
        phone: member.phone || null,
        reason: hardDelete ? 'hard_delete' : 'marked_inactive',
      },
      triggered_by: changedBy,
    })

    res.json({
      success: true,
      message: hardDelete ? 'Member permanently deleted' : 'Member marked as inactive',
    })
  } catch (error) {
    next(error)
  }
})
