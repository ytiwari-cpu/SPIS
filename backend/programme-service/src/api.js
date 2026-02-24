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

import { ProgrammeApi }        from './features/programme/api.js'
import { RuleApi }             from './features/rule/api.js'
import { RuleGroupApi }        from './features/ruleGroup/api.js'
import { VariableApi }         from './features/variable/api.js'
import { CustomFieldApi }      from './features/customField/api.js'
import { BeneficiaryApi }      from './features/beneficiary/api.js'
import { EngineApi }           from './features/engine/api.js'
import { AuditApi }            from './features/audit/api.js'
import { ProgrammeManagerApi } from './features/programmeManager/api.js'

import { errorHandler }   from './middleware/errorHandler.js'
import { notFound }       from './middleware/notFound.js'
import { testConnection } from './lib/supabase.js'

export function createApp() {
  const app = express()

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
  ProgrammeApi.register(app)
  RuleApi.register(app)
  RuleGroupApi.register(app)
  VariableApi.register(app)
  CustomFieldApi.register(app)
  BeneficiaryApi.register(app)
  EngineApi.register(app)
  AuditApi.register(app)
  ProgrammeManagerApi.register(app)

  // ── Fallbacks ──────────────────────────────────────────────────────────
  app.use(notFound)
  app.use(errorHandler)

  return app
}
