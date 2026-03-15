import { z } from 'zod'
import { ApiSchema } from '../../../../base/apiSchema.js'
import { ProgrammeManagerController } from './programmeManagerController.js'
import { requireAuth } from '../../../../base/middleware/requireAuth.js'

const auth = requireAuth()

const ProgrammeIdParams = z.object({ programmeId: z.string().uuid() })

// ─── Endpoints ───────────────────────────────────────────────────────────────
const listFromIAM = {
  path:       '/',
  verb:       'GET',
  handler:    { controller: ProgrammeManagerController, method: 'listFromIAM', arguments: [] },
  middleware: [auth],
  permission: { anyOf: ['ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.MANAGERS.VIEW'] },
}

const listByProgramme = {
  path:       '/programme/:programmeId',
  verb:       'GET',
  handler:    { controller: ProgrammeManagerController, method: 'listByProgramme', arguments: ['request:params'] },
  middleware: [auth],
  permission: { anyOf: ['ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.MANAGERS.VIEW'] },
  request:    { params: ProgrammeIdParams },
}

const add = {
  path:       '/programme/:programmeId',
  verb:       'POST',
  handler:    { controller: ProgrammeManagerController, method: 'add', arguments: ['request:params', 'request:body'] },
  middleware: [auth],
  permission: { anyOf: ['ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.MANAGERS.MANAGE'] },
  request:    {
    params: ProgrammeIdParams,
    body:   z.object({ user_id: z.string().uuid() }),
  },
}

const remove = {
  path:       '/programme/:programmeId/:userId',
  verb:       'DELETE',
  handler:    { controller: ProgrammeManagerController, method: 'remove', arguments: ['request:params'] },
  middleware: [auth],
  permission: { anyOf: ['ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.MANAGERS.MANAGE'] },
  request:    { params: z.object({ programmeId: z.string().uuid(), userId: z.string().uuid() }) },
}

export const ProgrammeManagerApi = new ApiSchema({
  name:      'ProgrammeManager',
  url:       '/api/v1/programme-managers',
  endpoints: [listFromIAM, listByProgramme, add, remove],
})
