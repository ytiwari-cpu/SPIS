#!/usr/bin/env node
/**
 * Keycloak Setup Script
 * 
 * Creates the spis-dev realm, frontend client, and roles in Keycloak.
 * Run this after starting Keycloak for the first time.
 * 
 * Prerequisites:
 * - Keycloak running at http://localhost:8080
 * - Admin user: admin / admin
 * 
 * Usage:
 *   node setup-keycloak.mjs
 */

const KEYCLOAK_BASE = process.env.KEYCLOAK_BASE_URL || 'http://localhost:8080'
const ADMIN_USERNAME = process.env.KEYCLOAK_ADMIN_USERNAME || 'admin'
const ADMIN_PASSWORD = process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin'
const REALM_NAME = 'spis-dev'
const CLIENT_ID = 'frontend'

// Roles to create in Keycloak
const ROLES = [
  { name: 'Citizen', description: 'Regular citizen accessing the portal' },
  { name: 'CaseWorker', description: 'Staff managing citizen cases' },
  { name: 'ProgrammeManager', description: 'Manages social protection programmes' },
  { name: 'Admin', description: 'System administrator' },
  { name: 'SuperAdmin', description: 'Super administrator with full access' },
]

async function getAdminToken() {
  console.log('🔐 Getting admin token...')
  
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
    const error = await response.text()
    throw new Error(`Failed to get admin token: ${response.status} - ${error}`)
  }

  const data = await response.json()
  console.log('✅ Admin token obtained')
  return data.access_token
}

async function createRealm(token) {
  console.log(`\n🏰 Creating realm: ${REALM_NAME}`)
  
  const realmConfig = {
    realm: REALM_NAME,
    enabled: true,
    displayName: 'SPIS Jamaica',
    sslRequired: 'external',
    registrationAllowed: false,
    loginWithEmailAllowed: true,
    duplicateEmailsAllowed: true,
    resetPasswordAllowed: true,
    editUsernameAllowed: false,
    bruteForceProtected: true,
    permanentLockout: false,
    maxFailureWaitSeconds: 900,
    minimumQuickLoginWaitSeconds: 60,
    waitIncrementSeconds: 60,
    quickLoginCheckMilliSeconds: 1000,
    maxDeltaTimeSeconds: 43200,
    failureFactor: 5,
    accessTokenLifespan: 3600,
    accessTokenLifespanForImplicitFlow: 900,
    ssoSessionIdleTimeout: 1800,
    ssoSessionMaxLifespan: 36000,
    offlineSessionIdleTimeout: 2592000,
    accessCodeLifespan: 60,
    accessCodeLifespanUserAction: 300,
    accessCodeLifespanLogin: 1800,
    actionTokenGeneratedByAdminLifespan: 43200,
    actionTokenGeneratedByUserLifespan: 300,
    defaultSignatureAlgorithm: 'RS256',
  }

  const response = await fetch(`${KEYCLOAK_BASE}/admin/realms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(realmConfig),
  })

  if (response.status === 409) {
    console.log('   ℹ️  Realm already exists')
    return
  }

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to create realm: ${response.status} - ${error}`)
  }

  console.log('✅ Realm created')
}

async function createClient(token) {
  console.log(`\n📱 Creating client: ${CLIENT_ID}`)
  
  const clientConfig = {
    clientId: CLIENT_ID,
    name: 'SPIS Frontend',
    description: 'SPIS Jamaica Frontend Application',
    enabled: true,
    publicClient: true,  // No client secret needed for password grant
    directAccessGrantsEnabled: true,  // Enable password grant (ROPC)
    standardFlowEnabled: true,
    implicitFlowEnabled: false,
    serviceAccountsEnabled: false,
    authorizationServicesEnabled: false,
    fullScopeAllowed: true,
    rootUrl: 'http://localhost:3000',
    baseUrl: '/',
    adminUrl: '',
    redirectUris: [
      'http://localhost:3000/*',
      'http://localhost:5173/*',
    ],
    webOrigins: [
      'http://localhost:3000',
      'http://localhost:5173',
    ],
    protocol: 'openid-connect',
    attributes: {
      'access.token.lifespan': '3600',
      'pkce.code.challenge.method': 'S256',
    },
    defaultClientScopes: [
      'openid',
      'profile',
      'email',
      'roles',
    ],
  }

  const response = await fetch(`${KEYCLOAK_BASE}/admin/realms/${REALM_NAME}/clients`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(clientConfig),
  })

  if (response.status === 409) {
    console.log('   ℹ️  Client already exists')
    return
  }

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to create client: ${response.status} - ${error}`)
  }

  console.log('✅ Client created')
}

async function createRoles(token) {
  console.log('\n👥 Creating realm roles...')
  
  for (const role of ROLES) {
    const response = await fetch(`${KEYCLOAK_BASE}/admin/realms/${REALM_NAME}/roles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: role.name,
        description: role.description,
        composite: false,
      }),
    })

    if (response.status === 409) {
      console.log(`   ℹ️  Role '${role.name}' already exists`)
      continue
    }

    if (!response.ok) {
      const error = await response.text()
      console.error(`   ❌ Failed to create role '${role.name}': ${error}`)
      continue
    }

    console.log(`   ✅ Created role: ${role.name}`)
  }
}

async function configureUserProfile(token) {
  console.log('\n👤 Configuring User Profile (making firstName/lastName optional)...')

  // Fetch current profile schema
  const getResp = await fetch(`${KEYCLOAK_BASE}/admin/realms/${REALM_NAME}/users/profile`, {
    headers: { 'Authorization': `Bearer ${token}` },
  })
  if (!getResp.ok) {
    console.warn('   ⚠️  Could not fetch user profile schema — skipping')
    return
  }
  const profile = await getResp.json()

  // Remove "required" entirely from firstName and lastName so VERIFY_PROFILE
  // won't block login for users created without personal names.
  // NOTE: empty object {} means "required for ALL roles" in Keycloak — must remove the key.
  // SPIS uses national IDs as identifiers — first/last names are optional.
  let changed = false
  for (const attr of profile.attributes ?? []) {
    if (attr.name === 'firstName' || attr.name === 'lastName') {
      if ('required' in attr) {
        delete attr.required    // remove the key entirely (not just empty it)
        changed = true
      }
    }
  }

  if (!changed) {
    console.log('   ℹ️  firstName/lastName already optional — skipping update')
    return
  }

  const putResp = await fetch(`${KEYCLOAK_BASE}/admin/realms/${REALM_NAME}/users/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(profile),
  })

  if (!putResp.ok) {
    const err = await putResp.text()
    console.warn(`   ⚠️  Could not update user profile schema: ${putResp.status} - ${err}`)
    return
  }

  console.log('✅ firstName and lastName are now optional (VERIFY_PROFILE won\'t block ROPC login)')
}

async function printJWKSInfo(token) {
  console.log('\n🔑 Fetching JWKS (Public Keys)...')
  
  const response = await fetch(`${KEYCLOAK_BASE}/realms/${REALM_NAME}/protocol/openid-connect/certs`)
  
  if (!response.ok) {
    console.log('   ⚠️  Could not fetch JWKS (realm might not exist yet)')
    return
  }

  const jwks = await response.json()
  
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('KEYCLOAK RS256 PUBLIC KEY INFO')
  console.log('═══════════════════════════════════════════════════════════')
  console.log(`JWKS Endpoint: ${KEYCLOAK_BASE}/realms/${REALM_NAME}/protocol/openid-connect/certs`)
  console.log(`Token Endpoint: ${KEYCLOAK_BASE}/realms/${REALM_NAME}/protocol/openid-connect/token`)
  console.log(`Issuer: ${KEYCLOAK_BASE}/realms/${REALM_NAME}`)
  console.log('')
  console.log('Public Keys:')
  
  for (const key of jwks.keys) {
    if (key.use === 'sig') {
      console.log(`  - Key ID (kid): ${key.kid}`)
      console.log(`    Algorithm: ${key.alg}`)
      console.log(`    Type: ${key.kty}`)
      console.log(`    Use: ${key.use}`)
      console.log(`    Modulus (n): ${key.n?.substring(0, 50)}...`)
      console.log('')
    }
  }
  
  console.log('═══════════════════════════════════════════════════════════')
  console.log('')
  console.log('HOW RS256 WORKS:')
  console.log('1. Keycloak signs tokens with PRIVATE KEY (never exposed)')
  console.log('2. Backend fetches PUBLIC KEY from JWKS endpoint above')
  console.log('3. Backend verifies signature: RSA_VERIFY(hash, sig, PUBLIC_KEY)')
  console.log('4. If valid → token is authentic and untampered')
  console.log('')
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗')
  console.log('║         KEYCLOAK SETUP FOR SPIS JAMAICA                  ║')
  console.log('╚═══════════════════════════════════════════════════════════╝')
  console.log('')
  console.log(`Keycloak URL: ${KEYCLOAK_BASE}`)
  console.log(`Realm: ${REALM_NAME}`)
  console.log(`Client: ${CLIENT_ID}`)
  console.log('')

  try {
    const token = await getAdminToken()
    
    // Quick check: if realm AND client already exist, skip full setup for faster boots
    const realmCheck = await fetch(`${KEYCLOAK_BASE}/admin/realms/${REALM_NAME}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (realmCheck.ok) {
      // Also verify the client exists (realm might exist but client setup could have failed)
      const clientCheck = await fetch(`${KEYCLOAK_BASE}/admin/realms/${REALM_NAME}/clients?clientId=${CLIENT_ID}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const clients = clientCheck.ok ? await clientCheck.json() : []
      if (clients.length > 0) {
        console.log(`ℹ️  Realm '${REALM_NAME}' + client '${CLIENT_ID}' already configured — skipping full setup`)
        await configureUserProfile(token)
        await printJWKSInfo(token)
        console.log('╔═══════════════════════════════════════════════════════════╗')
        console.log('║         SETUP COMPLETE! ✅  (realm already exists)        ║')
        console.log('╚═══════════════════════════════════════════════════════════╝')
        return
      }
      console.log(`ℹ️  Realm '${REALM_NAME}' exists but client '${CLIENT_ID}' missing — completing setup...`)
    }

    await createRealm(token)
    await createClient(token)
    await createRoles(token)
    await configureUserProfile(token)
    await printJWKSInfo(token)

    console.log('╔═══════════════════════════════════════════════════════════╗')
    console.log('║         SETUP COMPLETE! ✅                                ║')
    console.log('╚═══════════════════════════════════════════════════════════╝')
    console.log('')
    console.log('ℹ️  Shared Keycloak Architecture:')
    console.log('   All developers share the same Supabase PostgreSQL backend.')
    console.log('   Users, passwords, roles — everything is instantly shared.')
    console.log('   No sync scripts needed.')
    console.log('')
    console.log('Next steps:')
    console.log('1. Start the IAM service:  cd backend/iam-service && npm run dev')
    console.log('2. Manage users in Keycloak Admin Console:')
    console.log(`   URL: ${KEYCLOAK_BASE}/admin/master/console/#/${REALM_NAME}/users`)
    console.log('')

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message)
    console.log('')
    console.log('Make sure Keycloak is running:')
    console.log('  docker run -p 8080:8080 -e KEYCLOAK_ADMIN=admin -e KEYCLOAK_ADMIN_PASSWORD=admin quay.io/keycloak/keycloak:latest start-dev')
    process.exit(1)
  }
}

main()
