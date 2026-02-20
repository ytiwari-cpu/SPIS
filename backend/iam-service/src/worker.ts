/**
 * SPIS IAM Service — Event Worker Entry Point
 *
 * Standalone process that consumes the iam.registry queue
 * and handles registry events (CREATE_AUTH_ACCOUNT, USER_CONTACT_UPDATED, USER_DELETED).
 *
 * Usage:
 *   npm run worker       — Production
 *   npm run worker:dev   — Development (tsx watch)
 */

import 'dotenv/config'
import { startEventWorker } from './services/eventHandlers.js'
import { logger } from './lib/logger.js'

logger.info('IAM Event Worker starting...')

try {
  await startEventWorker()
} catch (err) {
  logger.error('Worker failed to start', {
    error: err instanceof Error ? err.message : 'unknown',
  })
  process.exit(1)
}
