/**
 * health/api.js — route definitions for health + webhook features
 */

import { ApiSchema } from '../../../../base/apiSchema.js'
import { HealthController } from './healthController.js'

const liveness  = { path: '/healthz', verb: 'GET',  handler: { controller: HealthController, method: 'liveness' },  middleware: [] }
const readiness = { path: '/readyz',  verb: 'GET',  handler: { controller: HealthController, method: 'readiness' }, middleware: [] }

const bounce   = { path: '/provider/bounce',   verb: 'POST', handler: { controller: HealthController, method: 'bounce' },   middleware: [] }
const delivery = { path: '/provider/delivery', verb: 'POST', handler: { controller: HealthController, method: 'delivery' }, middleware: [] }

export const HealthApi = new ApiSchema({
  name:      'Health',
  url:       '',
  endpoints: [liveness, readiness],
})

export const WebhookApi = new ApiSchema({
  name:      'Webhook',
  url:       '/events',
  endpoints: [bounce, delivery],
})
