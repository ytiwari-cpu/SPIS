/**
 * SPIS IAM Service — API Server Entry Point
 *
 * Starts the Express HTTP server with:
 *   /iam/password-reset/*   — password reset flow
 *   /iam/mfa/*              — TOTP + email OTP
 *   /iam/invite             — create auth account
 *   /healthz, /readyz       — health probes
 */

import './dotenv-config.js'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'

import { config } from './config.js'
import { passwordResetRouter } from './routes/passwordReset.routes.js'
import { loginRouter } from './routes/login.routes.js'
import { keycloakLoginRouter } from './routes/keycloakLogin.routes.js'
import { otpLoginRouter } from './routes/otpLogin.routes.js'
import { mfaRouter } from './routes/mfa.routes.js'
import { inviteRouter } from './routes/invite.routes.js'
import { adminRouter } from './routes/admin.routes.js'
import workerRegisterRouter from './routes/workerRegister.routes.js'
import { healthRouter } from './routes/health.routes.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'
import { auditMiddleware } from './middleware/audit.js'
import { connectBus, closeBus } from './bus/rabbitmq.js'
import { pool } from './db/pool.js'
import { closeRedis } from './lib/redis.js'
import { logger } from './lib/logger.js'

const app = express()

// ── Security ────────────────────────────────────────────────
app.use(helmet())
app.use(cors({ origin: config.corsOrigin, credentials: true }))

// ── Logging ─────────────────────────────────────────────────
app.use(morgan('combined'))

// ── Body Parsing ────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true }))

// ── Audit Logging ───────────────────────────────────────────
// Logs all /iam/* API calls to audit_logs table (except health checks)
app.use(auditMiddleware())

// ── Routes ──────────────────────────────────────────────────
app.use('/', healthRouter)                          // /healthz, /readyz
app.use('/iam/password-reset', passwordResetRouter)  // /iam/password-reset/request, /confirm
app.use('/iam/login', loginRouter)                   // /iam/login (HS256 - legacy)
app.use('/iam/otp-login', otpLoginRouter)            // /iam/otp-login/request, /verify
app.use('/iam/keycloak/login', keycloakLoginRouter)  // /iam/keycloak/login (RS256 - Keycloak)
app.use('/iam/mfa', mfaRouter)                       // /iam/mfa/totp/*, /iam/mfa/email/*
app.use('/iam/invite', inviteRouter)                 // /iam/invite
app.use('/iam/admin', adminRouter)                   // /iam/admin/* (SuperAdmin only)
app.use('/iam', workerRegisterRouter)                // /iam/worker-register*

// ── Error Handling ──────────────────────────────────────────
app.use(notFound)
app.use(errorHandler)

// ── Startup ─────────────────────────────────────────────────
async function start() {
  try {
    // Connect to RabbitMQ for publishing events
    await connectBus()

    app.listen(config.port, () => {
      logger.info('IAM Service API started', {
        port: config.port,
        env: config.nodeEnv,
      })
      console.log(`🚀 IAM Service API running on port ${config.port}`)
      console.log(`   Environment: ${config.nodeEnv}`)
      console.log(`   Keycloak:    ${config.keycloak.baseUrl}/realms/${config.keycloak.realm}`)
      console.log(`   Endpoints:`)
      console.log(`     POST /iam/login`)
      console.log(`     POST /iam/otp-login/request`)
      console.log(`     POST /iam/otp-login/verify`)
      console.log(`     POST /iam/password-reset/request`)
      console.log(`     POST /iam/password-reset/confirm`)
      console.log(`     POST /iam/mfa/totp/enroll`)
      console.log(`     POST /iam/mfa/totp/verify`)
      console.log(`     POST /iam/mfa/email/send`)
      console.log(`     POST /iam/mfa/email/verify`)
      console.log(`     POST /iam/invite`)
      console.log(`     GET  /healthz`)
      console.log(`     GET  /readyz`)
    })
  } catch (err) {
    logger.error('Failed to start IAM Service', {
      error: err instanceof Error ? err.message : 'unknown',
    })
    process.exit(1)
  }
}

// Graceful shutdown
async function shutdown() {
  logger.info('IAM Service API shutting down...')
  await closeBus()
  await closeRedis()
  await pool.end()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

start()

export default app
