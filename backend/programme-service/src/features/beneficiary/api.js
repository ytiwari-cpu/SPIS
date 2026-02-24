import { ApiSchema } from '../../../../base/apiSchema.js'
import { BeneficiaryController } from './beneficiaryController.js'
import { requireAuth, requirePermission } from '../../middleware/requireAuth.js'

// Citizens need to view their own enrolments — include CITIZEN.PROGRAMMES.VIEW
const listBySubject = {
  path:       '/subject/:subjectId',
  verb:       'GET',
  handler:    { controller: BeneficiaryController, method: 'listBySubject' },
  middleware: [requireAuth, requirePermission('ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.BENEFICIARIES.VIEW', 'CITIZEN.PROGRAMMES.VIEW')],
}

const listByProgramme = {
  path:       '/:programmeId',
  verb:       'GET',
  handler:    { controller: BeneficiaryController, method: 'listByProgramme' },
  middleware: [requireAuth, requirePermission('ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.BENEFICIARIES.VIEW')],
}

const enroll = {
  path:       '/:programmeId',
  verb:       'POST',
  handler:    { controller: BeneficiaryController, method: 'enroll' },
  middleware: [requireAuth, requirePermission('ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.BENEFICIARIES.ENROLL')],
}

const updateStatus = {
  path:       '/:programmeId/:subjectId/status',
  verb:       'PATCH',
  handler:    { controller: BeneficiaryController, method: 'updateStatus' },
  middleware: [requireAuth, requirePermission('ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.BENEFICIARIES.MANAGE')],
}

export const BeneficiaryApi = new ApiSchema({
  name:      'Beneficiary',
  url:       '/api/v1/beneficiaries',
  endpoints: [listBySubject, listByProgramme, enroll, updateStatus],
})
