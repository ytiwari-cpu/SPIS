import { ApiSchema } from '../../../../base/apiSchema.js'
import { ProgrammeController } from './programmeController.js'
import { requireAuth, requirePermission } from '../../middleware/requireAuth.js'

const list = {
  path:       '/',
  verb:       'GET',
  handler:    { controller: ProgrammeController, method: 'list' },
  middleware: [requireAuth, requirePermission('ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.PROGRAMMES.VIEW')],
}

const get = {
  path:       '/:id',
  verb:       'GET',
  handler:    { controller: ProgrammeController, method: 'get' },
  middleware: [requireAuth, requirePermission('ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.PROGRAMMES.VIEW')],
}

const create = {
  path:       '/',
  verb:       'POST',
  handler:    { controller: ProgrammeController, method: 'create' },
  middleware: [requireAuth, requirePermission('ADMIN.PROGRAMMES.CREATE', 'PROGRAMME.PROGRAMMES.CREATE')],
}

const update = {
  path:       '/:id',
  verb:       'PATCH',
  handler:    { controller: ProgrammeController, method: 'update' },
  middleware: [requireAuth, requirePermission('ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.PROGRAMMES.EDIT')],
}

const updateRulesTree = {
  path:       '/:id/rules-tree',
  verb:       'PATCH',
  handler:    { controller: ProgrammeController, method: 'updateRulesTree' },
  middleware: [requireAuth, requirePermission('ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.PROGRAMMES.EDIT')],
}

const activate = {
  path:       '/:id/activate',
  verb:       'PATCH',
  handler:    { controller: ProgrammeController, method: 'activate' },
  middleware: [requireAuth, requirePermission('ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.PROGRAMMES.PUBLISH')],
}

const deleteProgramme = {
  path:       '/:id',
  verb:       'DELETE',
  handler:    { controller: ProgrammeController, method: 'delete' },
  middleware: [requireAuth, requirePermission('ADMIN.PROGRAMMES.ARCHIVE', 'PROGRAMME.PROGRAMMES.DELETE')],
}

export const ProgrammeApi = new ApiSchema({
  name:      'Programme',
  url:       '/api/v1/programmes',
  endpoints: [list, get, create, update, updateRulesTree, activate, deleteProgramme],
})
