/**
 * IAM — Health API
 *
 * Routes:
 *   GET /healthz — liveness probe
 *   GET /readyz  — readiness probe (DB, Redis)
 *
 * Public endpoints — no auth/permission required.
 */

import { ApiSchema } from '../../../../base/apiSchema.js'
import { HealthController } from './healthController.js'

const liveness = {
  path:    '/healthz',
  verb:    'GET',
  handler: { controller: HealthController, method: 'liveness' },
}

const readiness = {
  path:    '/readyz',
  verb:    'GET',
  handler: { controller: HealthController, method: 'readiness' },
}

export const HealthApi = new ApiSchema({
  name:      'Health',
  url:       '',
  endpoints: [liveness, readiness],
})
