import './dotenv-config.js'
import { createApp } from './api.js'

const PORT = process.env.PROGRAMME_SERVICE_PORT || 3004

const app = createApp()

app.listen(PORT, () => {
    console.log(`🚀 Programme Service running on port ${PORT}`)
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`)
    console.log(`   CORS Origin: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`)
})

export default app
