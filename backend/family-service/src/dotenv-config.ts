/**
 * Load environment variables from .env file
 * This file must be imported FIRST before any other imports
 */
import { config } from 'dotenv'
import { join } from 'node:path'

// Load .env from current service directory
config({ path: join(process.cwd(), '.env') })
