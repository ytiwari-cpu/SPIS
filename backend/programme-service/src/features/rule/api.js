import { ApiSchema } from '../../../../base/apiSchema.js'
import { RuleController } from './ruleController.js'
import { requireAuth, requirePermission } from '../../middleware/requireAuth.js'

const listRules = {
  path:       '/',
  verb:       'GET',
  handler:    { controller: RuleController, method: 'listRules' },
  middleware: [requireAuth, requirePermission('ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.RULES.VIEW')],
}

const createRule = {
  path:       '/',
  verb:       'POST',
  handler:    { controller: RuleController, method: 'createRule' },
  middleware: [requireAuth, requirePermission('ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.RULES.MANAGE')],
}

const listProgrammeRules = {
  path:       '/programme/:programmeId',
  verb:       'GET',
  handler:    { controller: RuleController, method: 'listProgrammeRules' },
  middleware: [requireAuth, requirePermission('ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.RULES.VIEW')],
}

const addProgrammeRule = {
  path:       '/programme/:programmeId',
  verb:       'POST',
  handler:    { controller: RuleController, method: 'addProgrammeRule' },
  middleware: [requireAuth, requirePermission('ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.RULES.MANAGE')],
}

const removeProgrammeRule = {
  path:       '/programme/:programmeId/:ruleId',
  verb:       'DELETE',
  handler:    { controller: RuleController, method: 'removeProgrammeRule' },
  middleware: [requireAuth, requirePermission('ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.RULES.MANAGE')],
}

const listVersions = {
  path:       '/versions',
  verb:       'GET',
  handler:    { controller: RuleController, method: 'listVersions' },
  middleware: [requireAuth, requirePermission('ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.RULES.VIEW')],
}

const createVersion = {
  path:       '/versions',
  verb:       'POST',
  handler:    { controller: RuleController, method: 'createVersion' },
  middleware: [requireAuth, requirePermission('ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.RULES.MANAGE')],
}

export const RuleApi = new ApiSchema({
  name:      'Rule',
  url:       '/api/v1/rules',
  endpoints: [listRules, createRule, listProgrammeRules, addProgrammeRule, removeProgrammeRule, listVersions, createVersion],
})
