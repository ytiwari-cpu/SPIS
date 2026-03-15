import { z } from 'zod'
import { ApiSchema } from '../../../../base/apiSchema.js'
import { RuleGroupController } from './ruleGroupController.js'
import { requireAuth } from '../../../../base/middleware/requireAuth.js'

const auth = requireAuth()

const OperatorSchema  = z.enum(['==', '!=', '>', '<', '>=', '<=', 'IN', 'NOT IN', 'BETWEEN'])
const IdParams        = z.object({ id: z.string().uuid() })

// ─── Endpoints ───────────────────────────────────────────────────────────────
const list = {
  path:       '/',
  verb:       'GET',
  handler:    { controller: RuleGroupController, method: 'list', arguments: [] },
  middleware: [auth],
  permission: { anyOf: ['ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.RULES.VIEW'] },
}

const get = {
  path:       '/:id',
  verb:       'GET',
  handler:    { controller: RuleGroupController, method: 'get', arguments: ['request:params'] },
  middleware: [auth],
  permission: { anyOf: ['ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.RULES.VIEW'] },
  request:    { params: IdParams },
}

const create = {
  path:       '/',
  verb:       'POST',
  handler:    { controller: RuleGroupController, method: 'create', arguments: ['request:body'] },
  middleware: [auth],
  permission: { anyOf: ['ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.RULES.MANAGE'] },
  request:    {
    body: z.object({
      group_code:     z.string().min(1).max(50),
      group_name:     z.string().min(1).max(255),
      description:    z.string().max(2000).optional(),
      scoring_method: z.enum(['weighted_sum', 'average', 'min', 'max']).optional().default('weighted_sum'),
    }),
  },
}

const update = {
  path:       '/:id',
  verb:       'PATCH',
  handler:    { controller: RuleGroupController, method: 'update', arguments: ['request:params', 'request:body'] },
  middleware: [auth],
  permission: { anyOf: ['ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.RULES.MANAGE'] },
  request:    {
    params: IdParams,
    body:   z.object({
      group_code:     z.string().min(1).max(50).optional(),
      group_name:     z.string().min(1).max(255).optional(),
      description:    z.string().max(2000).optional(),
      scoring_method: z.enum(['weighted_sum', 'average', 'min', 'max']).optional(),
    }),
  },
}

const deleteGroup = {
  path:       '/:id',
  verb:       'DELETE',
  handler:    { controller: RuleGroupController, method: 'delete', arguments: ['request:params'] },
  middleware: [auth],
  permission: { anyOf: ['ADMIN.PROGRAMMES.ARCHIVE', 'PROGRAMME.RULES.MANAGE'] },
  request:    { params: IdParams },
}

const addSubRule = {
  path:       '/:id/rules',
  verb:       'POST',
  handler:    { controller: RuleGroupController, method: 'addSubRule', arguments: ['request:params', 'request:body'] },
  middleware: [auth],
  permission: { anyOf: ['ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.RULES.MANAGE'] },
  request:    {
    params: IdParams,
    body:   z.object({
      variable_code:   z.string().min(1).max(100),
      operator:        OperatorSchema,
      threshold_value: z.string().min(1).max(500),
      weight:          z.number().optional().default(1.0),
      mandatory_flag:  z.boolean().optional().default(false),
    }),
  },
}

const removeSubRule = {
  path:       '/:groupId/rules/:ruleId',
  verb:       'DELETE',
  handler:    { controller: RuleGroupController, method: 'removeSubRule', arguments: ['request:params'] },
  middleware: [auth],
  permission: { anyOf: ['ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.RULES.MANAGE'] },
  request:    { params: z.object({ groupId: z.string().uuid(), ruleId: z.string().uuid() }) },
}

export const RuleGroupApi = new ApiSchema({
  name:      'RuleGroup',
  url:       '/api/v1/rule-groups',
  endpoints: [list, get, create, update, deleteGroup, addSubRule, removeSubRule],
})
