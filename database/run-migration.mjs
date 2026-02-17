#!/usr/bin/env node
/**
 * SPIS Database Migration Runner
 *
 * Runs supabase-migration.sql against the Supabase project using the
 * Supabase Management API (api.supabase.com) to execute raw SQL.
 *
 * This bypasses the IPv6 connectivity issue because it goes through
 * Supabase's REST API (IPv4) rather than direct PostgreSQL.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=<your-token> node run-migration.mjs
 *
 * If you don't have a Supabase access token, you can also run this SQL
 * directly in the Supabase Dashboard → SQL Editor.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// --- Configuration ---
const PROJECT_REF = 'xdupcfxxcbltjmdgzzhf' // family Supabase project
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdXBjZnh4Y2JsdGptZGd6emhmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDYyODk1MiwiZXhwIjoyMDg2MjA0OTUyfQ.hyRMxWe9mlVVyb1rmBLv4Ee1l1MIUTo2J8hOohDlxCk'

// Supabase personal access token (from https://supabase.com/dashboard/account/tokens)
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN

// --- Read SQL file ---
const sqlFile = path.join(__dirname, 'supabase-migration.sql')
const fullSql = fs.readFileSync(sqlFile, 'utf-8')

/**
 * Strategy 1: Use Supabase Management API (/v1/projects/{ref}/database/query)
 * Requires a personal access token.
 */
async function runViaManagementAPI(sql) {
  console.log('🔧 Running migration via Supabase Management API...')
  const resp = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    }
  )
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Management API error ${resp.status}: ${text}`)
  }
  const data = await resp.json()
  console.log('✅ Migration completed via Management API')
  return data
}

/**
 * Strategy 2: Split into statements and run via PostgREST rpc once
 * exec_sql/exec_ddl are created. This is a fallback.
 */
async function runViaRPC(sql) {
  console.log('🔧 Running migration via PostgREST RPC...')

  // We need to create exec_sql and exec_ddl first using a different approach
  // Let's try the pg_net extension or direct SQL endpoint

  // First, try to create the functions by calling the Supabase REST SQL endpoint
  // This is an undocumented but often available endpoint
  const sqlEndpoint = `${SUPABASE_URL}/rest/v1/rpc/exec_ddl`

  // Split the SQL into logical blocks
  const blocks = splitSqlIntoBlocks(sql)
  let success = 0
  let failed = 0

  for (const block of blocks) {
    const trimmed = block.trim()
    if (!trimmed || trimmed.startsWith('--')) continue

    try {
      const isSelect =
        trimmed.toUpperCase().startsWith('SELECT') ||
        trimmed.toUpperCase().startsWith('WITH')

      const funcName = isSelect ? 'exec_sql' : 'exec_ddl'
      const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${funcName}`, {
        method: 'POST',
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ query: trimmed }),
      })

      if (!resp.ok) {
        const errText = await resp.text()
        console.log(`  ⚠️  Block failed: ${trimmed.substring(0, 60)}... → ${errText.substring(0, 100)}`)
        failed++
      } else {
        console.log(`  ✅ ${trimmed.substring(0, 60)}...`)
        success++
      }
    } catch (err) {
      console.log(`  ❌ ${trimmed.substring(0, 60)}... → ${err.message}`)
      failed++
    }
  }

  console.log(`\n📊 Results: ${success} succeeded, ${failed} failed`)
}

/**
 * Split SQL into executable blocks, respecting $$ delimited function bodies.
 */
function splitSqlIntoBlocks(sql) {
  const blocks = []
  let current = ''
  let inDollarQuote = false
  const lines = sql.split('\n')

  for (const line of lines) {
    const trimmedLine = line.trim()

    // Skip pure comment lines at top level
    if (!inDollarQuote && !current.trim() && trimmedLine.startsWith('--')) {
      continue
    }

    current += line + '\n'

    // Track $$ delimiters
    const dollarMatches = line.match(/\$\$/g)
    if (dollarMatches) {
      for (const _ of dollarMatches) {
        inDollarQuote = !inDollarQuote
      }
    }

    // If we're outside a $$ block and hit a semicolon at end of line, split
    if (!inDollarQuote && trimmedLine.endsWith(';')) {
      const block = current.trim()
      if (block && !block.startsWith('--')) {
        blocks.push(block)
      }
      current = ''
    }
  }

  // Handle any remaining SQL
  const remaining = current.trim()
  if (remaining && !remaining.startsWith('--')) {
    blocks.push(remaining)
  }

  return blocks
}

// --- Main ---
async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  SPIS Database Migration')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  Project: ${PROJECT_REF}`)
  console.log(`  SQL file: ${sqlFile}`)
  console.log(`  SQL size: ${fullSql.length} chars`)
  console.log('')

  if (ACCESS_TOKEN) {
    // Preferred: use Management API (runs the entire SQL as one batch)
    try {
      await runViaManagementAPI(fullSql)
      return
    } catch (err) {
      console.error(`❌ Management API failed: ${err.message}`)
      console.log('   Falling back to RPC method...\n')
    }
  } else {
    console.log('ℹ️  No SUPABASE_ACCESS_TOKEN set.')
    console.log('   To use the Management API (recommended), get a token from:')
    console.log('   https://supabase.com/dashboard/account/tokens')
    console.log('')
    console.log('   Or you can paste the SQL into:')
    console.log(`   https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`)
    console.log('')

    // Try RPC fallback — won't work for the first run since exec_sql/exec_ddl don't exist yet
    console.log('   Attempting RPC fallback (only works if exec_sql/exec_ddl already exist)...\n')
  }

  await runViaRPC(fullSql)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
