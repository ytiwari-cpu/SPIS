import { ApiSchema } from '../../../../base/apiSchema.js'
import { ProgrammeManagerController } from './programmeManagerController.js'
import { requireAuth, requirePermission } from '../../middleware/requireAuth.js'

const listFromIAM = {
  path:       '/',
  verb:       'GET',
  handler:    { controller: ProgrammeManagerController, method: 'listFromIAM' },
  middleware: [requireAuth, requirePermission('ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.MANAGERS.VIEW')],
}

const listByProgramme = {
  path:       '/programme/:programmeId',
  verb:       'GET',
  handler:    { controller: ProgrammeManagerController, method: 'listByProgramme' },
  middleware: [requireAuth, requirePermission('ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.MANAGERS.VIEW')],
}

const add = {
  path:       '/programme/:programmeId',
  verb:       'POST',
  handler:    { controller: ProgrammeManagerController, method: 'add' },
  middleware: [requireAuth, requirePermission('ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.MANAGERS.MANAGE')],
}

const remove = {
  path:       '/programme/:programmeId/:userId',
  verb:       'DELETE',
  handler:    { controller: ProgrammeManagerController, method: 'remove' },
  middleware: [requireAuth, requirePermission('ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.MANAGERS.MANAGE')],
}

export const ProgrammeManagerApi = new ApiSchema({
  name:      'ProgrammeManager',
  url:       '/api/v1/programme-managers',
  endpoints: [listFromIAM, listByProgramme, add, remove],
})
