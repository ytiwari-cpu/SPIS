import { Router, Request, Response, NextFunction } from 'express'
import { supabase } from '../lib/supabase.js'
import { validate } from '../middleware/validate.js'
import { NotFoundError } from '../middleware/errorHandler.js'
import { CreateAddressSchema, UpdateAddressSchema } from '../validators/schemas.js'
import type { CreateAddressRequest, UpdateAddressRequest } from '../types/index.js'

export const addressRouter = Router()

/**
 * GET /api/v1/addresses/:id
 * Get address by ID
 */
addressRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params

    const { data: address, error } = await supabase
      .from('address')
      .select('*')
      .eq('address_id', id)
      .single()

    if (error || !address) {
      throw new NotFoundError('Address not found')
    }

    res.json({
      success: true,
      data: address,
    })
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/v1/addresses
 * Create new address
 */
addressRouter.post('/', validate(CreateAddressSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body: CreateAddressRequest = req.body

    const { data: address, error } = await supabase
      .from('address')
      .insert({
        line1: body.line1,
        line2: body.line2 || null,
        city: body.city || null,
        region: body.region || null,
        postal_code: body.postal_code || null,
        country: body.country || 'Tanzania',
        latitude: body.latitude || null,
        longitude: body.longitude || null,
      })
      .select()
      .single()

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message,
      })
    }

    res.status(201).json({
      success: true,
      data: address,
    })
  } catch (error) {
    next(error)
  }
})

/**
 * PATCH /api/v1/addresses/:id
 * Update address
 */
addressRouter.patch('/:id', validate(UpdateAddressSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const updates: UpdateAddressRequest = req.body

    // Verify address exists
    const { data: existing, error: fetchError } = await supabase
      .from('address')
      .select('address_id')
      .eq('address_id', id)
      .single()

    if (fetchError || !existing) {
      throw new NotFoundError('Address not found')
    }

    const { data: address, error } = await supabase
      .from('address')
      .update(updates)
      .eq('address_id', id)
      .select()
      .single()

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message,
      })
    }

    res.json({
      success: true,
      data: address,
    })
  } catch (error) {
    next(error)
  }
})

/**
 * DELETE /api/v1/addresses/:id
 * Delete address (only if not referenced)
 */
addressRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params

    // Check if address is referenced by any family
    const { data: familyRef } = await supabase
      .from('family')
      .select('family_id')
      .eq('permanent_address_id', id)
      .limit(1)

    if (familyRef && familyRef.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete address that is used as a permanent address by a family',
      })
    }

    // Check if address is referenced by any member
    const { data: memberRef } = await supabase
      .from('family_member')
      .select('member_id')
      .eq('current_address_id', id)
      .limit(1)

    if (memberRef && memberRef.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete address that is used by a family member',
      })
    }

    const { error } = await supabase
      .from('address')
      .delete()
      .eq('address_id', id)

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message,
      })
    }

    res.json({
      success: true,
      message: 'Address deleted successfully',
    })
  } catch (error) {
    next(error)
  }
})
