/**
 * api.js — programme-service Express app factory
 *
 * Configures middleware and mounts all route handlers.
 * Exported as createApp() so index.ts only handles server startup.
 */

import express from 'express'
import cors    from 'cors'
import helmet  from 'helmet'
import morgan  from 'morgan'

import { createLogger } from '../../base/logger.js'
import { requestId }    from '../../base/middleware/requestId.js'
import { errorHandler as createErrorHandler, notFound } from '../../base/middleware/errorHandler.js'

import { ProgrammeApi }        from './modules/features/programme/programmeApi.js'
import { RuleApi }             from './modules/features/rule/ruleApi.js'
import { RuleGroupApi }        from './modules/features/ruleGroup/ruleGroupApi.js'
import { VariableApi }         from './modules/features/variable/variableApi.js'
import { CustomFieldApi }      from './modules/features/customField/customFieldApi.js'
import { BeneficiaryApi }      from './modules/features/beneficiary/beneficiaryApi.js'
import { EngineApi }           from './modules/features/engine/engineApi.js'
import { AuditApi }            from './modules/features/audit/auditApi.js'
import { ProgrammeManagerApi } from './modules/features/programmeManager/programmeManagerApi.js'

import { testConnection } from './lib/supabase.js'

const logger = createLogger('programme-service')

export function createApp() {
  const app = express()

  // ── Request ID ─────────────────────────────────────────────────────────
  app.use(requestId())

  // ── Global middleware ──────────────────────────────────────────────────
  app.use(helmet())
  app.use(cors({
    origin:      process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  }))
  app.use(morgan('combined'))
  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ extended: true }))

  // ── Health checks ──────────────────────────────────────────────────────
  const healthHandler = async (_req, res) => {
    const dbStatus = await testConnection()
    res.json({
      status:    dbStatus.success ? 'ok' : 'degraded',
      service:   'programme-service',
      database:  dbStatus.success ? 'connected' : dbStatus.error,
      timestamp: new Date().toISOString(),
    })
  }
  app.get('/health',  healthHandler)
  app.get('/healthz', healthHandler)

  // ── Feature routes ─────────────────────────────────────────────────────
  ProgrammeApi.register(app, undefined, { logger })
  RuleApi.register(app, undefined, { logger })
  RuleGroupApi.register(app, undefined, { logger })
  VariableApi.register(app, undefined, { logger })
  CustomFieldApi.register(app, undefined, { logger })
  BeneficiaryApi.register(app, undefined, { logger })
  EngineApi.register(app, undefined, { logger })
  AuditApi.register(app, undefined, { logger })
  ProgrammeManagerApi.register(app, undefined, { logger })

  // ── Fallbacks ──────────────────────────────────────────────────────────
  app.use(notFound)
  app.use(createErrorHandler(logger))

  return app
}
