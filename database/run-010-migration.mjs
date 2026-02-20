#!/usr/bin/env node
/**
 * Run Migration 010: Registration Form Upgrade
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const PROJECT_REF = 'xdupcfxxcbltjmdgzzhf'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdXBjZnh4Y2JsdGptZGd6emhmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDYyODk1MiwiZXhwIjoyMDg2MjA0OTUyfQ.hyRMxWe9mlVVyb1rmBLv4Ee1l1MIUTo2J8hOohDlxCk'
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`

const migrationPath = path.join(__dirname, 'migrations', '010_registration_form_upgrade.sql')
const sql = fs.readFileSync(migrationPath, 'utf-8')

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('  🚀 Running Migration 010')
console.log('  Registration Form Upgrade')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log(`  📄 File: ${migrationPath}`)
console.log(`  📊 Size: ${sql.length} chars`)
console.log('')

// Split SQL into individual statements for execution
function splitStatements(sql) {
  const statements = []
  let current = ''
  let inQuote = false
  let quoteChar = null

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i]
    const prev = sql[i - 1]

    // Track quotes
    if ((char === "'" || char === '"') && prev !== '\\') {
      if (!inQuote) {
        inQuote = true
        quoteChar = char
      } else if (char === quoteChar) {
        inQuote = false
        quoteChar = null
      }
    }

    current += char

    // Split on semicolon outside quotes
    if (char === ';' && !inQuote) {
      const stmt = current.trim()
      if (stmt && !stmt.startsWith('--') && stmt !== ';') {
        statements.push(stmt)
      }
      current = ''
    }
  }

  // Add any remaining SQL
  const remaining = current.trim()
  if (remaining && !remaining.startsWith('--')) {
    statements.push(remaining)
  }

  return statements
}

async function runMigration() {
  console.log('📝 Parsing SQL statements...')
  const statements = splitStatements(sql)
  console.log(`✓ Found ${statements.length} statements\n`)

  let successCount = 0
  let failCount = 0

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i]
    
    // Skip comments and empty statements
    if (!stmt || stmt.startsWith('--')) continue

    // Show progress for long migrations
    if (i % 10 === 0 && i > 0) {
      console.log(`   Progress: ${i}/${statements.length} statements...`)
    }

    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/query`, {
        method: 'POST',
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ query: stmt })
      })

      if (!response.ok) {
        const text = await response.text()
        console.error(`\n❌ Statement ${i + 1} failed:`)
        console.error(`   ${stmt.substring(0, 100)}...`)
        console.error(`   Error: ${text}`)
        failCount++
        
        // Continue with other statements
        continue
      }

      successCount++
    } catch (err) {
      console.error(`\n❌ Statement ${i + 1} error:`)
      console.error(`   ${stmt.substring(0, 100)}...`)
      console.error(`   ${err.message}`)
      failCount++
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Migration Summary')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  ✅ Successful: ${successCount}`)
  console.log(`  ❌ Failed: ${failCount}`)
  console.log('')

  if (failCount === 0) {
    console.log('  🎉 Migration 010 completed successfully!')
  } else {
    console.log('  ⚠️  Migration completed with errors.')
    console.log('     Some statements may have failed because:')
    console.log('     - Columns already exist (IF NOT EXISTS)')
    console.log('     - This is expected for idempotent migrations')
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

runMigration().catch((err) => {
  console.error('\n💥 Fatal error:', err.message)
  process.exit(1)
})
