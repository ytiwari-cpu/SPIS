import { z } from 'zod'
import { ApiSchema } from '../../../../base/apiSchema.js'
import { RuleController } from './ruleController.js'
import { requireAuth } from '../../../../base/middleware/requireAuth.js'

const auth = requireAuth()

const OperatorSchema    = z.enum(['==', '!=', '>', '<', '>=', '<=', 'IN', 'NOT IN', 'BETWEEN'])
const ProgrammeIdParams = z.object({ programmeId: z.string().uuid() })

// ─── Endpoints ───────────────────────────────────────────────────────────────
const listRules = {
  path:       '/',
  verb:       'GET',
  handler:    { controller: RuleController, method: 'listRules', arguments: [] },
  middleware: [auth],
  permission: { anyOf: ['ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.RULES.VIEW'] },
}

const createRule = {
  path:       '/',
  verb:       'POST',
  handler:    { controller: RuleController, method: 'createRule', arguments: ['request:body'] },
  middleware: [auth],
  permission: { anyOf: ['ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.RULES.MANAGE'] },
  request:    {
    body: z.object({
      rule_code:       z.string().min(1).max(50),
      rule_name:       z.string().min(1).max(255).optional(),
      description:     z.string().max(2000).optional(),
      variable_code:   z.string().max(100).optional(),
      operator:        OperatorSchema.optional(),
      threshold_value: z.string().max(500).optional(),
      rule_version:    z.string().max(20).optional(),
    }),
  },
}

const listProgrammeRules = {
  path:       '/programme/:programmeId',
  verb:       'GET',
  handler:    { controller: RuleController, method: 'listProgrammeRules', arguments: ['request:params'] },
  middleware: [auth],
  permission: { anyOf: ['ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.RULES.VIEW'] },
  request:    { params: ProgrammeIdParams },
}

const addProgrammeRule = {
  path:       '/programme/:programmeId',
  verb:       'POST',
  handler:    { controller: RuleController, method: 'addProgrammeRule', arguments: ['request:params', 'request:body'] },
  middleware: [auth],
  permission: { anyOf: ['ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.RULES.MANAGE'] },
  request:    {
    params: ProgrammeIdParams,
    body:   z.object({
      rule_type:       z.enum(['variable', 'group']),
      rule_code:       z.string().max(50).optional(),
      variable_code:   z.string().max(100).optional(),
      rule_group_id:   z.string().uuid().optional(),
      operator:        OperatorSchema.optional(),
      threshold_value: z.string().max(500).optional(),
      weight:          z.number().optional().default(0),
      mandatory_flag:  z.boolean().optional().default(false),
      rule_version:    z.string().max(20).optional(),
    }),
  },
}

const removeProgrammeRule = {
  path:       '/programme/:programmeId/:ruleId',
  verb:       'DELETE',
  handler:    { controller: RuleController, method: 'removeProgrammeRule', arguments: ['request:params'] },
  middleware: [auth],
  permission: { anyOf: ['ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.RULES.MANAGE'] },
  request:    { params: z.object({ programmeId: z.string().uuid(), ruleId: z.string().uuid() }) },
}

const listVersions = {
  path:       '/versions',
  verb:       'GET',
  handler:    { controller: RuleController, method: 'listVersions', arguments: [] },
  middleware: [auth],
  permission: { anyOf: ['ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.RULES.VIEW'] },
}

const createVersion = {
  path:       '/versions',
  verb:       'POST',
  handler:    { controller: RuleController, method: 'createVersion', arguments: ['request:body'] },
  middleware: [auth],
  permission: { anyOf: ['ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.RULES.MANAGE'] },
  request:    {
    body: z.object({
      rule_version:   z.string().min(1).max(20),
      description:    z.string().max(2000).optional(),
      effective_from: z.string().max(30).optional(),
      effective_to:   z.string().max(30).optional(),
    }),
  },
}

export const RuleApi = new ApiSchema({
  name:      'Rule',
  url:       '/api/v1/rules',
  endpoints: [
    listRules, createRule, listProgrammeRules, addProgrammeRule,
    removeProgrammeRule, listVersions, createVersion,
  ],
})
