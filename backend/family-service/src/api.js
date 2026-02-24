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

// Feature route initializers (4-layer pattern)
import { AuthApi }     from './features/auth/api.js'
import { FamilyApi }   from './features/family/api.js'
import { MemberApi, MemberPublicApi } from './features/member/api.js'
import { AddressApi }  from './features/address/api.js'
import { DocumentApi } from './features/document/api.js'
import { CitizensApi } from './features/citizens/api.js'

// Legacy complex routers kept as-is
import { devRouter }          from './routes/dev.routes.js'
import { registrationRouter } from './routes/registration.routes.js'
import { uploadRouter }       from './routes/upload.routes.js'

import { errorHandler } from './middleware/errorHandler.js'
import { notFound }     from './middleware/notFound.js'
import { testConnection } from './lib/supabase.js'

/**
 * Creates and configures the Express app.
 * @returns {import('express').Application}
 */
export function createApp() {
  const app = express()

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
  AuthApi.register(app)        // /api/v1/auth/*
  FamilyApi.register(app)      // /api/v1/families/*
  MemberApi.register(app)      // /api/v1/members/*
  MemberPublicApi.register(app) // /api/v1/public/members/lookup
  AddressApi.register(app)     // /api/v1/addresses/*
  DocumentApi.register(app)    // /api/v1/documents/*
  CitizensApi.register(app)    // /api/v1/citizens/*

  // ── DEV-ONLY routes ──────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    app.use('/api/v1/dev', devRouter)
  }

  // ── Error handling ───────────────────────────────────────────
  app.use(notFound)
  app.use(errorHandler)

  return app
}

