/**
 * SPIS Family Service — Citizens Routes
 *
 * Admin-only endpoint to list all family members (citizens) with
 * pagination, search, and filtering.  Protected by JWT + permission check.
 * 
 * NOTE: Authorization uses PERMISSIONS only, never role names.
 */

import { Router, type Request, type Response, type NextFunction } from 'express'
import { supabase } from '../lib/supabase.js'
import type { AuthenticatedRequest } from '../middleware/requireAuth.js'

export const citizensRouter = Router()

// ─── Permission guard (ADMIN.USERS.VIEW required) ────────────────────────────
// NOTE: We check PERMISSIONS, not role names, for scalability.
// If you rename or remove roles, this still works as long as permissions exist.
function requirePermission(permission: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const permissions = req.user?.permissions || []
    if (!permissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden — requires permission: ${permission}`,
      })
    }
    next()
  }
}

citizensRouter.use(requirePermission('ADMIN.USERS.VIEW'))

/**
 * GET /api/v1/citizens
 *
 * Query params:
 *   page   (default 1)
 *   limit  (default 20, max 100)
 *   search (ILIKE on first_name, last_name, email, national_id, member_id)
 *   status (filter by member_status)
 *   gender (filter by gender)
 *
 * Response:
 *   { success, data: [...], pagination: { page, limit, total, totalPages } }
 */
citizensRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20))
    const search = (req.query.search as string || '').trim()
    const status = (req.query.status as string || '').trim()
    const gender = (req.query.gender as string || '').trim()

    const offset = (page - 1) * limit

    // Build the query using the Supabase client (family schema)
    let query = supabase
      .from('family_member')
      .select(
        'uuid, member_id, family_uuid, national_id, first_name, last_name, ' +
        'date_of_birth, gender, relationship_to_head, alive_flag, marital_status, ' +
        'phone, email, member_status, created_at, updated_at',
        { count: 'exact' },
      )

    // Filters
    if (status) {
      query = query.eq('member_status', status)
    }
    if (gender) {
      query = query.eq('gender', gender)
    }

    // Search across multiple fields
    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,national_id.ilike.%${search}%,member_id.ilike.%${search}%`,
      )
    }

    // Pagination + order
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data, count, error } = await query

    if (error) {
      console.error('Citizens list error:', error.message)
      return res.status(500).json({
        success: false,
        error: { code: 'FETCH_ERROR', message: 'Failed to fetch citizens' },
      })
    }

    const total = count ?? 0

    console.log(`Fetching Family members: count=${total}`)

    return res.json({
      success: true,
      data: data || [],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/v1/citizens/:id
 * Get a single citizen by UUID
 */
citizensRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params

    const { data, error } = await supabase
      .from('family_member')
      .select(
        'uuid, member_id, family_uuid, national_id, first_name, last_name, ' +
        'date_of_birth, gender, relationship_to_head, alive_flag, marital_status, ' +
        'phone, email, member_status, created_at, updated_at',
      )
      .eq('uuid', id)
      .single()

    if (error || !data) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Citizen not found' },
      })
    }

    return res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})
