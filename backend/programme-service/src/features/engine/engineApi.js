import { ApiSchema } from '../../../../base/apiSchema.js'
import { EngineController } from './engineController.js'
import { requireAuth } from '../../../../base/middleware/requireAuth.js'

const auth = requireAuth()

const evaluate = {
  path:       '/evaluate/:programmeId',
  verb:       'POST',
  handler:    { controller: EngineController, method: 'evaluate', arguments: ['request:params', 'request:body'] },
  middleware: [auth],
  permission: { anyOf: ['ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.ENGINE.RUN'] },
}

const evaluateAll = {
  path:       '/evaluate-all/:programmeId',
  verb:       'POST',
  handler:    { controller: EngineController, method: 'evaluateAll', arguments: ['request:params'] },
  middleware: [auth],
  permission: { anyOf: ['ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.ENGINE.RUN'] },
}

const impact = {
  path:       '/impact/:programmeId',
  verb:       'GET',
  handler:    { controller: EngineController, method: 'impact', arguments: ['request:params'] },
  middleware: [auth],
  permission: { anyOf: ['ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.ENGINE.RUN'] },
}

export const EngineApi = new ApiSchema({
  name:      'Engine',
  url:       '/api/v1/engine',
  endpoints: [evaluate, evaluateAll, impact],
})
