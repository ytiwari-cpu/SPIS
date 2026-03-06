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
import { createApp } from './api.js'
import { config } from './config.js'
import { connectBus, closeBus } from './bus/rabbitmq.js'
import { pool } from './db/pool.js'
import { createLogger } from '../../base/logger.js'
const logger = createLogger('email-service')

const app = createApp()

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
