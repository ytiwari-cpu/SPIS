/**
 * SPIS Email Service — Configuration
 *
 * All config values sourced from environment variables.
 * Fails fast if required vars are missing in production.
 */

import 'dotenv/config'

function env(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback
  if (val === undefined) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return val
}

function envInt(key: string, fallback: number): number {
  const raw = process.env[key]
  if (raw === undefined) return fallback
  const n = parseInt(raw, 10)
  if (isNaN(n)) throw new Error(`Invalid integer for ${key}: ${raw}`)
  return n
}

function envBool(key: string, fallback: boolean): boolean {
  const raw = process.env[key]
  if (raw === undefined) return fallback
  return raw === 'true' || raw === '1'
}

export const config = {
  // ── Server ──────────────────────────────────────────────
  port: envInt('EMAIL_SERVICE_PORT', envInt('PORT', 3002)),
  nodeEnv: env('NODE_ENV', 'development'),
  corsOrigin: env('CORS_ORIGIN', 'http://localhost:3000'),

  // ── PostgreSQL ──────────────────────────────────────────
  databaseUrl: env('EMAIL_DATABASE_URL', env('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/email_db')),
  dbPoolMin: envInt('EMAIL_DB_POOL_MIN', envInt('DB_POOL_MIN', 2)),
  dbPoolMax: envInt('EMAIL_DB_POOL_MAX', envInt('DB_POOL_MAX', 10)),

  // ── RabbitMQ ────────────────────────────────────────────
  rabbitmqUrl: env('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672'),
  rabbitmqExchange: env('RABBITMQ_EXCHANGE', 'spis.events'),
  rabbitmqPrefetch: envInt('RABBITMQ_PREFETCH', 5),

  // ── SendGrid ────────────────────────────────────────────
  sendgrid: {
    apiKey: env('SENDGRID_API_KEY', ''),
    fromEmail: env('SENDGRID_FROM_EMAIL', 'noreply@spis.gov.jm'),
    fromName: env('SENDGRID_FROM_NAME', 'SPIS Jamaica'),
    webhookVerificationKey: env('SENDGRID_WEBHOOK_VERIFICATION_KEY', ''),
  },

  // ── SMTP Fallback ──────────────────────────────────────
  smtp: {
    host: env('SMTP_HOST', 'smtp.example.com'),
    port: envInt('SMTP_PORT', 587),
    secure: envBool('SMTP_SECURE', false),
    user: env('SMTP_USER', ''),
    pass: env('SMTP_PASS', ''),
    fromEmail: env('SMTP_FROM_EMAIL', 'noreply@spis.gov.jm'),
    fromName: env('SMTP_FROM_NAME', 'SPIS Jamaica'),
  },

  // ── Rate Limits ─────────────────────────────────────────
  rateLimits: {
    otpPerEmailPerHour: envInt('RATE_LIMIT_OTP_PER_EMAIL_PER_HOUR', 5),
    invitePerEmailPerDay: envInt('RATE_LIMIT_INVITE_PER_EMAIL_PER_DAY', 3),
    globalPerDay: envInt('RATE_LIMIT_GLOBAL_PER_DAY', 100),
  },

  // ── Retry / Circuit Breaker ────────────────────────────
  maxSendAttempts: envInt('MAX_SEND_ATTEMPTS', 3),
  retryBaseDelayMs: envInt('RETRY_BASE_DELAY_MS', 1000),
  circuitBreaker: {
    threshold: envInt('CIRCUIT_BREAKER_THRESHOLD', 5),
    cooldownMs: envInt('CIRCUIT_BREAKER_COOLDOWN_MS', 60000),
  },

  // ── Data Retention ─────────────────────────────────────
  payloadRetentionDays: envInt('PAYLOAD_RETENTION_DAYS', 30),

  // ── Logging ─────────────────────────────────────────────
  logLevel: env('LOG_LEVEL', 'debug'),
} as const

export type Config = typeof config
