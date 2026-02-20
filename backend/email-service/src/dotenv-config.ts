/**
 * Load environment variables from shared .env file
 * This file must be imported FIRST before any other imports
 */
import { config as dotenvConfig } from 'dotenv'
import { join } from 'node:path'

// Load shared .env from backend root directory
dotenvConfig({ path: join(process.cwd(), '../.env') })
