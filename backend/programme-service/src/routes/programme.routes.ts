/**
 * Programme Routes — CRUD for programme master, config, and payment settings
 * Supports: DRAFT/ACTIVE/INACTIVE status, ownership filtering, rules_tree
 */
import { Router, Response } from 'express'
import { supabase } from '../lib/supabase.js'
import { AuthenticatedRequest } from '../middleware/requireAuth.js'
import { createProgrammeSchema, updateProgrammeSchema } from '../validators/programme.validators.js'

export const programmeRouter = Router()

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Check if user is SuperAdmin */
function isSuperAdmin(req: AuthenticatedRequest): boolean {
    return (req.user?.roles || []).includes('SuperAdmin')
}

/** Get programme IDs this user has access to (as manager) */
async function getManagedProgrammeIds(userId: string): Promise<string[]> {
    const { data } = await supabase
        .from('programme_manager_link')
        .select('programme_id')
        .eq('user_id', userId)
    return (data || []).map(d => d.programme_id)
}

// GET /api/v1/programmes — List programmes (filtered by ownership for non-SuperAdmins)
programmeRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.sub

        if (isSuperAdmin(req)) {
            // SuperAdmin sees all
            const { data, error } = await supabase
                .from('programme_master')
                .select('*, programme_config(*), programme_payment_settings(*)')
                .order('created_at', { ascending: false })

            if (error) throw error
            res.json({ success: true, data: data || [] })
        } else {
            // ProgrammeManager/others: see programmes they created OR are linked to
            const managedIds = userId ? await getManagedProgrammeIds(userId) : []

            const { data, error } = await supabase
                .from('programme_master')
                .select('*, programme_config(*), programme_payment_settings(*)')
                .order('created_at', { ascending: false })

            if (error) throw error

            // Filter: created_by matches or programme_id in managed list
            const filtered = (data || []).filter(p =>
                p.created_by === userId || managedIds.includes(p.programme_id)
            )

            res.json({ success: true, data: filtered })
        }
    } catch (err: unknown) {
        res.status(500).json({ success: false, error: (err as Error).message })
    }
})

// GET /api/v1/programmes/:id — Get single programme with full details
programmeRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('programme_master')
            .select('*, programme_config(*), programme_payment_settings(*), programme_rules(*)')
            .eq('programme_id', req.params.id)
            .single()

        if (error) throw error
        if (!data) { res.status(404).json({ success: false, error: 'Programme not found' }); return }
        res.json({ success: true, data })
    } catch (err: unknown) {
        res.status(500).json({ success: false, error: (err as Error).message })
    }
})

// POST /api/v1/programmes — Create new programme (starts as DRAFT)
programmeRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const parsed = createProgrammeSchema.parse(req.body)
        const userId = req.user?.sub

        // 1. Create programme_master in DRAFT status
        const { data: programme, error: progErr } = await supabase
            .from('programme_master')
            .insert({
                programme_code: parsed.programme_code,
                programme_name: parsed.programme_name,
                description: parsed.description,
                status: 'DRAFT',
                active_flag: false,
                created_by: userId,
                updated_by: userId,
            })
            .select()
            .single()

        if (progErr) throw progErr

        // 2. Create programme_config
        await supabase.from('programme_config').insert({
            programme_id: programme.programme_id,
            ranking_required: parsed.ranking_required,
            quota_limit: parsed.quota_limit,
            benefit_type: parsed.benefit_type,
            benefit_frequency: parsed.benefit_frequency,
            effective_from: parsed.effective_from,
            effective_to: parsed.effective_to,
        })

        // 3. Create payment settings
        if (parsed.payment_frequency || parsed.payment_mode || parsed.total_budget_allocated) {
            await supabase.from('programme_payment_settings').insert({
                programme_id: programme.programme_id,
                payment_frequency: parsed.payment_frequency,
                payment_mode: parsed.payment_mode,
                total_budget_allocated: parsed.total_budget_allocated,
                currency: parsed.currency,
                effective_from: parsed.effective_from,
            })
        }

        // 4. Auto-add creator as a manager
        if (userId) {
            await supabase.from('programme_manager_link').insert({
                programme_id: programme.programme_id,
                user_id: userId,
                added_by: userId,
            })
        }

        // 5. Record history
        await supabase.from('programme_history').insert({
            programme_id: programme.programme_id,
            change_type: 'CREATED',
            new_value: programme,
            changed_by: userId,
        })

        // Fetch full programme with relations
        const { data: full } = await supabase
            .from('programme_master')
            .select('*, programme_config(*), programme_payment_settings(*)')
            .eq('programme_id', programme.programme_id)
            .single()

        res.status(201).json({ success: true, data: full })
    } catch (err: unknown) {
        if ((err as { name?: string }).name === 'ZodError') {
            res.status(400).json({ success: false, error: 'Validation failed', details: err })
            return
        }
        res.status(500).json({ success: false, error: (err as Error).message })
    }
})

// PATCH /api/v1/programmes/:id — Update programme
programmeRouter.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const parsed = updateProgrammeSchema.parse(req.body)
        const userId = req.user?.sub
        const programmeId = req.params.id

        // Get old value for history
        const { data: oldProg } = await supabase
            .from('programme_master')
            .select('*')
            .eq('programme_id', programmeId)
            .single()

        // Update programme_master
        const masterFields: Record<string, unknown> = { updated_by: userId, updated_at: new Date().toISOString() }
        if (parsed.programme_name) masterFields.programme_name = parsed.programme_name
        if (parsed.description !== undefined) masterFields.description = parsed.description

        const { data: updated, error } = await supabase
            .from('programme_master')
            .update(masterFields)
            .eq('programme_id', programmeId)
            .select()
            .single()

        if (error) throw error

        // Update config if relevant fields provided
        const configFields: Record<string, unknown> = {}
        if (parsed.ranking_required !== undefined) configFields.ranking_required = parsed.ranking_required
        if (parsed.quota_limit !== undefined) configFields.quota_limit = parsed.quota_limit
        if (parsed.benefit_type) configFields.benefit_type = parsed.benefit_type
        if (parsed.benefit_frequency) configFields.benefit_frequency = parsed.benefit_frequency
        if (parsed.effective_from) configFields.effective_from = parsed.effective_from
        if (parsed.effective_to !== undefined) configFields.effective_to = parsed.effective_to

        if (Object.keys(configFields).length > 0) {
            configFields.updated_at = new Date().toISOString()
            await supabase.from('programme_config').update(configFields).eq('programme_id', programmeId)
        }

        // Record history
        await supabase.from('programme_history').insert({
            programme_id: programmeId,
            change_type: 'UPDATED',
            old_value: oldProg,
            new_value: updated,
            changed_by: userId,
        })

        const { data: full } = await supabase
            .from('programme_master')
            .select('*, programme_config(*), programme_payment_settings(*)')
            .eq('programme_id', programmeId)
            .single()

        res.json({ success: true, data: full })
    } catch (err: unknown) {
        res.status(500).json({ success: false, error: (err as Error).message })
    }
})

// PATCH /api/v1/programmes/:id/rules-tree — Save the AND/OR rules tree JSON
programmeRouter.patch('/:id/rules-tree', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { rules_tree } = req.body
        const userId = req.user?.sub
        const programmeId = req.params.id

        const { data, error } = await supabase
            .from('programme_master')
            .update({
                rules_tree,
                updated_by: userId,
                updated_at: new Date().toISOString(),
            })
            .eq('programme_id', programmeId)
            .select()
            .single()

        if (error) throw error
        res.json({ success: true, data })
    } catch (err: unknown) {
        res.status(500).json({ success: false, error: (err as Error).message })
    }
})

// PATCH /api/v1/programmes/:id/activate — Transition DRAFT → ACTIVE
programmeRouter.patch('/:id/activate', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.sub
        const programmeId = req.params.id

        // Get current programme
        const { data: prog } = await supabase
            .from('programme_master')
            .select('*')
            .eq('programme_id', programmeId)
            .single()

        if (!prog) { res.status(404).json({ success: false, error: 'Programme not found' }); return }
        if (prog.status === 'ACTIVE') { res.json({ success: true, data: prog, message: 'Already active' }); return }

        // Check rules_tree exists before activation
        if (!prog.rules_tree || (Array.isArray(prog.rules_tree?.rules) && prog.rules_tree.rules.length === 0)) {
            res.status(400).json({ success: false, error: 'Cannot activate programme without eligibility rules' })
            return
        }

        const { data: updated, error } = await supabase
            .from('programme_master')
            .update({
                status: 'ACTIVE',
                active_flag: true,
                updated_by: userId,
                updated_at: new Date().toISOString(),
            })
            .eq('programme_id', programmeId)
            .select('*, programme_config(*), programme_payment_settings(*)')
            .single()

        if (error) throw error

        // Record history
        await supabase.from('programme_history').insert({
            programme_id: programmeId,
            change_type: 'ACTIVATED',
            old_value: prog,
            new_value: updated,
            changed_by: userId,
        })

        res.json({ success: true, data: updated })
    } catch (err: unknown) {
        res.status(500).json({ success: false, error: (err as Error).message })
    }
})

// DELETE /api/v1/programmes/:id — Soft delete (set status INACTIVE, active_flag = false)
programmeRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { error } = await supabase
            .from('programme_master')
            .update({
                active_flag: false,
                status: 'INACTIVE',
                updated_at: new Date().toISOString(),
                updated_by: req.user?.sub,
            })
            .eq('programme_id', req.params.id)

        if (error) throw error
        res.json({ success: true, message: 'Programme deactivated' })
    } catch (err: unknown) {
        res.status(500).json({ success: false, error: (err as Error).message })
    }
})
