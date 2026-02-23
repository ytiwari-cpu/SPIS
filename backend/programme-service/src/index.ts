import './dotenv-config.js'
import express, { Request, Response } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'

import { programmeRouter } from './routes/programme.routes.js'
import { ruleRouter } from './routes/rule.routes.js'
import { ruleGroupRouter } from './routes/ruleGroup.routes.js'
import { variableRouter } from './routes/variable.routes.js'
import { customFieldRouter } from './routes/customField.routes.js'
import { beneficiaryRouter } from './routes/beneficiary.routes.js'
import { engineRouter } from './routes/engine.routes.js'
import { auditRouter } from './routes/audit.routes.js'
import { programmeManagerRouter } from './routes/programmeManager.routes.js'
import { errorHandler } from './middleware/errorHandler.js'
import { notFound } from './middleware/notFound.js'
import { requireAuth } from './middleware/requireAuth.js'
import { testConnection } from './lib/supabase.js'

const app = express()
const PORT = process.env.PROGRAMME_SERVICE_PORT || 3004

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
const healthHandler = async (_req: Request, res: Response) => {
    const dbStatus = await testConnection()
    res.json({
        status: dbStatus.success ? 'ok' : 'degraded',
        service: 'programme-service',
        database: dbStatus.success ? 'connected' : dbStatus.error,
        timestamp: new Date().toISOString(),
    })
}
app.get('/health', healthHandler)
app.get('/healthz', healthHandler)

// ─── All routes require authentication ────────────────────────────────────────
app.use('/api/v1/programmes', requireAuth, programmeRouter)
app.use('/api/v1/rules', requireAuth, ruleRouter)
app.use('/api/v1/rule-groups', requireAuth, ruleGroupRouter)
app.use('/api/v1/variables', requireAuth, variableRouter)
app.use('/api/v1/custom-fields', requireAuth, customFieldRouter)
app.use('/api/v1/beneficiaries', requireAuth, beneficiaryRouter)
app.use('/api/v1/engine', requireAuth, engineRouter)
app.use('/api/v1/audit', requireAuth, auditRouter)
app.use('/api/v1/programme-managers', requireAuth, programmeManagerRouter)

// Error handling
app.use(notFound)
app.use(errorHandler)

app.listen(PORT, () => {
    console.log(`🚀 Programme Service running on port ${PORT}`)
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`)
    console.log(`   CORS Origin: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`)
})

export default app
