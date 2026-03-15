import './dotenv-config.js'
import { createApp } from './api.js'

const PORT = process.env.FAMILY_SERVICE_PORT || process.env.PORT || 3001

async function start() {
  const app = await createApp()

  const server = app.listen(PORT, () => {
    console.log(`🚀 Family Service running on port ${PORT}`)
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`)
    console.log(`   CORS Origin: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`   ⚠️  DEV MODE: SQL Editor and Dev Tools enabled`)
    }
  })

  return server
}

let server: any

// ── Graceful shutdown ────────────────────────────────────────────────
async function shutdown() {
  console.log('Family Service shutting down...')
  server?.close(() => {
    console.log('HTTP server closed')
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

start()
  .then(s => { server = s })
  .catch(err => {
    console.error('Failed to start Family Service:', err.message)
    process.exit(1)
  })
