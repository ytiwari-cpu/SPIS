/**
 * Rule Group Routes — CRUD for composite rule groups (PMT, MT, etc.)
 */
import { Router, Response } from 'express'
import { supabase } from '../lib/supabase.js'
import { AuthenticatedRequest, requireRole } from '../middleware/requireAuth.js'
import { createRuleGroupSchema, updateRuleGroupSchema, addRuleGroupRuleSchema } from '../validators/programme.validators.js'

export const ruleGroupRouter = Router()

// GET /api/v1/rule-groups — List all rule groups
ruleGroupRouter.get('/', async (_req: AuthenticatedRequest, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('rule_group')
            .select('*, rule_group_rules(*)')
            .eq('is_active', true)
            .order('group_name')

        if (error) throw error
        res.json({ success: true, data: data || [] })
    } catch (err: unknown) {
        res.status(500).json({ success: false, error: (err as Error).message })
    }
})

// GET /api/v1/rule-groups/:id — Get single group with its rules
ruleGroupRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('rule_group')
            .select('*, rule_group_rules(*, rule_variable_catalog:variable_code(*))')
            .eq('rule_group_id', req.params.id)
            .single()

        if (error) throw error
        if (!data) { res.status(404).json({ success: false, error: 'Rule group not found' }); return }
        res.json({ success: true, data })
    } catch (err: unknown) {
        res.status(500).json({ success: false, error: (err as Error).message })
    }
})

// POST /api/v1/rule-groups — Create (SuperAdmin only)
ruleGroupRouter.post('/', requireRole('SuperAdmin'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const parsed = createRuleGroupSchema.parse(req.body)
        const { data, error } = await supabase
            .from('rule_group')
            .insert({
                ...parsed,
                created_by: req.user?.sub,
                updated_by: req.user?.sub,
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

// PATCH /api/v1/rule-groups/:id — Update (SuperAdmin only)
ruleGroupRouter.patch('/:id', requireRole('SuperAdmin'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const parsed = updateRuleGroupSchema.parse(req.body)
        const { data, error } = await supabase
            .from('rule_group')
            .update({ ...parsed, updated_by: req.user?.sub, updated_at: new Date().toISOString() })
            .eq('rule_group_id', req.params.id)
            .select()
            .single()

        if (error) throw error
        res.json({ success: true, data })
    } catch (err: unknown) {
        res.status(500).json({ success: false, error: (err as Error).message })
    }
})

// DELETE /api/v1/rule-groups/:id — Soft delete (SuperAdmin only)
ruleGroupRouter.delete('/:id', requireRole('SuperAdmin'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { error } = await supabase
            .from('rule_group')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('rule_group_id', req.params.id)

        if (error) throw error
        res.json({ success: true, message: 'Rule group deactivated' })
    } catch (err: unknown) {
        res.status(500).json({ success: false, error: (err as Error).message })
    }
})

// ─── Sub-Rules within a Group ─────────────────────────────────────────────────

// POST /api/v1/rule-groups/:id/rules — Add a sub-rule (SuperAdmin only)
ruleGroupRouter.post('/:id/rules', requireRole('SuperAdmin'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const parsed = addRuleGroupRuleSchema.parse(req.body)
        const { data, error } = await supabase
            .from('rule_group_rules')
            .insert({
                rule_group_id: req.params.id,
                ...parsed,
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

// DELETE /api/v1/rule-groups/:groupId/rules/:ruleId — Remove sub-rule
ruleGroupRouter.delete('/:groupId/rules/:ruleId', requireRole('SuperAdmin'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { error } = await supabase
            .from('rule_group_rules')
            .delete()
            .eq('rule_group_rule_id', req.params.ruleId)
            .eq('rule_group_id', req.params.groupId)

        if (error) throw error
        res.json({ success: true, message: 'Sub-rule removed' })
    } catch (err: unknown) {
        res.status(500).json({ success: false, error: (err as Error).message })
    }
})
