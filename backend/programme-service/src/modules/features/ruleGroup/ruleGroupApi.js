import { z } from 'zod'
import { ApiSchema } from '../../../../../base/apiSchema.js'
import { RuleGroupController } from './ruleGroupController.js'
import { requireAuth } from '../../../../../base/middleware/requireAuth.js'

// ─── Inline Zod Schemas ─────────────────────────────────────────────────────
export const createRuleGroupSchema = z.object({
  group_code:     z.string().min(1).max(50),
  group_name:     z.string().min(1).max(255),
  description:    z.string().optional(),
  scoring_method: z.enum(['weighted_sum', 'average', 'min', 'max']).optional().default('weighted_sum'),
})

export const updateRuleGroupSchema = createRuleGroupSchema.partial()

export const addRuleGroupRuleSchema = z.object({
  variable_code:   z.string().min(1),
  operator:        z.enum(['==', '!=', '>', '<', '>=', '<=', 'IN', 'NOT IN', 'BETWEEN']),
  threshold_value: z.string().min(1),
  weight:          z.number().optional().default(1.0),
  mandatory_flag:  z.boolean().optional().default(false),
})

// ─── Auth ────────────────────────────────────────────────────────────────────
const auth = requireAuth()

// ─── Endpoints ───────────────────────────────────────────────────────────────
const list = {
  path:       '/',
  verb:       'GET',
  handler:    { controller: RuleGroupController, method: 'list' },
  middleware: [auth],
  permissionsAnyOf: ['ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.RULES.VIEW'],
}

const get = {
  path:       '/:id',
  verb:       'GET',
  handler:    { controller: RuleGroupController, method: 'get' },
  middleware: [auth],
  permissionsAnyOf: ['ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.RULES.VIEW'],
}

const create = {
  path:       '/',
  verb:       'POST',
  handler:    { controller: RuleGroupController, method: 'create' },
  middleware: [auth],
  permissionsAnyOf: ['ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.RULES.MANAGE'],
  validation: { body: createRuleGroupSchema },
}

const update = {
  path:       '/:id',
  verb:       'PATCH',
  handler:    { controller: RuleGroupController, method: 'update' },
  middleware: [auth],
  permissionsAnyOf: ['ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.RULES.MANAGE'],
  validation: { body: updateRuleGroupSchema },
}

const deleteGroup = {
  path:       '/:id',
  verb:       'DELETE',
  handler:    { controller: RuleGroupController, method: 'delete' },
  middleware: [auth],
  permissionsAnyOf: ['ADMIN.PROGRAMMES.ARCHIVE', 'PROGRAMME.RULES.MANAGE'],
}

const addSubRule = {
  path:       '/:id/rules',
  verb:       'POST',
  handler:    { controller: RuleGroupController, method: 'addSubRule' },
  middleware: [auth],
  permissionsAnyOf: ['ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.RULES.MANAGE'],
  validation: { body: addRuleGroupRuleSchema },
}

const removeSubRule = {
  path:       '/:groupId/rules/:ruleId',
  verb:       'DELETE',
  handler:    { controller: RuleGroupController, method: 'removeSubRule' },
  middleware: [auth],
  permissionsAnyOf: ['ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.RULES.MANAGE'],
}

export const RuleGroupApi = new ApiSchema({
  name:      'RuleGroup',
  url:       '/api/v1/rule-groups',
  endpoints: [list, get, create, update, deleteGroup, addSubRule, removeSubRule],
})
