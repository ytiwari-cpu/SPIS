import { z } from 'zod'
import { ApiSchema } from '../../../../../base/apiSchema.js'
import { ProgrammeController } from './programmeController.js'
import { requireAuth } from '../../../../../base/middleware/requireAuth.js'

// ─── Inline Zod Schemas ─────────────────────────────────────────────────────
export const createProgrammeSchema = z.object({
  programme_code:      z.string().min(1).max(50),
  programme_name:      z.string().min(1).max(255),
  description:         z.string().optional(),
  ranking_required:    z.boolean().optional().default(false),
  quota_limit:         z.number().int().positive().optional(),
  benefit_type:        z.enum(['Cash', 'In-Kind', 'Hybrid', 'Service']),
  benefit_frequency:   z.enum(['Monthly', 'Quarterly', 'Annual', 'One-Time']),
  effective_from:      z.string().min(1),
  effective_to:        z.string().optional(),
  payment_frequency:   z.string().optional(),
  payment_mode:        z.string().optional(),
  total_budget_allocated: z.number().positive().optional(),
  currency:            z.string().optional().default('JMD'),
})

export const updateProgrammeSchema = createProgrammeSchema.partial()

// ─── Auth ────────────────────────────────────────────────────────────────────
const auth = requireAuth()

// ─── Endpoints ───────────────────────────────────────────────────────────────
const list = {
  path:       '/',
  verb:       'GET',
  handler:    { controller: ProgrammeController, method: 'list' },
  middleware: [auth],
  permissionsAnyOf: ['ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.PROGRAMMES.VIEW'],
}

const get = {
  path:       '/:id',
  verb:       'GET',
  handler:    { controller: ProgrammeController, method: 'get' },
  middleware: [auth],
  permissionsAnyOf: ['ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.PROGRAMMES.VIEW'],
}

const create = {
  path:       '/',
  verb:       'POST',
  handler:    { controller: ProgrammeController, method: 'create' },
  middleware: [auth],
  permissionsAnyOf: ['ADMIN.PROGRAMMES.CREATE', 'PROGRAMME.PROGRAMMES.CREATE'],
  validation: { body: createProgrammeSchema },
}

const update = {
  path:       '/:id',
  verb:       'PATCH',
  handler:    { controller: ProgrammeController, method: 'update' },
  middleware: [auth],
  permissionsAnyOf: ['ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.PROGRAMMES.EDIT'],
  validation: { body: updateProgrammeSchema },
}

const updateRulesTree = {
  path:       '/:id/rules-tree',
  verb:       'PATCH',
  handler:    { controller: ProgrammeController, method: 'updateRulesTree' },
  middleware: [auth],
  permissionsAnyOf: ['ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.PROGRAMMES.EDIT'],
}

const activate = {
  path:       '/:id/activate',
  verb:       'PATCH',
  handler:    { controller: ProgrammeController, method: 'activate' },
  middleware: [auth],
  permissionsAnyOf: ['ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.PROGRAMMES.PUBLISH'],
}

const deleteProgramme = {
  path:       '/:id',
  verb:       'DELETE',
  handler:    { controller: ProgrammeController, method: 'delete' },
  middleware: [auth],
  permissionsAnyOf: ['ADMIN.PROGRAMMES.ARCHIVE', 'PROGRAMME.PROGRAMMES.DELETE'],
}

export const ProgrammeApi = new ApiSchema({
  name:      'Programme',
  url:       '/api/v1/programmes',
  endpoints: [list, get, create, update, updateRulesTree, activate, deleteProgramme],
})
