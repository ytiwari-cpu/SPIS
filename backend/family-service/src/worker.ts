import 'dotenv/config'
import { startOutboxBridge } from './services/outboxBridge.js'

async function start() {
  try {
    await startOutboxBridge()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    console.error('Failed to start outbox bridge worker:', message)
    process.exit(1)
  }
}

start()
