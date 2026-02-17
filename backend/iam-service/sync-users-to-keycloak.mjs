#!/usr/bin/env node
/**
 * Sync Users from Local IAM DB to Keycloak
 * 
 * This script reads users from the local IAM database and creates
 * corresponding users in Keycloak. This enables the hybrid approach
 * where we maintain users in both systems.
 * 
 * Usage:
 *   node sync-users-to-keycloak.mjs
 */

import 'dotenv/config'

const KEYCLOAK_BASE = process.env.KEYCLOAK_BASE_URL || 'http://localhost:8080'
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wrxrstmncezssrscrkxs.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ADMIN_USERNAME = process.env.KEYCLOAK_ADMIN_USERNAME || 'admin'
const ADMIN_PASSWORD = process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin'
const REALM_NAME = 'spis-dev'

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required')
  process.exit(1)
}

async function getAdminToken() {
  console.log('🔐 Getting Keycloak admin token...')
  
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

  if (!response.ok) {
    throw new Error(`Failed to get admin token: ${response.status}`)
  }

  const data = await response.json()
  return data.access_token
}

async function fetchLocalUsers() {
  console.log('📚 Fetching users from local IAM database...')
  
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
          u.national_id_hash,
          u.status,
          array_agg(ur.role_name::text) as roles
        FROM users u
        LEFT JOIN user_roles ur ON u.user_id = ur.user_id
        WHERE u.status = 'active'
        GROUP BY u.user_id, u.email, u.national_id_hash, u.status
      `
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to fetch users: ${error}`)
  }

  return response.json()
}

async function createKeycloakUser(token, user) {
  // Since we can't recover the original national_id from hash,
  // we'll use a placeholder username or email
  const username = user.email.split('@')[0] || `user_${user.user_id.substring(0, 8)}`
  
  const userPayload = {
    username: username,
    email: user.email,
    enabled: user.status === 'active',
    emailVerified: true,
    attributes: {
      local_user_id: [user.user_id],
      national_id_hash: [user.national_id_hash || ''],
    },
    // Set a temporary password that user must change
    credentials: [
      {
        type: 'password',
        value: 'TempPassword123!',
        temporary: true,  // User must change on first login
      },
    ],
  }

  const response = await fetch(`${KEYCLOAK_BASE}/admin/realms/${REALM_NAME}/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(userPayload),
  })

  if (response.status === 409) {
    console.log(`   ⚠️  User '${username}' already exists, skipping`)
    return null
  }

  if (!response.ok) {
    const error = await response.text()
    console.error(`   ❌ Failed to create user '${username}': ${error}`)
    return null
  }

  // Get user ID from Location header
  const locationHeader = response.headers.get('Location')
  const keycloakUserId = locationHeader?.split('/').pop() || ''
  
  console.log(`   ✅ Created user: ${username} (${keycloakUserId})`)
  return keycloakUserId
}

async function assignRolesToUser(token, userId, roles) {
  const validRoles = (roles || []).filter(r => r && r !== 'null')
  
  if (validRoles.length === 0) return

  for (const roleName of validRoles) {
    // Get role details
    const roleResponse = await fetch(`${KEYCLOAK_BASE}/admin/realms/${REALM_NAME}/roles/${roleName}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })

    if (!roleResponse.ok) {
      console.log(`      ⚠️  Role '${roleName}' not found in Keycloak`)
      continue
    }

    const role = await roleResponse.json()

    // Assign role
    const assignResponse = await fetch(`${KEYCLOAK_BASE}/admin/realms/${REALM_NAME}/users/${userId}/role-mappings/realm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify([role]),
    })

    if (assignResponse.ok) {
      console.log(`      ✅ Assigned role: ${roleName}`)
    }
  }
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗')
  console.log('║     SYNC USERS FROM LOCAL IAM DB TO KEYCLOAK             ║')
  console.log('╚═══════════════════════════════════════════════════════════╝')
  console.log('')

  try {
    const token = await getAdminToken()
    const users = await fetchLocalUsers()

    console.log(`\n📊 Found ${users.length} active users in local database`)
    console.log('')

    let created = 0
    let skipped = 0

    for (const user of users) {
      const keycloakUserId = await createKeycloakUser(token, user)
      
      if (keycloakUserId) {
        await assignRolesToUser(token, keycloakUserId, user.roles)
        created++
      } else {
        skipped++
      }
    }

    console.log('')
    console.log('═══════════════════════════════════════════════════════════')
    console.log(`Summary: ${created} created, ${skipped} skipped`)
    console.log('═══════════════════════════════════════════════════════════')
    console.log('')
    console.log('⚠️  IMPORTANT: Synced users have temporary passwords.')
    console.log('   They must reset their password on first Keycloak login.')
    console.log('')
    console.log('   Alternative: Keep using local IAM DB for passwords')
    console.log('   and only use Keycloak for token issuance.')
    console.log('')

  } catch (error) {
    console.error('\n❌ Sync failed:', error.message)
    process.exit(1)
  }
}

main()
