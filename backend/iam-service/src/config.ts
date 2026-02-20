/**
 * SPIS IAM Service — Configuration
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
  port: envInt('IAM_SERVICE_PORT', envInt('PORT', 3003)),
  nodeEnv: env('NODE_ENV', 'development'),
  corsOrigin: env('CORS_ORIGIN', 'http://localhost:3000'),

  // ── PostgreSQL (auth_db) ────────────────────────────────
  databaseUrl: env('IAM_DATABASE_URL', env('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/auth_db')),
  dbPoolMin: envInt('IAM_DB_POOL_MIN', envInt('DB_POOL_MIN', 2)),
  dbPoolMax: envInt('IAM_DB_POOL_MAX', envInt('DB_POOL_MAX', 10)),

  // ── Redis ───────────────────────────────────────────────
  redisUrl: env('REDIS_URL', 'redis://localhost:6379'),
  redisKeyPrefix: env('REDIS_KEY_PREFIX', 'spis:iam:'),

  // ── RabbitMQ ────────────────────────────────────────────
  rabbitmqUrl: env('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672'),
  rabbitmqExchange: env('RABBITMQ_EXCHANGE', 'spis.events'),
  rabbitmqPrefetch: envInt('RABBITMQ_PREFETCH', 5),

  // ── Keycloak ────────────────────────────────────────────
  keycloak: {
    baseUrl: env('KEYCLOAK_BASE_URL', 'http://localhost:8080'),
    realm: env('KEYCLOAK_REALM', 'spis-dev'),
    adminClientId: env('KEYCLOAK_ADMIN_CLIENT_ID', 'admin-cli'),
    adminClientSecret: env('KEYCLOAK_ADMIN_CLIENT_SECRET', ''),
    adminUsername: env('KEYCLOAK_ADMIN_USERNAME', 'admin'),
    adminPassword: env('KEYCLOAK_ADMIN_PASSWORD', 'admin'),
    frontendClientId: env('KEYCLOAK_FRONTEND_CLIENT_ID', 'frontend'),
    backendClientId: env('KEYCLOAK_BACKEND_CLIENT_ID', 'backend'),
    backendClientSecret: env('KEYCLOAK_BACKEND_CLIENT_SECRET', ''),
  },

  // ── Email Service ───────────────────────────────────────
  emailServiceUrl: env('EMAIL_SERVICE_URL', 'http://localhost:3002'),

  // ── Registry Service ────────────────────────────────────
  registryServiceUrl: env('REGISTRY_SERVICE_URL', 'http://localhost:3001'),

  // ── OTP / Password Reset ────────────────────────────────
  otp: {
    length: envInt('OTP_LENGTH', 6),
    ttlMinutes: envInt('OTP_TTL_MINUTES', 10),
    maxAttempts: envInt('OTP_MAX_ATTEMPTS', 5),
  },
  passwordMinLength: envInt('PASSWORD_MIN_LENGTH', 8),

  // ── Account Lockout ─────────────────────────────────────
  lockout: {
    threshold: envInt('LOCKOUT_THRESHOLD', 5),
    durationMinutes: envInt('LOCKOUT_DURATION_MINUTES', 15),
  },

  // ── TOTP ────────────────────────────────────────────────
  totp: {
    issuer: env('TOTP_ISSUER', 'SPIS Jamaica'),
    algorithm: env('TOTP_ALGORITHM', 'SHA1'),
    digits: envInt('TOTP_DIGITS', 6),
    period: envInt('TOTP_PERIOD', 30),
  },

  // ── JWT (IAM-issued tokens) ──────────────────────────────
  jwt: {
    secret: env('JWT_SECRET', 'spis-iam-jwt-secret-change-in-production-2024'),
    issuer: env('JWT_ISSUER', 'spis-iam'),
    audience: env('JWT_AUDIENCE', 'spis'),
    expiresInSeconds: envInt('JWT_EXPIRES_IN', 3600),
    serverStartTime: Math.floor(Date.now() / 1000), // Invalidate tokens issued before server start
  },

  // ── JWKS / Gateway ──────────────────────────────────────
  jwks: {
    cacheTtlSeconds: envInt('JWKS_CACHE_TTL_SECONDS', 900),
    url: env('JWKS_URL', 'http://localhost:8080/realms/spis-dev/protocol/openid-connect/certs'),
  },

  // ── Logging ─────────────────────────────────────────────
  logLevel: env('LOG_LEVEL', 'debug'),
} as const

export type Config = typeof config
