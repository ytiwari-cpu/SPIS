/**
 * Audit Routes — Programme history and audit logs
 */
import { Router, Response } from 'express'
import { supabase } from '../lib/supabase.js'
import { AuthenticatedRequest } from '../middleware/requireAuth.js'

export const auditRouter = Router()

// GET /api/v1/audit/programme/:programmeId — Programme change history
auditRouter.get('/programme/:programmeId', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('programme_history')
            .select('*')
            .eq('programme_id', req.params.programmeId)
            .order('changed_at', { ascending: false })
            .limit(100)

        if (error) throw error
        res.json({ success: true, data: data || [] })
    } catch (err: unknown) {
        res.status(500).json({ success: false, error: (err as Error).message })
    }
})

// GET /api/v1/audit/rules/:programmeId — Rule change history
auditRouter.get('/rules/:programmeId', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('programme_rules_history')
            .select('*')
            .eq('programme_id', req.params.programmeId)
            .order('changed_at', { ascending: false })
            .limit(100)

        if (error) throw error
        res.json({ success: true, data: data || [] })
    } catch (err: unknown) {
        res.status(500).json({ success: false, error: (err as Error).message })
    }
})

// GET /api/v1/audit/exits/:programmeId — Exit history
auditRouter.get('/exits/:programmeId', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('programme_exit_history')
            .select('*')
            .eq('programme_id', req.params.programmeId)
            .order('exited_at', { ascending: false })
            .limit(100)

        if (error) throw error
        res.json({ success: true, data: data || [] })
    } catch (err: unknown) {
        res.status(500).json({ success: false, error: (err as Error).message })
    }
})

// GET /api/v1/audit/all — All audit logs across programmes
auditRouter.get('/all', async (_req: AuthenticatedRequest, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('programme_history')
            .select('*')
            .order('changed_at', { ascending: false })
            .limit(200)

        if (error) throw error
        res.json({ success: true, data: data || [] })
    } catch (err: unknown) {
        res.status(500).json({ success: false, error: (err as Error).message })
    }
})
