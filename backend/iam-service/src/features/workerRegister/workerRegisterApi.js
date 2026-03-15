/**
 * IAM — Worker Register API
 *
 * Routes:
 *   POST /iam/worker-register        — initiate worker self-registration
 *   POST /iam/worker-register/verify — verify OTP + set password
 */

import { ApiSchema } from '../../../../base/apiSchema.js'
import { WorkerRegisterController } from './workerRegisterController.js'

const register = {
  path:    '/worker-register',
  verb:    'POST',
  handler: { controller: WorkerRegisterController, method: 'register', arguments: ['request:body'] },
}

const verify = {
  path:    '/worker-register/verify',
  verb:    'POST',
  handler: { controller: WorkerRegisterController, method: 'verify', arguments: ['request:body'] },
}

export const WorkerRegisterApi = new ApiSchema({
  name:      'WorkerRegister',
  url:       '/iam',
  endpoints: [register, verify],
})
