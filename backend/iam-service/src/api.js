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
import { createLogger } from '../../base/logger.js'
import { requestId }    from '../../base/middleware/requestId.js'
import { errorHandler as createErrorHandler, notFound } from '../../base/middleware/errorHandler.js'
import { auditMiddleware } from '../../base/middleware/auditLog.js'

// Feature ApiSchema instances
import { LoginApi }           from './features/login/api.js'
import { OtpLoginApi }        from './features/otpLogin/api.js'
import { PasswordResetApi }   from './features/passwordReset/api.js'
import { InviteApi }          from './features/invite/api.js'
import { MfaApi }             from './features/mfa/api.js'
import { WorkerRegisterApi }  from './features/workerRegister/api.js'
import { AdminApi }           from './features/admin/api.js'
import { KeycloakLoginApi }   from './features/keycloakLogin/keycloakLoginApi.js'
import { HealthApi }          from './features/health/healthApi.js'

// Pool for audit middleware direct insert
import { pool } from './db/pool.js'

const logger = createLogger('iam-service')

export function createApp() {
  const app = express()

  // ── Request ID (must be first) ─────────────────────────────────────────
  app.use(requestId())

  // ── Security ───────────────────────────────────────────────────────────
  app.use(helmet())
  app.use(cors({ origin: config.corsOrigin, credentials: true }))

  // ── Logging ────────────────────────────────────────────────────────────
  app.use(morgan('combined'))

  // ── Body parsing ───────────────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true }))

  // ── Audit logging (centralized) ────────────────────────────────────────
  app.use(auditMiddleware({
    serviceName: 'iam-service',
    pool,
    excludePaths: ['/iam/health', '/api/health', '/health', '/healthz'],
    logger,
  }))

  // ── Health (featureApi) ─────────────────────────────────────────────────
  HealthApi.register(app, undefined, { logger })

  // ── Keycloak Login (featureApi) ───────────────────────────────────────
  KeycloakLoginApi.register(app, undefined, { logger })

  // ── Feature routes (4-layer: api → controller → service → repository) ─
  LoginApi.register(app, undefined, { logger })
  OtpLoginApi.register(app, undefined, { logger })
  PasswordResetApi.register(app, undefined, { logger })
  InviteApi.register(app, undefined, { logger })
  MfaApi.register(app, undefined, { logger })
  WorkerRegisterApi.register(app, undefined, { logger })
  AdminApi.register(app, undefined, { logger })

  // ── Error handling (centralized) ───────────────────────────────────────
  app.use(notFound)
  app.use(createErrorHandler(logger))

  return app
}

