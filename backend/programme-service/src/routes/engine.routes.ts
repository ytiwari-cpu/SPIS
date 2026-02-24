/**
 * Engine Routes — Rule engine evaluation endpoints
 */
import { Router, Response } from 'express'
import { supabase } from '../lib/supabase.js'
import { AuthenticatedRequest, requirePermission } from '../middleware/requireAuth.js'
import { evaluateSubject, evaluateAllSubjects } from '../services/ruleEngine.js'

export const engineRouter = Router()

// POST /api/v1/engine/evaluate/:programmeId — Evaluate a single subject
engineRouter.post(
    '/evaluate/:programmeId',
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const { subject_id, subject_type } = req.body
            if (!subject_id || !subject_type) {
                res.status(400).json({ success: false, error: 'subject_id and subject_type are required' })
                return
            }

            const result = await evaluateSubject(req.params.programmeId, subject_id, subject_type)

            // Upsert the result in programme_citizens
            await supabase.from('programme_citizens').upsert({
                programme_id: req.params.programmeId,
                subject_id: result.subject_id,
                subject_type: result.subject_type,
                calculated_score: result.calculated_score,
                group_scores: result.group_scores,
                status: result.eligible ? 'Active' : 'Pending',
            }, { onConflict: 'programme_id,subject_id' })

            res.json({ success: true, data: result })
        } catch (err: unknown) {
            res.status(500).json({ success: false, error: (err as Error).message })
        }
    },
)

// POST /api/v1/engine/evaluate-all/:programmeId — Batch evaluate all families
engineRouter.post(
    '/evaluate-all/:programmeId',
    requirePermission('PROGRAMME.ENGINE.RUN', 'ADMIN.PROGRAMMES.EDIT'),
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const results = await evaluateAllSubjects(req.params.programmeId)

            // Bulk upsert results
            const records = results.map(r => ({
                programme_id: req.params.programmeId,
                subject_id: r.subject_id,
                subject_type: r.subject_type,
                calculated_score: r.calculated_score,
                group_scores: r.group_scores,
                status: r.eligible ? 'Active' : 'Pending',
            }))

            if (records.length > 0) {
                await supabase.from('programme_citizens').upsert(records, { onConflict: 'programme_id,subject_id' })
            }

            res.json({
                success: true,
                data: {
                    total_evaluated: results.length,
                    eligible: results.filter(r => r.eligible).length,
                    ineligible: results.filter(r => !r.eligible).length,
                    results,
                },
            })
        } catch (err: unknown) {
            res.status(500).json({ success: false, error: (err as Error).message })
        }
    },
)

// GET /api/v1/engine/impact/:programmeId — Impact analysis (dry-run evaluation)
engineRouter.get(
    '/impact/:programmeId',
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const results = await evaluateAllSubjects(req.params.programmeId)

            res.json({
                success: true,
                data: {
                    total_families: results.length,
                    would_be_eligible: results.filter(r => r.eligible).length,
                    would_be_ineligible: results.filter(r => !r.eligible).length,
                    average_score: results.length > 0
                        ? results.reduce((sum, r) => sum + r.calculated_score, 0) / results.length
                        : 0,
                },
            })
        } catch (err: unknown) {
            res.status(500).json({ success: false, error: (err as Error).message })
        }
    },
)
