/**
 * Rule Routes — Manage rule_master entries and programme_rules
 */
import { Router, Response } from 'express'
import { supabase } from '../lib/supabase.js'
import { AuthenticatedRequest } from '../middleware/requireAuth.js'
import { addProgrammeRuleSchema, createRuleVersionSchema } from '../validators/programme.validators.js'

export const ruleRouter = Router()

// GET /api/v1/rules — List all rule_master entries
ruleRouter.get('/', async (_req: AuthenticatedRequest, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('rule_master')
            .select('*')
            .order('category')
            .order('rule_name')

        if (error) throw error
        res.json({ success: true, data: data || [] })
    } catch (err: unknown) {
        res.status(500).json({ success: false, error: (err as Error).message })
    }
})

// POST /api/v1/rules — Create a new rule_master entry
ruleRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('rule_master')
            .insert(req.body)
            .select()
            .single()

        if (error) throw error
        res.status(201).json({ success: true, data })
    } catch (err: unknown) {
        res.status(500).json({ success: false, error: (err as Error).message })
    }
})

// GET /api/v1/rules/programme/:programmeId — Get rules for a programme
ruleRouter.get('/programme/:programmeId', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('programme_rules')
            .select('*, rule_master:rule_code(*)')
            .eq('programme_id', req.params.programmeId)
            .order('created_at')

        if (error) throw error
        res.json({ success: true, data: data || [] })
    } catch (err: unknown) {
        res.status(500).json({ success: false, error: (err as Error).message })
    }
})

// POST /api/v1/rules/programme/:programmeId — Add a rule to a programme
ruleRouter.post('/programme/:programmeId', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const parsed = addProgrammeRuleSchema.parse(req.body)
        const { data, error } = await supabase
            .from('programme_rules')
            .insert({
                programme_id: req.params.programmeId,
                ...parsed,
            })
            .select()
            .single()

        if (error) throw error

        // Record history
        await supabase.from('programme_rules_history').insert({
            programme_id: req.params.programmeId,
            rule_code: parsed.rule_code,
            new_value: data,
            rule_version: parsed.rule_version,
            changed_by: req.user?.sub,
        })

        res.status(201).json({ success: true, data })
    } catch (err: unknown) {
        if ((err as { name?: string }).name === 'ZodError') {
            res.status(400).json({ success: false, error: 'Validation failed', details: err })
            return
        }
        res.status(500).json({ success: false, error: (err as Error).message })
    }
})

// DELETE /api/v1/rules/programme/:programmeId/:ruleId — Remove a rule from a programme
ruleRouter.delete('/programme/:programmeId/:ruleId', async (req: AuthenticatedRequest, res: Response) => {
    try {
        // Get old value for history
        const { data: oldRule } = await supabase
            .from('programme_rules')
            .select('*')
            .eq('programme_rule_id', req.params.ruleId)
            .single()

        const { error } = await supabase
            .from('programme_rules')
            .delete()
            .eq('programme_rule_id', req.params.ruleId)
            .eq('programme_id', req.params.programmeId)

        if (error) throw error

        // Record history
        if (oldRule) {
            await supabase.from('programme_rules_history').insert({
                programme_id: req.params.programmeId,
                rule_code: oldRule.rule_code,
                old_value: oldRule,
                changed_by: req.user?.sub,
            })
        }

        res.json({ success: true, message: 'Rule removed from programme' })
    } catch (err: unknown) {
        res.status(500).json({ success: false, error: (err as Error).message })
    }
})

// ─── Rule Versions ────────────────────────────────────────────────────────────

// GET /api/v1/rules/versions — List all rule versions
ruleRouter.get('/versions', async (_req: AuthenticatedRequest, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('rule_version_master')
            .select('*')
            .order('effective_from', { ascending: false })

        if (error) throw error
        res.json({ success: true, data: data || [] })
    } catch (err: unknown) {
        res.status(500).json({ success: false, error: (err as Error).message })
    }
})

// POST /api/v1/rules/versions — Create a new rule version
ruleRouter.post('/versions', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const parsed = createRuleVersionSchema.parse(req.body)
        const { data, error } = await supabase
            .from('rule_version_master')
            .insert(parsed)
            .select()
            .single()

        if (error) throw error
        res.status(201).json({ success: true, data })
    } catch (err: unknown) {
        res.status(500).json({ success: false, error: (err as Error).message })
    }
})
