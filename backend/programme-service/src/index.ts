import './dotenv-config.js'
import { createApp } from './api.js'

const PORT = process.env.PROGRAMME_SERVICE_PORT || 3004

let server: any

async function start() {
  const app = await createApp()
  server = app.listen(PORT, () => {
    console.log(`🚀 Programme Service running on port ${PORT}`)
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`)
    console.log(`   CORS Origin: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`)
  })
}

// ── Graceful shutdown ────────────────────────────────────────────────
async function shutdown() {
  console.log('Programme Service shutting down...')
  server?.close(() => {
    console.log('HTTP server closed')
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

start().catch(err => {
  console.error('Failed to start Programme Service:', err.message)
  process.exit(1)
})
