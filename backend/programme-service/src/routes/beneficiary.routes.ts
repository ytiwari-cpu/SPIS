/**
 * Beneficiary (Enrollment) Routes — Manage programme_citizens
 */
import { Router, Response } from 'express'
import { supabase } from '../lib/supabase.js'
import { AuthenticatedRequest } from '../middleware/requireAuth.js'
import { enrollCitizenSchema } from '../validators/programme.validators.js'

export const beneficiaryRouter = Router()

// GET /api/v1/beneficiaries/:programmeId — List enrolled beneficiaries
beneficiaryRouter.get('/:programmeId', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('programme_citizens')
            .select('*')
            .eq('programme_id', req.params.programmeId)
            .order('created_at', { ascending: false })

        if (error) throw error
        res.json({ success: true, data: data || [] })
    } catch (err: unknown) {
        res.status(500).json({ success: false, error: (err as Error).message })
    }
})

// POST /api/v1/beneficiaries/:programmeId — Enroll a citizen/family
beneficiaryRouter.post('/:programmeId', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const parsed = enrollCitizenSchema.parse(req.body)
        const { data, error } = await supabase
            .from('programme_citizens')
            .insert({
                programme_id: req.params.programmeId,
                ...parsed,
                status: 'Pending',
                approved_by: req.user?.sub,
            })
            .select()
            .single()

        if (error) throw error
        res.status(201).json({ success: true, data })
    } catch (err: unknown) {
        if ((err as { name?: string }).name === 'ZodError') {
            res.status(400).json({ success: false, error: 'Validation failed', details: err })
            return
        }
        res.status(500).json({ success: false, error: (err as Error).message })
    }
})

// PATCH /api/v1/beneficiaries/:programmeId/:subjectId/status — Update status
beneficiaryRouter.patch('/:programmeId/:subjectId/status', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { status } = req.body
        if (!['Active', 'Suspended', 'Exited', 'Pending'].includes(status)) {
            res.status(400).json({ success: false, error: 'Invalid status' })
            return
        }

        const updatePayload: Record<string, unknown> = { status }
        if (status === 'Active') {
            updatePayload.approved_at = new Date().toISOString()
            updatePayload.approved_by = req.user?.sub
        }

        const { data, error } = await supabase
            .from('programme_citizens')
            .update(updatePayload)
            .eq('programme_id', req.params.programmeId)
            .eq('subject_id', req.params.subjectId)
            .select()
            .single()

        if (error) throw error

        // If exiting, record exit history
        if (status === 'Exited') {
            await supabase.from('programme_exit_history').insert({
                programme_id: req.params.programmeId,
                subject_id: req.params.subjectId,
                subject_type: data.subject_type,
                exit_reason: req.body.exit_reason || 'Manual exit',
                remarks: req.body.remarks,
                exited_by: req.user?.sub,
            })
        }

        res.json({ success: true, data })
    } catch (err: unknown) {
        res.status(500).json({ success: false, error: (err as Error).message })
    }
})
