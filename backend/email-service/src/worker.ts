/**
 * SPIS Email Service — Worker Entry Point
 *
 * Standalone process that consumes the email.send queue
 * and processes email delivery via configured providers.
 *
 * Usage:
 *   npm run worker       — Production
 *   npm run worker:dev   — Development (tsx watch)
 */

import './dotenv-config.js'
import { startWorker } from './services/worker.js'
import { createLogger } from '../../base/logger.js'
const logger = createLogger('email-service')

logger.info('Email Service Worker starting...')

try {
  await startWorker()
} catch (err) {
  logger.error('Worker failed to start', {
    error: err instanceof Error ? err.message : 'unknown',
  })
  process.exit(1)
}
