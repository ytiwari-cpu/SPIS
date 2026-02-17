#!/usr/bin/env node
/**
 * Run migration 008: Allow duplicate emails, enforce unique national_id_hash
 * Uses Supabase RPC exec_ddl function
 */

import { readFileSync } from 'fs'

const SUPABASE_URL = 'https://wrxrstmncezssrscrkxs.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndyeHJzdG1uY2V6c3Nyc2Nya3hzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg2ODc5MiwiZXhwIjoyMDg2NDQ0NzkyfQ.MsQ4yGGoXc8qpNScZqeOS0JqoTDuAMENmMrzfbuP0TQ'

async function runMigration() {
  try {
    console.log('Running migration: 008_email_non_unique.sql')
    
    const sql = readFileSync('src/db/008_email_non_unique.sql', 'utf8')
    
    // Execute via Supabase RPC
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_ddl`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ query: sql })
    })
    
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`HTTP ${response.status}: ${error}`)
    }
    
    console.log('✓ Migration completed successfully')
    console.log('  - Dropped UNIQUE constraint on email')
    console.log('  - Added UNIQUE constraint on national_id_hash')
    
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

runMigration()
