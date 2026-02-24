/**
 * api.js — iam-service Express app factory
 *
 * Configures middleware and mounts all route handlers.
 * index.ts handles server startup (listen, bus connection, etc.)
 */

import express from 'express'
import cors    from 'cors'
import helmet  from 'helmet'
import morgan  from 'morgan'

import { config } from './config.js'

// Feature ApiSchema instances
import { LoginApi }         from './features/login/api.js'
import { OtpLoginApi }      from './features/otpLogin/api.js'
import { PasswordResetApi } from './features/passwordReset/api.js'
import { InviteApi }        from './features/invite/api.js'
import { MfaApi }           from './features/mfa/api.js'
import { WorkerRegisterApi } from './features/workerRegister/api.js'
import { AdminApi }         from './features/admin/api.js'

// Keep keycloak login + health as legacy routers (simple inline handlers)
import { keycloakLoginRouter } from './routes/keycloakLogin.routes.js'
import { healthRouter }        from './routes/health.routes.js'

import { errorHandler, notFound } from './middleware/errorHandler.js'
import { auditMiddleware }        from './middleware/audit.js'

export function createApp() {
  const app = express()

  // ── Security ───────────────────────────────────────────────────────────
  app.use(helmet())
  app.use(cors({ origin: config.corsOrigin, credentials: true }))

  // ── Logging ────────────────────────────────────────────────────────────
  app.use(morgan('combined'))

  // ── Body parsing ───────────────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true }))

  // ── Audit logging ──────────────────────────────────────────────────────
  app.use(auditMiddleware())

  // ── Health & Keycloak (legacy inline routers) ─────────────────────────
  app.use('/',                   healthRouter)
  app.use('/iam/keycloak/login', keycloakLoginRouter)

  // ── Feature routes (4-layer: api → controller → service → repository) ─
  LoginApi.register(app)
  OtpLoginApi.register(app)
  PasswordResetApi.register(app)
  InviteApi.register(app)
  MfaApi.register(app)
  WorkerRegisterApi.register(app)
  AdminApi.register(app)

  // ── Error handling ─────────────────────────────────────────────────────
  app.use(notFound)
  app.use(errorHandler)

  return app
}
