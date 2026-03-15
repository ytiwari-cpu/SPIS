/**
 * healthApi.js — Health check + SendGrid webhook route definitions
 *
 * Endpoints:
 *   GET  /healthz                     — liveness probe (public)
 *   GET  /readyz                      — readiness probe (public)
 *   POST /events/provider/bounce      — SendGrid bounce webhook (public, signature-verified)
 *   POST /events/provider/delivery    — SendGrid delivery webhook (public, signature-verified)
 *
 * These are intentionally PUBLIC endpoints — health probes are used by
 * container orchestrators (Docker/K8s), and webhook endpoints are called
 * by external providers (SendGrid) that cannot authenticate with our JWT.
 * Webhook security is enforced via HMAC signature verification in the service layer.
 */

import { ApiSchema } from '../../../../base/apiSchema.js'
import { HealthController } from './healthController.js'
import { z } from 'zod'

// ═══════════════════════════════════════════════════════════════
// ROUTE DEFINITIONS
// ═══════════════════════════════════════════════════════════════

const liveness = {
  path:       '/healthz',
  verb:       'GET',
  handler:    { controller: HealthController, method: 'liveness', arguments: [] },
  middleware: [],
  response:   z.object({ status: z.enum(['ok', 'degraded']) }).passthrough(),
}

const readiness = {
  path:       '/readyz',
  verb:       'GET',
  handler:    { controller: HealthController, method: 'readiness', arguments: [] },
  middleware: [],
  response:   z.object({ status: z.enum(['ok', 'degraded']) }).passthrough(),
}

const bounce = {
  path:       '/provider/bounce',
  verb:       'POST',
  handler:    { controller: HealthController, method: 'bounce', arguments: [] },
  middleware: [],
}

const delivery = {
  path:       '/provider/delivery',
  verb:       'POST',
  handler:    { controller: HealthController, method: 'delivery', arguments: [] },
  middleware: [],
}

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
