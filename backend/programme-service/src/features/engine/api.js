import { ApiSchema } from '../../../../base/apiSchema.js'
import { EngineController } from './engineController.js'
import { requireAuth, requirePermission } from '../../middleware/requireAuth.js'

const evaluate = {
  path:       '/evaluate/:programmeId',
  verb:       'POST',
  handler:    { controller: EngineController, method: 'evaluate' },
  middleware: [requireAuth, requirePermission('ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.ENGINE.RUN')],
}

const evaluateAll = {
  path:       '/evaluate-all/:programmeId',
  verb:       'POST',
  handler:    { controller: EngineController, method: 'evaluateAll' },
  middleware: [requireAuth, requirePermission('ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.ENGINE.RUN')],
}

const impact = {
  path:       '/impact/:programmeId',
  verb:       'GET',
  handler:    { controller: EngineController, method: 'impact' },
  middleware: [requireAuth, requirePermission('ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.ENGINE.RUN')],
}

export const EngineApi = new ApiSchema({
  name:      'Engine',
  url:       '/api/v1/engine',
  endpoints: [evaluate, evaluateAll, impact],
})
