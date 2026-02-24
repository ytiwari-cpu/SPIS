import { ApiSchema } from '../../../../base/apiSchema.js'
import { AuditController } from './auditController.js'
import { requireAuth, requirePermission } from '../../middleware/requireAuth.js'

const programmeHistory = {
  path:       '/programme/:programmeId',
  verb:       'GET',
  handler:    { controller: AuditController, method: 'programmeHistory' },
  middleware: [requireAuth, requirePermission('ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.AUDITLOGS.VIEW')],
}

const rulesHistory = {
  path:       '/rules/:programmeId',
  verb:       'GET',
  handler:    { controller: AuditController, method: 'rulesHistory' },
  middleware: [requireAuth, requirePermission('ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.AUDITLOGS.VIEW')],
}

const exitsHistory = {
  path:       '/exits/:programmeId',
  verb:       'GET',
  handler:    { controller: AuditController, method: 'exitsHistory' },
  middleware: [requireAuth, requirePermission('ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.AUDITLOGS.VIEW')],
}

const allHistory = {
  path:       '/all',
  verb:       'GET',
  handler:    { controller: AuditController, method: 'allHistory' },
  middleware: [requireAuth, requirePermission('ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.AUDITLOGS.VIEW')],
}

export const AuditApi = new ApiSchema({
  name:      'Audit',
  url:       '/api/v1/audit',
  endpoints: [programmeHistory, rulesHistory, exitsHistory, allHistory],
})
