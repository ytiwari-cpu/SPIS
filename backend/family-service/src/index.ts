import 'dotenv/config'
import express, { Request, Response } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'

import { familyRouter } from './routes/family.routes.js'
import { memberRouter } from './routes/member.routes.js'
import { addressRouter } from './routes/address.routes.js'
import { documentRouter } from './routes/document.routes.js'
import { devRouter } from './routes/dev.routes.js'
import { authRouter } from './routes/auth.routes.js'
import { registrationRouter } from './routes/registration.routes.js'
import { uploadRouter } from './routes/upload.routes.js'
import { errorHandler } from './middleware/errorHandler.js'
import { notFound } from './middleware/notFound.js'
import { testConnection } from './lib/supabase.js'

const app = express()
const PORT = process.env.PORT || 3001

// Security middleware
app.use(helmet())

// CORS - allow frontend
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}))

// Logging
app.use(morgan('combined'))

// Body parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Health check with DB connection test
app.get('/health', async (_req: Request, res: Response) => {
  const dbStatus = await testConnection()
  res.json({
    status: dbStatus.success ? 'ok' : 'degraded',
    service: 'family-service',
    database: dbStatus.success ? 'connected' : dbStatus.error,
    timestamp: new Date().toISOString(),
  })
})

// API Routes
app.use('/api/v1/auth', authRouter)
app.use('/api/v1/registration', registrationRouter)  // NEW: DB-driven registration flow
app.use('/api/v1/upload', uploadRouter)              // NEW: File upload routes
app.use('/api/v1/families', familyRouter)
app.use('/api/v1/members', memberRouter)
app.use('/api/v1/addresses', addressRouter)
app.use('/api/v1/documents', documentRouter)

// DEV-ONLY routes
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/v1/dev', devRouter)
}

// Error handling
app.use(notFound)
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`🚀 Family Service running on port ${PORT}`)
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`   CORS Origin: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`)
  if (process.env.NODE_ENV !== 'production') {
    console.log(`   ⚠️  DEV MODE: SQL Editor and Dev Tools enabled`)
  }
})

export default app
