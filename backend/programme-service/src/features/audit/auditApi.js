import { z } from 'zod'
import { ApiSchema } from '../../../../base/apiSchema.js'
import { AuditController } from './auditController.js'
import { requireAuth } from '../../../../base/middleware/requireAuth.js'

const auth = requireAuth()

const ProgrammeIdParams = z.object({ programmeId: z.string().uuid() })

const programmeHistory = {
  path:       '/programme/:programmeId',
  verb:       'GET',
  handler:    { controller: AuditController, method: 'programmeHistory', arguments: ['request:params'] },
  middleware: [auth],
  permission: { anyOf: ['ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.AUDITLOGS.VIEW'] },
  request:    { params: ProgrammeIdParams },
}

const rulesHistory = {
  path:       '/rules/:programmeId',
  verb:       'GET',
  handler:    { controller: AuditController, method: 'rulesHistory', arguments: ['request:params'] },
  middleware: [auth],
  permission: { anyOf: ['ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.AUDITLOGS.VIEW'] },
  request:    { params: ProgrammeIdParams },
}

const exitsHistory = {
  path:       '/exits/:programmeId',
  verb:       'GET',
  handler:    { controller: AuditController, method: 'exitsHistory', arguments: ['request:params'] },
  middleware: [auth],
  permission: { anyOf: ['ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.AUDITLOGS.VIEW'] },
  request:    { params: ProgrammeIdParams },
}

const allHistory = {
  path:       '/all',
  verb:       'GET',
  handler:    { controller: AuditController, method: 'allHistory', arguments: [] },
  middleware: [auth],
  permission: { anyOf: ['ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.AUDITLOGS.VIEW'] },
}

export const AuditApi = new ApiSchema({
  name:      'Audit',
  url:       '/api/v1/audit',
  endpoints: [programmeHistory, rulesHistory, exitsHistory, allHistory],
})
