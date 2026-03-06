import { z } from 'zod'
import { ApiSchema } from '../../../../../base/apiSchema.js'
import { BeneficiaryController } from './beneficiaryController.js'
import { requireAuth } from '../../../../../base/middleware/requireAuth.js'

// ─── Inline Zod Schema ──────────────────────────────────────────────────────
export const enrollCitizenSchema = z.object({
  subject_type: z.enum(['Individual', 'Family']),
  subject_id:   z.string().uuid(),
  active_from:  z.string().optional(),
  active_till:  z.string().optional(),
})

// ─── Auth ────────────────────────────────────────────────────────────────────
const auth = requireAuth()

// ─── Endpoints ───────────────────────────────────────────────────────────────
// Citizens need to view their own enrolments — include CITIZEN.PROGRAMMES.VIEW
const listBySubject = {
  path:       '/subject/:subjectId',
  verb:       'GET',
  handler:    { controller: BeneficiaryController, method: 'listBySubject' },
  middleware: [auth],
  permissionsAnyOf: ['ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.BENEFICIARIES.VIEW', 'CITIZEN.PROGRAMMES.VIEW'],
}

const listByProgramme = {
  path:       '/:programmeId',
  verb:       'GET',
  handler:    { controller: BeneficiaryController, method: 'listByProgramme' },
  middleware: [auth],
  permissionsAnyOf: ['ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.BENEFICIARIES.VIEW'],
}

const enroll = {
  path:       '/:programmeId',
  verb:       'POST',
  handler:    { controller: BeneficiaryController, method: 'enroll' },
  middleware: [auth],
  permissionsAnyOf: ['ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.BENEFICIARIES.ENROLL'],
  validation: { body: enrollCitizenSchema },
}

const updateStatus = {
  path:       '/:programmeId/:subjectId/status',
  verb:       'PATCH',
  handler:    { controller: BeneficiaryController, method: 'updateStatus' },
  middleware: [auth],
  permissionsAnyOf: ['ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.BENEFICIARIES.MANAGE'],
}

export const BeneficiaryApi = new ApiSchema({
  name:      'Beneficiary',
  url:       '/api/v1/beneficiaries',
  endpoints: [listBySubject, listByProgramme, enroll, updateStatus],
})
