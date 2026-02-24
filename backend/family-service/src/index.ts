import './dotenv-config.js'
import { createApp } from './api.js'
import { testConnection } from './lib/supabase.js'

const PORT = process.env.FAMILY_SERVICE_PORT || process.env.PORT || 3001

const app = createApp()

app.listen(PORT, async () => {
  const dbStatus = await testConnection()
  console.log(`🚀 Family Service running on port ${PORT}`)
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`   CORS Origin: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`)
  console.log(`   Database: ${dbStatus.success ? 'connected' : `degraded — ${dbStatus.error}`}`)
  if (process.env.NODE_ENV !== 'production') {
    console.log(`   ⚠️  DEV MODE: SQL Editor and Dev Tools enabled`)
  }
})

export default app
