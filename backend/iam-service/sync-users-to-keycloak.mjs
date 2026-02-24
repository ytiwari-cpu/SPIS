#!/usr/bin/env node
/**
 * @deprecated This script is NO LONGER NEEDED for normal operation.
 * Keycloak now uses the shared Supabase PostgreSQL database directly
 * via the Supabase Connection Pooler (IPv4). All user data is
 * automatically shared across all developers.
 *
 * This script is kept ONLY for one-time emergency migration from a
 * developer's isolated local Keycloak to the shared Supabase backend.
 *
 * ORIGINAL PURPOSE:
 *   Sync users from Supabase IAM DB → local Keycloak (H2)
 *   via REST API. No longer necessary since Keycloak reads/writes
 *   the shared Supabase DB directly.
 *
 * USAGE (emergency only):
 *   node sync-users-to-keycloak.mjs
 */

import 'dotenv/config'

const KEYCLOAK_BASE = process.env.KEYCLOAK_BASE_URL || 'http://localhost:8080'
const SUPABASE_URL = process.env.IAM_SUPABASE_URL || process.env.SUPABASE_URL || 'https://wrxrstmncezssrscrkxs.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.IAM_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const ADMIN_USERNAME = process.env.KEYCLOAK_ADMIN_USERNAME || 'admin'
const ADMIN_PASSWORD = process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin'
const REALM_NAME = 'spis-dev'
const TEMP_PASSWORD = 'TempPass123!'  // Users must use "Forgot Password" to set their real password

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ IAM_SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE_KEY) environment variable is required')
  process.exit(1)
}

// ── Keycloak Admin API helpers ─────────────────────────────────────

async function getAdminToken() {
  const response = await fetch(`${KEYCLOAK_BASE}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD,
    }),
  })
  if (!response.ok) throw new Error(`Failed to get admin token: ${response.status}`)
  return (await response.json()).access_token
}

async function getKeycloakUserByUsername(token, username) {
  const response = await fetch(
    `${KEYCLOAK_BASE}/admin/realms/${REALM_NAME}/users?username=${encodeURIComponent(username)}&exact=true`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  )
  if (!response.ok) return null
  const users = await response.json()
  return users.length > 0 ? users[0] : null
}

async function createKeycloakUser(token, { username, email, enabled, roles }) {
  const response = await fetch(`${KEYCLOAK_BASE}/admin/realms/${REALM_NAME}/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      username,
      email,
      enabled,
      emailVerified: true,
      credentials: [{
        type: 'password',
        value: TEMP_PASSWORD,
        temporary: true,  // Forces password change on first login
      }],
    }),
  })

  if (response.status === 409) return 'exists'
  if (!response.ok) {
    const err = await response.text()
    console.error(`   ❌ Failed to create ${username}: ${err}`)
    return 'error'
  }

  // Assign roles if any
  if (roles && roles.length > 0) {
    await assignRoles(token, username, roles)
  }

  return 'created'
}

async function assignRoles(token, username, roleNames) {
  try {
    const user = await getKeycloakUserByUsername(token, username)
    if (!user) return

    // Get available realm roles
    const rolesResp = await fetch(`${KEYCLOAK_BASE}/admin/realms/${REALM_NAME}/roles`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!rolesResp.ok) return
    const allRoles = await rolesResp.json()

    // Filter to matching roles
    const rolesToAssign = allRoles.filter(r => roleNames.includes(r.name))
    if (rolesToAssign.length === 0) return

    // Assign roles to user
    await fetch(`${KEYCLOAK_BASE}/admin/realms/${REALM_NAME}/users/${user.id}/role-mappings/realm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(rolesToAssign),
    })
  } catch {
    // Non-critical — role assignment can be done manually in Keycloak admin
  }
}

// ── Supabase REST API helpers ──────────────────────────────────────

async function fetchUsersFromSupabase() {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({
      query: `
        SELECT
          u.user_id,
          u.email,
          u.status,
          u.national_id_hash,
          array_agg(ur.role_name::text) FILTER (WHERE ur.role_name IS NOT NULL) as roles
        FROM users u
        LEFT JOIN user_roles ur ON u.user_id = ur.user_id
        WHERE u.status IN ('active', 'pending')
        GROUP BY u.user_id, u.email, u.status, u.national_id_hash
      `
    }),
  })
  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Failed to fetch users from Supabase: ${err}`)
  }
  return response.json()
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗')
  console.log('║     SYNC IAM USERS → LOCAL KEYCLOAK                      ║')
  console.log('╚═══════════════════════════════════════════════════════════╝')
  console.log('')

  try {
    const token = await getAdminToken()
    console.log('🔐 Admin token obtained')

    const users = await fetchUsersFromSupabase()
    console.log(`📊 Found ${users.length} user(s) in IAM DB\n`)

    if (users.length === 0) {
      console.log('ℹ️  No users in the IAM DB yet.')
      return
    }

    let created = 0, skipped = 0, failed = 0

    for (const user of users) {
      // Use email as the Keycloak lookup key
      const username = user.email

      // Check if already in Keycloak
      const existing = await getKeycloakUserByUsername(token, username)
      if (existing) {
        skipped++
        continue
      }

      const result = await createKeycloakUser(token, {
        username,
        email: user.email,
        enabled: user.status === 'active',
        roles: (user.roles || []).filter(r => r && r !== 'null'),
      })

      if (result === 'created') {
        const roles = (user.roles || []).filter(r => r && r !== 'null')
        console.log(`   ✅ Created: ${username} [${roles.join(', ') || 'no roles'}]`)
        created++
      } else if (result === 'exists') {
        skipped++
      } else {
        failed++
      }
    }

    console.log('')
    console.log('═══════════════════════════════════════════════════════════')
    console.log(`Summary: ${created} created, ${skipped} already exist, ${failed} failed`)
    console.log('═══════════════════════════════════════════════════════════')

    if (created > 0) {
      console.log('')
      console.log(`⚠️  ${created} new user(s) created with temporary password.`)
      console.log('   They must use "Forgot Password" to set their real password.')
    }

    console.log('')

  } catch (error) {
    console.error('\n❌ Sync failed:', error.message)
    process.exit(1)
  }
}

main()
