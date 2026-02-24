import { ApiSchema } from '../../../../base/apiSchema.js'
import { VariableController } from './variableController.js'
import { requireAuth, requirePermission } from '../../middleware/requireAuth.js'

const list = {
  path:       '/',
  verb:       'GET',
  handler:    { controller: VariableController, method: 'list' },
  middleware: [requireAuth, requirePermission('ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.RULES.VIEW')],
}

const listGrouped = {
  path:       '/grouped',
  verb:       'GET',
  handler:    { controller: VariableController, method: 'listGrouped' },
  middleware: [requireAuth, requirePermission('ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.RULES.VIEW')],
}

const refresh = {
  path:       '/refresh',
  verb:       'POST',
  handler:    { controller: VariableController, method: 'refresh' },
  middleware: [requireAuth, requirePermission('ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.RULES.MANAGE')],
}

export const VariableApi = new ApiSchema({
  name:      'Variable',
  url:       '/api/v1/variables',
  endpoints: [list, listGrouped, refresh],
})
