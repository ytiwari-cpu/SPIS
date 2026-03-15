import { z } from 'zod'
import { ApiSchema } from '../../../../base/apiSchema.js'
import { ProgrammeController } from './programmeController.js'
import { requireAuth } from '../../../../base/middleware/requireAuth.js'

const auth = requireAuth()

const IdParams = z.object({ id: z.string().uuid() })

// ─── Endpoints ───────────────────────────────────────────────────────────────
const list = {
  path:       '/',
  verb:       'GET',
  handler:    { controller: ProgrammeController, method: 'list', arguments: [] },
  middleware: [auth],
  permission: { anyOf: ['ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.PROGRAMMES.VIEW'] },
  // response:   z.object({ success: z.boolean(), data: z.array(z.any()) }),
}

const get = {
  path:       '/:id',
  verb:       'GET',
  handler:    { controller: ProgrammeController, method: 'get', arguments: ['request:params'] },
  middleware: [auth],
  permission: { anyOf: ['ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.PROGRAMMES.VIEW'] },
  request:    { params: IdParams },
  response:   z.object({ success: z.boolean() }),
}

const create = {
  path:       '/',
  verb:       'POST',
  handler:    { controller: ProgrammeController, method: 'create', arguments: ['request:body'] },
  middleware: [auth],
  permission: { anyOf: ['ADMIN.PROGRAMMES.CREATE', 'PROGRAMME.PROGRAMMES.CREATE'] },
  request:    {
    body: z.object({
      programme_code:         z.string().min(1).max(50),
      programme_name:         z.string().min(1).max(255),
      description:            z.string().max(2000).optional(),
      ranking_required:       z.boolean().optional().default(false),
      quota_limit:            z.number().int().positive().optional(),
      benefit_type:           z.enum(['Cash', 'In-Kind', 'Hybrid', 'Service']),
      benefit_frequency:      z.enum(['Monthly', 'Quarterly', 'Annual', 'One-Time']),
      effective_from:         z.string().min(1).max(30),
      effective_to:           z.string().max(30).optional(),
      payment_frequency:      z.string().max(50).optional(),
      payment_mode:           z.string().max(50).optional(),
      total_budget_allocated: z.number().positive().optional(),
      currency:               z.string().max(10).optional().default('JMD'),
    }),
  },
  response: z.object({ success: z.boolean(), data: z.any() }),
}

const update = {
  path:       '/:id',
  verb:       'PATCH',
  handler:    { controller: ProgrammeController, method: 'update', arguments: ['request:params', 'request:body'] },
  middleware: [auth],
  permission: { anyOf: ['ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.PROGRAMMES.EDIT'] },
  request:    {
    params: IdParams,
    body:   z.object({
      programme_code:         z.string().min(1).max(50).optional(),
      programme_name:         z.string().min(1).max(255).optional(),
      description:            z.string().max(2000).optional(),
      ranking_required:       z.boolean().optional(),
      quota_limit:            z.number().int().positive().optional(),
      benefit_type:           z.enum(['Cash', 'In-Kind', 'Hybrid', 'Service']).optional(),
      benefit_frequency:      z.enum(['Monthly', 'Quarterly', 'Annual', 'One-Time']).optional(),
      effective_from:         z.string().min(1).max(30).optional(),
      effective_to:           z.string().max(30).optional(),
      payment_frequency:      z.string().max(50).optional(),
      payment_mode:           z.string().max(50).optional(),
      total_budget_allocated: z.number().positive().optional(),
      currency:               z.string().max(10).optional(),
    }),
  },
}

const updateRulesTree = {
  path:       '/:id/rules-tree',
  verb:       'PATCH',
  handler:    { controller: ProgrammeController, method: 'updateRulesTree', arguments: ['request:params', 'request:body'] },
  middleware: [auth],
  permission: { anyOf: ['ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.PROGRAMMES.EDIT'] },
  request:    {
    params: IdParams,
    body:   z.object({ rules_tree: z.any() }),
  },
}

const activate = {
  path:       '/:id/activate',
  verb:       'PATCH',
  handler:    { controller: ProgrammeController, method: 'activate', arguments: ['request:params'] },
  middleware: [auth],
  permission: { anyOf: ['ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.PROGRAMMES.PUBLISH'] },
  request:    { params: IdParams },
}

const deleteProgramme = {
  path:       '/:id',
  verb:       'DELETE',
  handler:    { controller: ProgrammeController, method: 'delete', arguments: ['request:params'] },
  middleware: [auth],
  permission: { anyOf: ['ADMIN.PROGRAMMES.ARCHIVE', 'PROGRAMME.PROGRAMMES.DELETE'] },
  request:    { params: IdParams },
  response:   z.object({ success: z.boolean(), message: z.string() }),
}

export const ProgrammeApi = new ApiSchema({
  name:      'Programme',
  url:       '/api/v1/programmes',
  endpoints: [list, get, create, update, updateRulesTree, activate, deleteProgramme],
})
