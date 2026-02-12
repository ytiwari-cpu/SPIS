import { Router, Request, Response } from 'express'
import { supabase, getAllFamilyIds } from '../lib/supabase.js'

const router = Router()

/**
 * DEV MODE: Login with family_id
 * In production, this would use proper authentication
 * For development, we allow login by simply providing a family_id
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { family_id } = req.body

    if (!family_id) {
      return res.status(400).json({
        success: false,
        error: 'family_id is required',
      })
    }

    // Verify family exists in database
    // Note: family_id is the human-readable code (F1, F2, etc.)
    // uuid is the internal UUID for API calls
    const { data: family, error } = await supabase
      .from('family')
      .select('uuid, family_id, status, registration_status, created_at, household_size')
      .eq('family_id', family_id)
      .single()

    if (error || !family) {
      return res.status(404).json({
        success: false,
        error: 'Family not found',
        details: error?.message,
      })
    }

    // In dev mode, we just return the family data as "session"
    // In production, this would create a proper JWT token
    return res.json({
      success: true,
      data: {
        uuid: family.uuid,  // Internal UUID for API calls
        family_id: family.family_id,  // Human-readable code for display
        status: family.status,
        registration_status: family.registration_status,
        household_size: family.household_size,
        created_at: family.created_at,
        // Dev mode indicator
        auth_mode: 'dev_family_id',
      },
    })
  } catch (error) {
    console.error('Auth login error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
})

/**
 * Get current session/family info
 * In dev mode, family_id is passed in header
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const familyId = req.headers['x-family-id'] as string

    if (!familyId) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated. Provide X-Family-ID header.',
      })
    }

    // Get family with head member info
    // Note: X-Family-ID header contains the human-readable family_id (F1, F2, etc.)
    const { data: family, error } = await supabase
      .from('family')
      .select(`
        uuid,
        family_id,
        permanent_address_id,
        head_member_uuid,
        household_size,
        geo_code,
        vulnerability_flag,
        status,
        intake_channel,
        registration_status,
        submitted_at,
        verified_at,
        created_at,
        updated_at
      `)
      .eq('family_id', familyId)
      .single()

    if (error || !family) {
      return res.status(404).json({
        success: false,
        error: 'Family not found',
      })
    }

    // Get head of household (use family_uuid to find members)
    const { data: headMember } = await supabase
      .from('family_member')
      .select('uuid, member_id, first_name, last_name, national_id')
      .eq('family_uuid', family.uuid)
      .eq('relationship_to_head', 'head')
      .single()

    return res.json({
      success: true,
      data: {
        ...family,
        head_member: headMember || null,
      },
    })
  } catch (error) {
    console.error('Auth me error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
})

/**
 * DEV ONLY: List all available family IDs for quick login
 */
router.get('/families', async (_req: Request, res: Response) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: 'This endpoint is disabled in production',
      })
    }

    const result = await getAllFamilyIds()

    if (!result.success) {
      return res.status(500).json(result)
    }

    return res.json(result)
  } catch (error) {
    console.error('List families error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
})

/**
 * Logout (dev mode - just acknowledgment)
 */
router.post('/logout', async (_req: Request, res: Response) => {
  return res.json({
    success: true,
    message: 'Logged out successfully',
  })
})

export { router as authRouter }
