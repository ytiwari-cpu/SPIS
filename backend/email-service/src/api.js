/**
 * api.js — email-service Express app factory
 *
 * Configures middleware and mounts all route handlers.
 * index.ts handles server startup (listen, bus connection, graceful shutdown).
 */

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'

import { config } from './config.js'
import { createLogger } from '../../base/logger.js'
import { requestId } from '../../base/middleware/requestId.js'
import { errorHandler as createErrorHandler, notFound } from '../../base/middleware/errorHandler.js'

// Feature route initializers (modules/features pattern)
import { EmailApi }             from './modules/features/email/emailApi.js'
import { HealthApi, WebhookApi } from './modules/features/health/healthApi.js'

const logger = createLogger('email-service')

/**
 * Creates and configures the Express app.
 * @returns {import('express').Application}
 */
export function createApp() {
  const app = express()

  // ── Request ID ──────────────────────────────────────────────
  app.use(requestId())

  // ── Security ────────────────────────────────────────────────
  app.use(helmet())
  app.use(cors({
    origin: config.corsOrigin,
    credentials: true,
  }))

  // ── Logging ─────────────────────────────────────────────────
  app.use(morgan('combined'))

  // ── Body Parsing ────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true }))

  // ── Feature routes (4-layer: api → controller → service → repository) ─
  HealthApi.register(app, undefined, { logger })   // /healthz, /readyz
  WebhookApi.register(app, undefined, { logger })  // /events/provider/bounce, /events/provider/delivery
  EmailApi.register(app, undefined, { logger })    // /email/otp, /email/invite, /email/notify

  // ── Error Handling ──────────────────────────────────────────
  app.use(notFound)
  app.use(createErrorHandler(logger))

  return app
}

