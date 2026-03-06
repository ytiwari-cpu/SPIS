/**
 * SPIS IAM Service — Server Entry Point
 */

import './dotenv-config.js'
import { createApp } from './api.js'
import { config } from './config.js'
import { connectBus, closeBus } from './bus/rabbitmq.js'
import { pool } from './db/pool.js'
import { closeRedis } from './lib/redis.js'
import { createLogger } from '../../base/logger.js'
const logger = createLogger('iam-service')

const app = createApp()

async function start() {
  try {
    await connectBus()
    app.listen(config.port, () => {
      logger.info('IAM Service API started', { port: config.port, env: config.nodeEnv })
      console.log(`🚀 IAM Service API running on port ${config.port}`)
      console.log(`   Environment: ${config.nodeEnv}`)
    })
  } catch (err) {
    logger.error('Failed to start IAM Service', {
      error: err instanceof Error ? err.message : 'unknown',
    })
    process.exit(1)
  }
}

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
