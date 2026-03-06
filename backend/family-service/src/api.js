/**
 * api.js — family-service Express app factory
 *
 * Configures middleware and mounts all route handlers.
 * index.ts handles server startup, port binding, etc.
 */

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'

import { createLogger } from '../../base/logger.js'
import { requestId }    from '../../base/middleware/requestId.js'
import { errorHandler as createErrorHandler, notFound } from '../../base/middleware/errorHandler.js'

// Feature route initializers (4-layer pattern)
import { AuthApi }     from './modules/features/auth/authApi.js'
import { FamilyApi }   from './modules/features/family/familyApi.js'
import { MemberApi, MemberPublicApi } from './modules/features/member/memberApi.js'
import { AddressApi }  from './modules/features/address/addressApi.js'
import { DocumentApi } from './modules/features/document/documentApi.js'
import { CitizensApi } from './modules/features/citizens/citizensApi.js'

// Legacy complex routers kept as-is
import { devRouter }          from './routes/dev.routes.js'
import { registrationRouter } from './routes/registration.routes.js'
import { uploadRouter }       from './routes/upload.routes.js'

import { testConnection } from './lib/supabase.js'

const logger = createLogger('family-service')

/**
 * Creates and configures the Express app.
 * @returns {import('express').Application}
 */
export function createApp() {
  const app = express()

  // ── Request ID (must be first) ──────────────────────────────
  app.use(requestId())

  // ── Security ────────────────────────────────────────────────
  app.use(helmet())
  app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  }))

  // ── Logging ─────────────────────────────────────────────────
  app.use(morgan('combined'))

  // ── Body parsing ────────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ extended: true }))

  // ── Health check (with DB connection test) ───────────────────
  const healthHandler = async (_req, res) => {
    const dbStatus = await testConnection()
    res.json({
      status: dbStatus.success ? 'ok' : 'degraded',
      service: 'family-service',
      database: dbStatus.success ? 'connected' : dbStatus.error,
      timestamp: new Date().toISOString(),
    })
  }
  app.get('/health', healthHandler)
  app.get('/healthz', healthHandler)

  // ── Legacy complex routers (registration + upload) ───────────
  app.use('/api/v1/registration', registrationRouter)
  app.use('/api/v1/upload', uploadRouter)

  // ── Feature routes (4-layer: api → controller → service → repository) ─
  AuthApi.register(app, undefined, { logger })        // /api/v1/auth/*
  FamilyApi.register(app, undefined, { logger })      // /api/v1/families/*
  MemberApi.register(app, undefined, { logger })      // /api/v1/members/*
  MemberPublicApi.register(app, undefined, { logger }) // /api/v1/public/members/lookup
  AddressApi.register(app, undefined, { logger })     // /api/v1/addresses/*
  DocumentApi.register(app, undefined, { logger })    // /api/v1/documents/*
  CitizensApi.register(app, undefined, { logger })    // /api/v1/citizens/*

  // ── DEV-ONLY routes ──────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    app.use('/api/v1/dev', devRouter)
  }

  // ── Error handling (centralized) ─────────────────────────────
  app.use(notFound)
  app.use(createErrorHandler(logger))

  return app
}
