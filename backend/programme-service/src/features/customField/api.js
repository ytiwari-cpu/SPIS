import { ApiSchema } from '../../../../base/apiSchema.js'
import { CustomFieldController } from './customFieldController.js'
import { requireAuth, requirePermission } from '../../middleware/requireAuth.js'

const list = {
  path:       '/',
  verb:       'GET',
  handler:    { controller: CustomFieldController, method: 'list' },
  middleware: [requireAuth, requirePermission('ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.RULES.VIEW')],
}

const listByTable = {
  path:       '/table/:table',
  verb:       'GET',
  handler:    { controller: CustomFieldController, method: 'listByTable' },
  middleware: [requireAuth, requirePermission('ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.RULES.VIEW')],
}

const create = {
  path:       '/',
  verb:       'POST',
  handler:    { controller: CustomFieldController, method: 'create' },
  middleware: [requireAuth, requirePermission('ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.RULES.MANAGE')],
}

const update = {
  path:       '/:id',
  verb:       'PATCH',
  handler:    { controller: CustomFieldController, method: 'update' },
  middleware: [requireAuth, requirePermission('ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.RULES.MANAGE')],
}

const deleteField = {
  path:       '/:id',
  verb:       'DELETE',
  handler:    { controller: CustomFieldController, method: 'delete' },
  middleware: [requireAuth, requirePermission('ADMIN.PROGRAMMES.ARCHIVE', 'PROGRAMME.RULES.MANAGE')],
}

export const CustomFieldApi = new ApiSchema({
  name:      'CustomField',
  url:       '/api/v1/custom-fields',
  endpoints: [list, listByTable, create, update, deleteField],
})
