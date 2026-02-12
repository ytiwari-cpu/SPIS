import { Router, Request, Response, NextFunction } from 'express'
import { supabase } from '../lib/supabase.js'
import { validate } from '../middleware/validate.js'
import { NotFoundError, BadRequestError } from '../middleware/errorHandler.js'
import { CreateFamilySchema, UpdateFamilySchema } from '../validators/schemas.js'
import type { Family, FamilyMember, Address, CreateFamilyRequest } from '../types/index.js'

export const familyRouter = Router()

// ============ HELPER FUNCTIONS ============

/**
 * Log action to family_history table
 */
async function logHistory(
  familyUuid: string,
  actionType: 'create' | 'update' | 'delete' | 'submit' | 'verify' | 'reject',
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
    console.error('Failed to log history:', error)
  }
}

/**
 * Publish event to family_event_outbox
 */
async function publishEvent(
  eventType: string,
  aggregateType: string,
  aggregateId: string,
  payload: Record<string, unknown>
) {
  try {
    await supabase.from('family_event_outbox').insert({
      event_type: eventType,
      aggregate_type: aggregateType,
      aggregate_id: aggregateId,
      payload,
      status: 'pending',
    })
  } catch (error) {
    console.error('Failed to publish event:', error)
  }
}

// ============ ROUTES ============

/**
 * GET /api/v1/families
 * Get all families with pagination
 */
familyRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const offset = (page - 1) * limit
    const status = req.query.status as string
    const registrationStatus = req.query.registration_status as string

    let query = supabase
      .from('family')
      .select('*', { count: 'exact' })

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }
    if (registrationStatus) {
      query = query.eq('registration_status', registrationStatus)
    }

    const { data, error, count } = await query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false })

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message,
      })
    }

    res.json({
      success: true,
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: count ? Math.ceil(count / limit) : 0,
      },
    })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /api/v1/families/:id
 * Get family by ID with full details (members, address, documents)
 */
familyRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params

    // Get family
    const { data: family, error: familyError } = await supabase
      .from('family')
      .select('*')
      .eq('uuid', id)
      .single()

    if (familyError || !family) {
      throw new NotFoundError('Family not found')
    }

    // Get members
    const { data: members } = await supabase
      .from('family_member')
      .select('*')
      .eq('family_uuid', id)
      .order('relationship_to_head', { ascending: true })

    // Get permanent address (polymorphic: entity_type='FAMILY', address_type='PERMANENT')
    const { data: addressData } = await supabase
      .from('address')
      .select('*')
      .eq('entity_type', 'FAMILY')
      .eq('entity_id', id)
      .eq('address_type', 'PERMANENT')
      .single()

    // Get documents (polymorphic: owner_type='FAMILY')
    const { data: documents } = await supabase
      .from('documents')
      .select(`
        *,
        document_verification (*)
      `)
      .eq('owner_type', 'FAMILY')
      .eq('owner_id', id)

    res.json({
      success: true,
      data: {
        ...family,
        members: members || [],
        address: addressData || null,
        documents: documents || [],
      },
    })
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/v1/families
 * Create new family with head member and optional address
 */
familyRouter.post('/', validate(CreateFamilySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body: CreateFamilyRequest = req.body
    const changedBy = req.headers['x-family-id'] as string || 'system'

    // 1. Create address if provided
    let addressId: string | null = null
    if (body.address) {
      const { data: address, error: addressError } = await supabase
        .from('address')
        .insert({
          line1: body.address.line1,
          line2: body.address.line2 || null,
          city: body.address.city || null,
          region: body.address.region || null,
          postal_code: body.address.postal_code || null,
          country: body.address.country || 'Tanzania',
          latitude: body.address.latitude || null,
          longitude: body.address.longitude || null,
        })
        .select()
        .single()

      if (addressError) {
        return res.status(400).json({
          success: false,
          error: `Failed to create address: ${addressError.message}`,
        })
      }
      addressId = address.address_id
    }

    // 2. Create family
    const { data: family, error: familyError } = await supabase
      .from('family')
      .insert({
        permanent_address_id: addressId,
        household_size: body.household_size || 1,
        geo_code: body.geo_code || null,
        vulnerability_flag: body.vulnerability_flag || false,
        status: 'active',
        intake_channel: body.intake_channel || 'web_portal',
        registration_status: 'draft',
      })
      .select()
      .single()

    if (familyError) {
      return res.status(400).json({
        success: false,
        error: `Failed to create family: ${familyError.message}`,
      })
    }

    // 3. Create head member
    const { data: headMember, error: memberError } = await supabase
      .from('family_member')
      .insert({
        family_uuid: family.uuid,
        national_id: body.head_member.national_id || null,
        first_name: body.head_member.first_name,
        last_name: body.head_member.last_name,
        date_of_birth: body.head_member.date_of_birth || null,
        gender: body.head_member.gender || null,
        relationship_to_head: 'head',
        current_address_id: addressId,
        alive_flag: true,
        marital_status: body.head_member.marital_status || null,
      })
      .select()
      .single()

    if (memberError) {
      return res.status(400).json({
        success: false,
        error: `Failed to create head member: ${memberError.message}`,
      })
    }

    // 4. Log to family_history
    await logHistory(
      family.uuid,
      'create',
      changedBy,
      null,
      { family, head_member: headMember, address: addressId ? { address_id: addressId } : null },
      'Family created'
    )

    // 5. Publish event
    await publishEvent('FAMILY_CREATED', 'family', family.uuid, {
      family_id: family.family_id,
      uuid: family.uuid,
    })

    res.status(201).json({
      success: true,
      data: {
        uuid: family.uuid,
        family_id: family.family_id,
        head_member_id: headMember.member_id,
        address_id: addressId,
      },
    })
  } catch (error) {
    next(error)
  }
})

/**
 * PATCH /api/v1/families/:id
 * Update family details
 */
familyRouter.patch('/:id', validate(UpdateFamilySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const updates = req.body
    const changedBy = req.headers['x-family-id'] as string || 'system'

    // Get current data
    const { data: oldData, error: fetchError } = await supabase
      .from('family')
      .select('*')
      .eq('uuid', id)
      .single()

    if (fetchError || !oldData) {
      throw new NotFoundError('Family not found')
    }

    // Update family
    const { data: family, error: updateError } = await supabase
      .from('family')
      .update(updates)
      .eq('uuid', id)
      .select()
      .single()

    if (updateError) {
      return res.status(400).json({
        success: false,
        error: updateError.message,
      })
    }

    // Log to history
    await logHistory(id, 'update', changedBy, oldData, family, 'Family updated')

    // Publish event if status changed
    if (updates.registration_status && updates.registration_status !== oldData.registration_status) {
      await publishEvent('FAMILY_STATUS_CHANGED', 'family', id, {
        old_status: oldData.registration_status,
        new_status: updates.registration_status,
      })
    }

    res.json({
      success: true,
      data: family,
    })
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/v1/families/:id/submit
 * Submit family for verification
 */
familyRouter.post('/:id/submit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const changedBy = req.headers['x-family-id'] as string || 'system'

    // Get family
    const { data: family, error: fetchError } = await supabase
      .from('family')
      .select('*')
      .eq('uuid', id)
      .single()

    if (fetchError || !family) {
      throw new NotFoundError('Family not found')
    }

    if (family.registration_status !== 'draft') {
      throw new BadRequestError('Family is not in draft status')
    }

    // Validate: must have head member
    const { data: headMember } = await supabase
      .from('family_member')
      .select('uuid')
      .eq('family_uuid', id)
      .eq('relationship_to_head', 'head')
      .single()

    if (!headMember) {
      throw new BadRequestError('Family must have a head member')
    }

    // Validate: must have address
    if (!family.permanent_address_id) {
      throw new BadRequestError('Family must have a permanent address')
    }

    // Update status
    const { data: updatedFamily, error: updateError } = await supabase
      .from('family')
      .update({
        registration_status: 'pending_verification',
        submitted_at: new Date().toISOString(),
      })
      .eq('uuid', id)
      .select()
      .single()

    if (updateError) {
      return res.status(400).json({
        success: false,
        error: updateError.message,
      })
    }

    // Log and publish
    await logHistory(id, 'submit', changedBy, family, updatedFamily, 'Family submitted for verification')
    await publishEvent('FAMILY_SUBMITTED', 'family', id, {
      family_id: family.family_id,
      submitted_at: updatedFamily.submitted_at,
    })

    res.json({
      success: true,
      data: updatedFamily,
    })
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/v1/families/:id/verify
 * Verify a submitted family
 */
familyRouter.post('/:id/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const changedBy = req.headers['x-family-id'] as string || 'system'

    const { data: family, error: fetchError } = await supabase
      .from('family')
      .select('*')
      .eq('uuid', id)
      .single()

    if (fetchError || !family) {
      throw new NotFoundError('Family not found')
    }

    if (family.registration_status !== 'pending_verification') {
      throw new BadRequestError('Family is not pending verification')
    }

    const { data: updatedFamily, error: updateError } = await supabase
      .from('family')
      .update({
        registration_status: 'verified',
        verified_at: new Date().toISOString(),
      })
      .eq('uuid', id)
      .select()
      .single()

    if (updateError) {
      return res.status(400).json({
        success: false,
        error: updateError.message,
      })
    }

    await logHistory(id, 'verify', changedBy, family, updatedFamily, 'Family verified')
    await publishEvent('FAMILY_VERIFIED', 'family', id, {
      family_id: family.family_id,
      verified_at: updatedFamily.verified_at,
    })

    res.json({
      success: true,
      data: updatedFamily,
    })
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/v1/families/:id/reject
 * Reject a submitted family
 */
familyRouter.post('/:id/reject', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const { reason } = req.body
    const changedBy = req.headers['x-family-id'] as string || 'system'

    if (!reason) {
      throw new BadRequestError('Rejection reason is required')
    }

    const { data: family, error: fetchError } = await supabase
      .from('family')
      .select('*')
      .eq('uuid', id)
      .single()

    if (fetchError || !family) {
      throw new NotFoundError('Family not found')
    }

    if (family.registration_status !== 'pending_verification') {
      throw new BadRequestError('Family is not pending verification')
    }

    const { data: updatedFamily, error: updateError } = await supabase
      .from('family')
      .update({
        registration_status: 'rejected',
      })
      .eq('uuid', id)
      .select()
      .single()

    if (updateError) {
      return res.status(400).json({
        success: false,
        error: updateError.message,
      })
    }

    await logHistory(id, 'reject', changedBy, family, updatedFamily, reason)
    await publishEvent('FAMILY_REJECTED', 'family', id, {
      family_id: family.family_id,
      rejection_reason: reason,
    })

    res.json({
      success: true,
      data: updatedFamily,
    })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /api/v1/families/:id/history
 * Get family audit history
 */
familyRouter.get('/:id/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params

    const { data, error } = await supabase
      .from('family_history')
      .select('*')
      .eq('family_uuid', id)
      .order('created_at', { ascending: false })

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
 * DELETE /api/v1/families/:id
 * Soft delete (archive) a family
 */
familyRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const changedBy = req.headers['x-family-id'] as string || 'system'

    const { data: family, error: fetchError } = await supabase
      .from('family')
      .select('*')
      .eq('uuid', id)
      .single()

    if (fetchError || !family) {
      throw new NotFoundError('Family not found')
    }

    // Soft delete by setting status to archived
    const { data: updatedFamily, error: updateError } = await supabase
      .from('family')
      .update({ status: 'archived' })
      .eq('uuid', id)
      .select()
      .single()

    if (updateError) {
      return res.status(400).json({
        success: false,
        error: updateError.message,
      })
    }

    await logHistory(id, 'delete', changedBy, family, updatedFamily, 'Family archived')
    await publishEvent('FAMILY_ARCHIVED', 'family', id, {
      family_id: family.family_id,
    })

    res.json({
      success: true,
      message: 'Family archived successfully',
    })
  } catch (error) {
    next(error)
  }
})
