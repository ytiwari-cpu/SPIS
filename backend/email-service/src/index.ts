/**
 * SPIS Email Service — API Server Entry Point
 *
 * Starts the Express HTTP server with:
 *   - /email/otp, /email/invite, /email/notify routes
 *   - /healthz, /readyz health endpoints
 *   - /events/provider/* webhook endpoints
 *   - RabbitMQ connection for publishing
 */

import './dotenv-config.js'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'

import { config } from './config.js'
import { emailRouter } from './routes/email.routes.js'
import { healthRouter, webhookRouter } from './routes/health.routes.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'
import { connectBus, closeBus } from './bus/rabbitmq.js'
import { pool } from './db/pool.js'
import { logger } from './lib/logger.js'

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

// ── Routes ──────────────────────────────────────────────────
app.use('/', healthRouter)                  // /healthz, /readyz
app.use('/email', emailRouter)              // /email/otp, /email/invite, /email/notify
app.use('/events', webhookRouter)           // /events/provider/bounce, /events/provider/delivery

// ── Error Handling ──────────────────────────────────────────
app.use(notFound)
app.use(errorHandler)

// ── Startup ─────────────────────────────────────────────────
async function start() {
  try {
    // Connect to RabbitMQ for publishing
    await connectBus()

    app.listen(config.port, () => {
      logger.info('Email Service API started', {
        port: config.port,
        env: config.nodeEnv,
        corsOrigin: config.corsOrigin,
      })
      console.log(`🚀 Email Service API running on port ${config.port}`)
      console.log(`   Environment: ${config.nodeEnv}`)
      console.log(`   Endpoints:`)
      console.log(`     POST /email/otp`)
      console.log(`     POST /email/invite`)
      console.log(`     POST /email/notify`)
      console.log(`     GET  /healthz`)
      console.log(`     GET  /readyz`)
      console.log(`     POST /events/provider/bounce`)
      console.log(`     POST /events/provider/delivery`)
    })
  } catch (err) {
    logger.error('Failed to start Email Service', {
      error: err instanceof Error ? err.message : 'unknown',
    })
    process.exit(1)
  }
}

// Graceful shutdown
async function shutdown() {
  logger.info('Email Service API shutting down...')
  await closeBus()
  await pool.end()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

start()

export default app
