/**
 * Programme Manager Routes — Manage programme-manager access links
 * Uses programme_manager_link junction table + IAM service API
 */
import { Router, Response } from 'express'
import { supabase } from '../lib/supabase.js'
import { AuthenticatedRequest, requireRole } from '../middleware/requireAuth.js'

export const programmeManagerRouter = Router()

const IAM_SERVICE_URL = process.env.IAM_SERVICE_URL || 'http://localhost:3003'

// GET /api/v1/programme-managers — List all users with ProgrammeManager role (from IAM)
programmeManagerRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const token = req.headers.authorization
        // IAM admin route: /iam/admin/users?role=ProgrammeManager
        const response = await fetch(`${IAM_SERVICE_URL}/iam/admin/users?role=ProgrammeManager&limit=100`, {
            headers: token ? { 'Authorization': token } : {},
        })
        if (!response.ok) {
            // Fallback: return empty list if IAM is unreachable or caller lacks ADMIN.ROLES.VIEW
            res.json({ success: true, data: [] })
            return
        }
        const json = await response.json() as { success?: boolean; data?: unknown[] }
        res.json({ success: true, data: json.data || [] })
    } catch (err: unknown) {
        res.status(500).json({ success: false, error: (err as Error).message })
    }
})

// GET /api/v1/programme-managers/programme/:programmeId — List managers for a programme
programmeManagerRouter.get('/programme/:programmeId', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('programme_manager_link')
            .select('*')
            .eq('programme_id', req.params.programmeId)
            .order('created_at')

        if (error) throw error
        res.json({ success: true, data: data || [] })
    } catch (err: unknown) {
        res.status(500).json({ success: false, error: (err as Error).message })
    }
})

// POST /api/v1/programme-managers/programme/:programmeId — Add a manager
programmeManagerRouter.post('/programme/:programmeId', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { user_id } = req.body
        if (!user_id) {
            res.status(400).json({ success: false, error: 'user_id is required' })
            return
        }

        // Check if caller is owner or SuperAdmin
        const callerSub = req.user?.sub
        const callerRoles = req.user?.roles || []
        const isSuperAdmin = callerRoles.includes('SuperAdmin')

        if (!isSuperAdmin) {
            // Check if caller is the programme creator
            const { data: prog } = await supabase
                .from('programme_master')
                .select('created_by')
                .eq('programme_id', req.params.programmeId)
                .single()

            if (!prog || prog.created_by !== callerSub) {
                // Also check if caller is an existing manager
                const { data: link } = await supabase
                    .from('programme_manager_link')
                    .select('id')
                    .eq('programme_id', req.params.programmeId)
                    .eq('user_id', callerSub)
                    .single()

                if (!link) {
                    res.status(403).json({ success: false, error: 'Only programme owner or SuperAdmin can add managers' })
                    return
                }
            }
        }

        const { data, error } = await supabase
            .from('programme_manager_link')
            .insert({
                programme_id: req.params.programmeId,
                user_id,
                added_by: callerSub,
            })
            .select()
            .single()

        if (error) {
            if (error.code === '23505') {
                res.status(409).json({ success: false, error: 'This manager already has access to this programme' })
                return
            }
            throw error
        }

        res.status(201).json({ success: true, data })
    } catch (err: unknown) {
        res.status(500).json({ success: false, error: (err as Error).message })
    }
})

// DELETE /api/v1/programme-managers/programme/:programmeId/:userId — Remove a manager
programmeManagerRouter.delete('/programme/:programmeId/:userId', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const callerSub = req.user?.sub
        const callerRoles = req.user?.roles || []
        const isSuperAdmin = callerRoles.includes('SuperAdmin')

        if (!isSuperAdmin) {
            const { data: prog } = await supabase
                .from('programme_master')
                .select('created_by')
                .eq('programme_id', req.params.programmeId)
                .single()

            if (!prog || prog.created_by !== callerSub) {
                res.status(403).json({ success: false, error: 'Only programme owner or SuperAdmin can remove managers' })
                return
            }
        }

        const { error } = await supabase
            .from('programme_manager_link')
            .delete()
            .eq('programme_id', req.params.programmeId)
            .eq('user_id', req.params.userId)

        if (error) throw error
        res.json({ success: true, message: 'Manager removed from programme' })
    } catch (err: unknown) {
        res.status(500).json({ success: false, error: (err as Error).message })
    }
})
