import { z } from 'zod'
import { ApiSchema } from '../../../../base/apiSchema.js'
import { BeneficiaryController } from './beneficiaryController.js'
import { requireAuth } from '../../../../base/middleware/requireAuth.js'

const auth = requireAuth()

// ─── Endpoints ───────────────────────────────────────────────────────────────
const listBySubject = {
  path:       '/subject/:subjectId',
  verb:       'GET',
  handler:    { controller: BeneficiaryController, method: 'listBySubject', arguments: ['request:params'] },
  middleware: [auth],
  permission: { anyOf: ['ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.BENEFICIARIES.VIEW', 'CITIZEN.PROGRAMMES.VIEW'] },
}

const listByProgramme = {
  path:       '/:programmeId',
  verb:       'GET',
  handler:    { controller: BeneficiaryController, method: 'listByProgramme', arguments: ['request:params'] },
  middleware: [auth],
  permission: { anyOf: ['ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.BENEFICIARIES.VIEW'] },
}

const enroll = {
  path:       '/:programmeId',
  verb:       'POST',
  handler:    { controller: BeneficiaryController, method: 'enroll', arguments: ['request:params', 'request:body'] },
  middleware: [auth],
  permission: { anyOf: ['ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.BENEFICIARIES.ENROLL'] },
  request:    {
    body: z.object({
      subject_type: z.enum(['Individual', 'Family']),
      subject_id:   z.string().uuid(),
      active_from:  z.string().max(30).optional(),
      active_till:  z.string().max(30).optional(),
    }),
  },
}

const updateStatus = {
  path:       '/:programmeId/:subjectId/status',
  verb:       'PATCH',
  handler:    { controller: BeneficiaryController, method: 'updateStatus', arguments: ['request:params', 'request:body'] },
  middleware: [auth],
  permission: { anyOf: ['ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.BENEFICIARIES.MANAGE'] },
  request:    {
    body: z.object({
      status:      z.enum(['Active', 'Suspended', 'Exited', 'Pending']),
      exit_reason: z.string().max(1000).optional(),
      remarks:     z.string().max(2000).optional(),
    }),
  },
}

export const BeneficiaryApi = new ApiSchema({
  name:      'Beneficiary',
  url:       '/api/v1/beneficiaries',
  endpoints: [listBySubject, listByProgramme, enroll, updateStatus],
})
