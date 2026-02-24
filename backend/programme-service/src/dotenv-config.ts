/**
 * Load environment variables from shared .env file
 * This file must be imported FIRST before any other imports
 */
import { config as dotenvConfig } from 'dotenv'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const sharedEnvPath = join(process.cwd(), '../.env')
const localEnvPath = join(process.cwd(), '.env')

// Prefer shared backend env; fallback allows standalone local runs.
dotenvConfig({ path: existsSync(sharedEnvPath) ? sharedEnvPath : localEnvPath })
