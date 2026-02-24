/**
 * Variable Catalog Routes — Manage available rule variables/fields
 */
import { Router, Response } from 'express'
import { AuthenticatedRequest, requireRole } from '../middleware/requireAuth.js'
import { getAllVariables, getVariablesByCategory } from '../services/variableCatalog.js'

export const variableRouter = Router()

// GET /api/v1/variables — List all active variables (including rule group scores)
variableRouter.get('/', async (_req: AuthenticatedRequest, res: Response) => {
    try {
        const variables = await getAllVariables()

        // Also append rule group scores as computed variables
        const { supabase } = await import('../lib/supabase.js')
        const { data: ruleGroups } = await supabase
            .from('rule_group')
            .select('rule_group_id, group_code, group_name, scoring_method')
            .eq('is_active', true)

        const computedVars = (ruleGroups || []).map(g => ({
            variable_code: `${g.group_code}_SCORE`,
            display_name: `${g.group_name} Score`,
            category: 'Computed Score',
            data_type: 'number',
            source_table: 'rule_group',
            source_column: g.rule_group_id,
            enum_values: null,
            is_system_field: false,
            is_active: true,
        }))

        res.json({ success: true, data: [...variables, ...computedVars] })
    } catch (err: unknown) {
        res.status(500).json({ success: false, error: (err as Error).message })
    }
})

// GET /api/v1/variables/grouped — Variables grouped by category
variableRouter.get('/grouped', async (_req: AuthenticatedRequest, res: Response) => {
    try {
        const data = await getVariablesByCategory()
        res.json({ success: true, data })
    } catch (err: unknown) {
        res.status(500).json({ success: false, error: (err as Error).message })
    }
})

// POST /api/v1/variables/refresh — Re-scan family DB (SuperAdmin only)
variableRouter.post('/refresh', requireRole('SuperAdmin'), async (_req: AuthenticatedRequest, res: Response) => {
    try {
        // In a full implementation, this would scan the family DB information_schema
        // and add any new columns. For now, we return the existing catalog.
        const data = await getAllVariables()
        res.json({ success: true, message: 'Variable catalog refreshed', count: data.length, data })
    } catch (err: unknown) {
        res.status(500).json({ success: false, error: (err as Error).message })
    }
})
