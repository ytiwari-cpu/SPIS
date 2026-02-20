/**
 * Keycloak Admin Client
 * 
 * Handles all Keycloak admin operations:
 * - Get admin access token
 * - Create users in Keycloak
 * - Assign roles to users
 * - Authenticate users (password grant)
 * - Fetch JWKS public keys for token verification
 */

import { config } from '../config.js'
import { logger } from './logger.js'
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'

// ══════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════

export interface KeycloakTokenResponse {
  access_token: string
  expires_in: number
  refresh_token?: string
  refresh_expires_in?: number
  token_type: string
  scope?: string
}

export interface KeycloakUser {
  id: string
  username: string
  email?: string
  firstName?: string
  lastName?: string
  enabled: boolean
  emailVerified?: boolean
  attributes?: Record<string, string[]>
}

export interface KeycloakRole {
  id: string
  name: string
  description?: string
  composite?: boolean
}

export interface DecodedKeycloakToken extends JWTPayload {
  sub: string
  email?: string
  preferred_username?: string
  given_name?: string
  family_name?: string
  realm_access?: {
    roles: string[]
  }
  resource_access?: Record<string, { roles: string[] }>
  scope?: string
}

// ══════════════════════════════════════════════════════════════
// KEYCLOAK URLs
// ══════════════════════════════════════════════════════════════

const KEYCLOAK_BASE = config.keycloak.baseUrl
const REALM = config.keycloak.realm

const URLS = {
  // Token endpoints
  tokenEndpoint: `${KEYCLOAK_BASE}/realms/${REALM}/protocol/openid-connect/token`,
  adminTokenEndpoint: `${KEYCLOAK_BASE}/realms/master/protocol/openid-connect/token`,
  
  // Admin API
  usersEndpoint: `${KEYCLOAK_BASE}/admin/realms/${REALM}/users`,
  rolesEndpoint: `${KEYCLOAK_BASE}/admin/realms/${REALM}/roles`,
  
  // JWKS (Public Keys)
  jwksEndpoint: `${KEYCLOAK_BASE}/realms/${REALM}/protocol/openid-connect/certs`,
  
  // User info
  userInfoEndpoint: `${KEYCLOAK_BASE}/realms/${REALM}/protocol/openid-connect/userinfo`,
}

// ══════════════════════════════════════════════════════════════
// ADMIN TOKEN CACHE
// ══════════════════════════════════════════════════════════════

let cachedAdminToken: string | null = null
let adminTokenExpiry: number = 0

/**
 * Get Keycloak admin access token (with caching)
 */
async function getAdminToken(): Promise<string> {
  const now = Date.now()
  
  // Return cached token if still valid (with 60s buffer)
  if (cachedAdminToken && adminTokenExpiry > now + 60000) {
    return cachedAdminToken
  }

  logger.debug('Fetching new Keycloak admin token')

  const response = await fetch(URLS.adminTokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: config.keycloak.adminClientId,
      username: config.keycloak.adminUsername,
      password: config.keycloak.adminPassword,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    logger.error('Failed to get Keycloak admin token', { status: response.status, error: errorText })
    throw new Error(`Failed to get Keycloak admin token: ${response.status}`)
  }

  const data = await response.json() as KeycloakTokenResponse
  cachedAdminToken = data.access_token
  adminTokenExpiry = now + (data.expires_in * 1000)

  logger.debug('Keycloak admin token obtained', { expires_in: data.expires_in })
  return cachedAdminToken
}

// ══════════════════════════════════════════════════════════════
// JWKS PUBLIC KEY SET (for RS256 verification)
// ══════════════════════════════════════════════════════════════

// Create JWKS key set - jose library handles caching automatically
const JWKS = createRemoteJWKSet(new URL(URLS.jwksEndpoint))

/**
 * Verify a Keycloak RS256 JWT token using the JWKS public key
 * 
 * How it works:
 * 1. Token header contains `kid` (key ID) identifying which public key to use
 * 2. JWKS endpoint returns all public keys for the realm
 * 3. jose library fetches JWKS, caches it, and verifies signature
 * 4. RS256 = RSA signature with SHA-256 hash
 */
export async function verifyKeycloakToken(token: string): Promise<DecodedKeycloakToken> {
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `${KEYCLOAK_BASE}/realms/${REALM}`,
      // audience is optional - Keycloak uses 'account' or client_id
    })

    return payload as DecodedKeycloakToken
  } catch (error) {
    logger.warn('Keycloak token verification failed', { error: (error as Error).message })
    throw error
  }
}

// ══════════════════════════════════════════════════════════════
// USER AUTHENTICATION (Password Grant)
// ══════════════════════════════════════════════════════════════

/**
 * Authenticate user with Keycloak using Resource Owner Password Grant
 * 
 * Flow:
 * 1. Send username (national_id) + password to Keycloak token endpoint
 * 2. Keycloak validates credentials against its user store
 * 3. Keycloak signs JWT with its PRIVATE KEY (RS256)
 * 4. Returns access_token + refresh_token
 * 
 * The private key NEVER leaves Keycloak server.
 * Backend services verify tokens using PUBLIC KEY from JWKS endpoint.
 */
export async function authenticateUser(
  username: string,
  password: string
): Promise<KeycloakTokenResponse> {
  logger.debug('Authenticating user with Keycloak', { username })

  const response = await fetch(URLS.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: config.keycloak.frontendClientId,
      client_secret: config.keycloak.backendClientSecret || '',
      username,
      password,
      scope: 'openid profile email',
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as Record<string, unknown>
    let errorDesc = 'Authentication failed'
    if (typeof errorData.error_description === 'string') {
      errorDesc = errorData.error_description
    } else if (typeof errorData.error === 'string') {
      errorDesc = errorData.error
    }
    
    logger.warn('Keycloak authentication failed', { username, error: errorDesc })
    
    const err = new Error(errorDesc)
    ;(err as Error & { statusCode: number }).statusCode = 401
    throw err
  }

  const tokenData = await response.json() as KeycloakTokenResponse
  logger.info('User authenticated with Keycloak', { username })
  
  return tokenData
}

// ══════════════════════════════════════════════════════════════
// USER MANAGEMENT (Admin API)
// ══════════════════════════════════════════════════════════════

/**
 * Create a user in Keycloak
 */
export async function createKeycloakUser(params: {
  username: string  // Will be the national_id
  email: string
  firstName?: string
  lastName?: string
  password: string
  enabled?: boolean
  attributes?: Record<string, string[]>
}): Promise<string> {
  const adminToken = await getAdminToken()

  const userPayload = {
    username: params.username,
    email: params.email,
    firstName: params.firstName || '',
    lastName: params.lastName || '',
    enabled: params.enabled ?? true,
    emailVerified: true,
    attributes: params.attributes || {},
    credentials: [
      {
        type: 'password',
        value: params.password,
        temporary: false,
      },
    ],
  }

  logger.debug('Creating Keycloak user', { username: params.username, email: params.email })

  const response = await fetch(URLS.usersEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`,
    },
    body: JSON.stringify(userPayload),
  })

  if (!response.ok) {
    const errorText = await response.text()
    logger.error('Failed to create Keycloak user', { 
      username: params.username, 
      status: response.status, 
      error: errorText 
    })
    
    if (response.status === 409) {
      throw new Error('User already exists in Keycloak')
    }
    throw new Error(`Failed to create Keycloak user: ${response.status} - ${errorText}`)
  }

  // Get user ID from Location header
  const locationHeader = response.headers.get('Location')
  const userId = locationHeader?.split('/').pop() || ''
  
  logger.info('Keycloak user created', { username: params.username, userId })
  return userId
}

/**
 * Get user by username from Keycloak
 */
export async function getKeycloakUserByUsername(username: string): Promise<KeycloakUser | null> {
  const adminToken = await getAdminToken()

  const response = await fetch(`${URLS.usersEndpoint}?username=${encodeURIComponent(username)}&exact=true`, {
    headers: { 'Authorization': `Bearer ${adminToken}` },
  })

  if (!response.ok) {
    logger.error('Failed to fetch Keycloak user', { username, status: response.status })
    return null
  }

  const users = await response.json() as KeycloakUser[]
  return users.length > 0 ? users[0] : null
}

/**
 * Get available realm roles
 */
export async function getRealmRoles(): Promise<KeycloakRole[]> {
  const adminToken = await getAdminToken()

  const response = await fetch(URLS.rolesEndpoint, {
    headers: { 'Authorization': `Bearer ${adminToken}` },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch realm roles: ${response.status}`)
  }

  return response.json() as Promise<KeycloakRole[]>
}

/**
 * Assign realm role to user
 */
export async function assignRoleToUser(userId: string, roleName: string): Promise<void> {
  const adminToken = await getAdminToken()

  // First, get the role details
  const roleResponse = await fetch(`${URLS.rolesEndpoint}/${roleName}`, {
    headers: { 'Authorization': `Bearer ${adminToken}` },
  })

  if (!roleResponse.ok) {
    throw new Error(`Role '${roleName}' not found in Keycloak`)
  }

  const role = await roleResponse.json() as KeycloakRole

  // Assign role to user
  const assignResponse = await fetch(`${URLS.usersEndpoint}/${userId}/role-mappings/realm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`,
    },
    body: JSON.stringify([role]),
  })

  if (!assignResponse.ok) {
    const errorText = await assignResponse.text()
    throw new Error(`Failed to assign role: ${assignResponse.status} - ${errorText}`)
  }

  logger.info('Role assigned to Keycloak user', { userId, roleName })
}

/**
 * Update user password in Keycloak
 */
export async function updateKeycloakPassword(userId: string, newPassword: string): Promise<void> {
  const adminToken = await getAdminToken()

  const response = await fetch(`${URLS.usersEndpoint}/${userId}/reset-password`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      type: 'password',
      value: newPassword,
      temporary: false,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to update password: ${response.status} - ${errorText}`)
  }

  logger.info('Keycloak user password updated', { userId })
}

/**
 * Delete user from Keycloak
 */
export async function deleteKeycloakUser(userId: string): Promise<void> {
  const adminToken = await getAdminToken()

  const response = await fetch(`${URLS.usersEndpoint}/${userId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` },
  })

  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to delete Keycloak user: ${response.status}`)
  }

  logger.info('Keycloak user deleted', { userId })
}

// ══════════════════════════════════════════════════════════════
// EXPLANATION: RS256 Public/Private Key Flow
// ══════════════════════════════════════════════════════════════
/**
 * HOW RS256 (RSA + SHA-256) WORKS IN KEYCLOAK:
 * 
 * 1. KEY GENERATION (done by Keycloak during realm creation):
 *    - Keycloak generates RSA key pair (2048+ bits)
 *    - Private Key: Stored securely in Keycloak's internal database
 *    - Public Key: Exposed via JWKS endpoint (/.well-known/jwks.json)
 * 
 * 2. TOKEN SIGNING (when user authenticates):
 *    a. User sends credentials to Keycloak
 *    b. Keycloak validates credentials
 *    c. Keycloak creates JWT payload: { sub, email, roles, exp, iat, ... }
 *    d. Keycloak computes: hash = SHA256(base64(header) + "." + base64(payload))
 *    e. Keycloak signs: signature = RSA_SIGN(hash, PRIVATE_KEY)
 *    f. Returns: base64(header).base64(payload).base64(signature)
 * 
 * 3. TOKEN VERIFICATION (in backend services):
 *    a. Backend receives JWT in Authorization header
 *    b. Backend fetches public keys from Keycloak JWKS endpoint
 *    c. Backend extracts `kid` (key ID) from JWT header
 *    d. Backend finds matching public key from JWKS
 *    e. Backend computes: hash = SHA256(base64(header) + "." + base64(payload))
 *    f. Backend verifies: RSA_VERIFY(hash, signature, PUBLIC_KEY)
 *    g. If signature valid → token is authentic and untampered
 * 
 * 4. WHY THIS IS SECURE:
 *    - Private key NEVER leaves Keycloak server
 *    - Only Keycloak can create valid tokens
 *    - Anyone with public key can VERIFY but NOT CREATE tokens
 *    - If token is modified, signature becomes invalid
 * 
 * 5. JWKS ENDPOINT RESPONSE EXAMPLE:
 *    {
 *      "keys": [{
 *        "kid": "abc123",        // Key ID
 *        "kty": "RSA",           // Key type
 *        "alg": "RS256",         // Algorithm
 *        "use": "sig",           // Used for signatures
 *        "n": "0vx7agoebG...",   // RSA modulus (public key component)
 *        "e": "AQAB"             // RSA exponent (public key component)
 *      }]
 *    }
 * 
 * 6. JWT HEADER EXAMPLE:
 *    {
 *      "alg": "RS256",
 *      "typ": "JWT",
 *      "kid": "abc123"           // Tells which key to use for verification
 *    }
 */

export { URLS as KEYCLOAK_URLS }
