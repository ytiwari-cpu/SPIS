/**
 * Custom Field Routes — Manage user-created custom fields
 */
import { Router, Response } from 'express'
import { AuthenticatedRequest, requireRole } from '../middleware/requireAuth.js'
import { createCustomFieldSchema, updateCustomFieldSchema } from '../validators/programme.validators.js'
import {
    createCustomField,
    getAllCustomFields,
    getCustomFieldsByTable,
    updateCustomField,
    deactivateCustomField,
} from '../services/customFieldManager.js'

export const customFieldRouter = Router()

// GET /api/v1/custom-fields — List all custom fields
customFieldRouter.get('/', async (_req: AuthenticatedRequest, res: Response) => {
    try {
        const data = await getAllCustomFields()
        res.json({ success: true, data })
    } catch (err: unknown) {
        res.status(500).json({ success: false, error: (err as Error).message })
    }
})

// GET /api/v1/custom-fields/:table — List custom fields for a specific table
customFieldRouter.get('/table/:table', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const data = await getCustomFieldsByTable(req.params.table)
        res.json({ success: true, data })
    } catch (err: unknown) {
        res.status(500).json({ success: false, error: (err as Error).message })
    }
})

// POST /api/v1/custom-fields — Create a new custom field (SuperAdmin / ProgrammeManager)
customFieldRouter.post(
    '/',
    requireRole('SuperAdmin', 'ProgrammeManager'),
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const parsed = createCustomFieldSchema.parse(req.body)
            const data = await createCustomField(parsed, req.user?.sub)
            res.status(201).json({ success: true, data })
        } catch (err: unknown) {
            if ((err as { name?: string }).name === 'ZodError') {
                res.status(400).json({ success: false, error: 'Validation failed', details: err })
                return
            }
            res.status(500).json({ success: false, error: (err as Error).message })
        }
    },
)

// PATCH /api/v1/custom-fields/:id — Update a custom field
customFieldRouter.patch(
    '/:id',
    requireRole('SuperAdmin', 'ProgrammeManager'),
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const parsed = updateCustomFieldSchema.parse(req.body)
            const data = await updateCustomField(req.params.id, parsed, req.user?.sub)
            res.json({ success: true, data })
        } catch (err: unknown) {
            res.status(500).json({ success: false, error: (err as Error).message })
        }
    },
)

// DELETE /api/v1/custom-fields/:id — Deactivate a custom field
customFieldRouter.delete(
    '/:id',
    requireRole('SuperAdmin', 'ProgrammeManager'),
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            await deactivateCustomField(req.params.id)
            res.json({ success: true, message: 'Custom field deactivated' })
        } catch (err: unknown) {
            res.status(500).json({ success: false, error: (err as Error).message })
        }
    },
)
