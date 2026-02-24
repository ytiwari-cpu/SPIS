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

// Feature route initializers (4-layer pattern)
import { EmailApi }             from './features/email/api.js'
import { HealthApi, WebhookApi } from './features/health/api.js'

import { errorHandler, notFound } from './middleware/errorHandler.js'

/**
 * Creates and configures the Express app.
 * @returns {import('express').Application}
 */
export function createApp() {
  const app = express()

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
  HealthApi.register(app)   // /healthz, /readyz
  WebhookApi.register(app)  // /events/provider/bounce, /events/provider/delivery
  EmailApi.register(app)    // /email/otp, /email/invite, /email/notify

  // ── Error Handling ──────────────────────────────────────────
  app.use(notFound)
  app.use(errorHandler)

  return app
}

