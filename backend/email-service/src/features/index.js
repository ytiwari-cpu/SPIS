/**
 * features/index.js — email-service feature aggregator
 *
 * Registers all feature route handlers onto the Express app.
 * api.js calls registerFeatures(app) once instead of importing
 * each Api class individually.
 */

import { HealthApi, WebhookApi } from './health/healthApi.js'
import { EmailApi }              from './email/emailApi.js'

/**
 * Mount all email-service feature routes onto the Express app.
 * @param {import('express').Application} app
 * @param {{ connection?: object, redisClient?: object }} [options]
 */
export function registerFeatures(app, options = {}) {
  HealthApi.register(app, options)    // GET  /healthz, /readyz
  WebhookApi.register(app, options)   // POST /events/provider/bounce, /events/provider/delivery
  EmailApi.register(app, options)     // POST /email/otp, /email/invite, /email/notify
}
