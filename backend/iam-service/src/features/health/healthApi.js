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
import { z } from 'zod'

const liveness = {
  path:     '/healthz',
  verb:     'GET',
  handler:  { controller: HealthController, method: 'liveness', arguments: [] },
  response: z.object({ status: z.enum(['ok', 'degraded']) }).passthrough(),
}

const readiness = {
  path:     '/readyz',
  verb:     'GET',
  handler:  { controller: HealthController, method: 'readiness', arguments: [] },
  response: z.object({ status: z.enum(['ok', 'degraded']) }).passthrough(),
}

export const HealthApi = new ApiSchema({
  name:      'Health',
  url:       '',
  endpoints: [liveness, readiness],
})
