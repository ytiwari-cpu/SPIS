import { z } from 'zod'
import { ApiSchema } from '../../../../../base/apiSchema.js'
import { RuleController } from './ruleController.js'
import { requireAuth } from '../../../../../base/middleware/requireAuth.js'

// ─── Inline Zod Schemas ─────────────────────────────────────────────────────
export const addProgrammeRuleSchema = z.object({
  rule_type:       z.enum(['variable', 'group']),
  rule_code:       z.string().optional(),
  variable_code:   z.string().optional(),
  rule_group_id:   z.string().uuid().optional(),
  operator:        z.enum(['==', '!=', '>', '<', '>=', '<=', 'IN', 'NOT IN', 'BETWEEN']).optional(),
  threshold_value: z.string().optional(),
  weight:          z.number().optional().default(0),
  mandatory_flag:  z.boolean().optional().default(false),
  rule_version:    z.string().optional(),
})

export const createRuleVersionSchema = z.object({
  rule_version:   z.string().min(1).max(20),
  description:    z.string().optional(),
  effective_from: z.string().optional(),
  effective_to:   z.string().optional(),
})

// ─── Auth ────────────────────────────────────────────────────────────────────
const auth = requireAuth()

// ─── Endpoints ───────────────────────────────────────────────────────────────
const listRules = {
  path:       '/',
  verb:       'GET',
  handler:    { controller: RuleController, method: 'listRules' },
  middleware: [auth],
  permissionsAnyOf: ['ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.RULES.VIEW'],
}

const createRule = {
  path:       '/',
  verb:       'POST',
  handler:    { controller: RuleController, method: 'createRule' },
  middleware: [auth],
  permissionsAnyOf: ['ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.RULES.MANAGE'],
}

const listProgrammeRules = {
  path:       '/programme/:programmeId',
  verb:       'GET',
  handler:    { controller: RuleController, method: 'listProgrammeRules' },
  middleware: [auth],
  permissionsAnyOf: ['ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.RULES.VIEW'],
}

const addProgrammeRule = {
  path:       '/programme/:programmeId',
  verb:       'POST',
  handler:    { controller: RuleController, method: 'addProgrammeRule' },
  middleware: [auth],
  permissionsAnyOf: ['ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.RULES.MANAGE'],
  validation: { body: addProgrammeRuleSchema },
}

const removeProgrammeRule = {
  path:       '/programme/:programmeId/:ruleId',
  verb:       'DELETE',
  handler:    { controller: RuleController, method: 'removeProgrammeRule' },
  middleware: [auth],
  permissionsAnyOf: ['ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.RULES.MANAGE'],
}

const listVersions = {
  path:       '/versions',
  verb:       'GET',
  handler:    { controller: RuleController, method: 'listVersions' },
  middleware: [auth],
  permissionsAnyOf: ['ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.RULES.VIEW'],
}

const createVersion = {
  path:       '/versions',
  verb:       'POST',
  handler:    { controller: RuleController, method: 'createVersion' },
  middleware: [auth],
  permissionsAnyOf: ['ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.RULES.MANAGE'],
  validation: { body: createRuleVersionSchema },
}

export const RuleApi = new ApiSchema({
  name:      'Rule',
  url:       '/api/v1/rules',
  endpoints: [listRules, createRule, listProgrammeRules, addProgrammeRule, removeProgrammeRule, listVersions, createVersion],
})
