#!/usr/bin/env node
/**
 * Run migration 008: Allow duplicate emails, enforce unique national_id_hash
 */

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'
import { pool } from './src/db/pool.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function runMigration() {
  try {
    console.log('Running migration: 008_email_non_unique.sql')
    
    const migrationPath = join(__dirname, 'src/db/008_email_non_unique.sql')
    const sql = readFileSync(migrationPath, 'utf8')
    
    await pool.query(sql)
    
    console.log('✓ Migration completed successfully')
    console.log('  - Dropped UNIQUE constraint on email')
    console.log('  - Added UNIQUE constraint on national_id_hash')
    
    process.exit(0)
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

runMigration()
