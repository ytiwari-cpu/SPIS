import { ApiSchema } from '../../../../../base/apiSchema.js'
import { VariableController } from './variableController.js'
import { requireAuth } from '../../../../../base/middleware/requireAuth.js'

const auth = requireAuth()

const list = {
  path:       '/',
  verb:       'GET',
  handler:    { controller: VariableController, method: 'list' },
  middleware: [auth],
  permissionsAnyOf: ['ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.RULES.VIEW'],
}

const listGrouped = {
  path:       '/grouped',
  verb:       'GET',
  handler:    { controller: VariableController, method: 'listGrouped' },
  middleware: [auth],
  permissionsAnyOf: ['ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.RULES.VIEW'],
}

const refresh = {
  path:       '/refresh',
  verb:       'POST',
  handler:    { controller: VariableController, method: 'refresh' },
  middleware: [auth],
  permissionsAnyOf: ['ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.RULES.MANAGE'],
}

export const VariableApi = new ApiSchema({
  name:      'Variable',
  url:       '/api/v1/variables',
  endpoints: [list, listGrouped, refresh],
})
