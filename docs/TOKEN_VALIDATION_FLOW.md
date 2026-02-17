# Keycloak Token Validation - Deep Dive

## Table of Contents
1. [Authentication Flow](#authentication-flow)
2. [Token Validation Process](#token-validation-process)
3. [JWKS Public Key Fetching](#jwks-public-key-fetching)
4. [Where Validation Happens](#where-validation-happens)
5. [Code Walkthrough](#code-walkthrough)
6. [Security Guarantees](#security-guarantees)

---

## Authentication Flow

### Step-by-Step Process

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │ 1. POST /iam/keycloak/login
       │    { national_id, password }
       ▼
┌─────────────────────────────────────────────────────────────┐
│  IAM Service (Backend)                                      │
│  File: backend/iam-service/src/routes/keycloakLogin.routes.ts│
├─────────────────────────────────────────────────────────────┤
│  • Receives login request                                   │
│  • Calls loginWithKeycloak()                                │
└──────┬──────────────────────────────────────────────────────┘
       │ 2. Forwards to Keycloak
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Keycloak Server (http://localhost:8080)                    │
│  File: backend/iam-service/src/lib/keycloak.ts              │
│  Function: authenticateUser()                               │
├─────────────────────────────────────────────────────────────┤
│  POST /realms/spis-dev/protocol/openid-connect/token       │
│                                                             │
│  Body:                                                      │
│    grant_type=password                                      │
│    client_id=frontend                                       │
│    username=12345678901234                                  │
│    password=userPass123                                     │
│    scope=openid profile email                               │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Keycloak Internal Process:                            │ │
│  │                                                        │ │
│  │ 1. Verify username exists                             │ │
│  │ 2. Validate password (bcrypt/argon2)                  │ │
│  │ 3. Load user roles from realm                         │ │
│  │ 4. Create JWT payload:                                │ │
│  │    {                                                  │ │
│  │      "sub": "keycloak-user-uuid",                     │ │
│  │      "email": "user@example.com",                     │ │
│  │      "preferred_username": "12345678901234",          │ │
│  │      "realm_access": {                                │ │
│  │        "roles": ["Citizen", "CaseWorker"]             │ │
│  │      },                                               │ │
│  │      "iat": 1708070400,                               │ │
│  │      "exp": 1708074000,                               │ │
│  │      "iss": "http://localhost:8080/realms/spis-dev"   │ │
│  │    }                                                  │ │
│  │                                                        │ │
│  │ 5. Fetch PRIVATE KEY from internal database           │ │
│  │ 6. Create JWT header:                                 │ │
│  │    {                                                  │ │
│  │      "alg": "RS256",                                  │ │
│  │      "typ": "JWT",                                    │ │
│  │      "kid": "nOo3ZD_Uh..."  ← Key ID                  │ │
│  │    }                                                  │ │
│  │                                                        │ │
│  │ 7. Sign Token (RS256):                                │ │
│  │    message = base64(header) + "." + base64(payload)   │ │
│  │    hash = SHA256(message)                             │ │
│  │    signature = RSA_SIGN(hash, PRIVATE_KEY)            │ │
│  │                                                        │ │
│  │ 8. Assemble JWT:                                      │ │
│  │    token = header.payload.signature                   │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  Returns:                                                   │
│  {                                                          │
│    "access_token": "eyJhbGciOiJSUzI1NiIs...",             │
│    "expires_in": 3600,                                      │
│    "refresh_token": "eyJhbGciOiJIUzI1NiIs...",            │
│    "token_type": "Bearer"                                   │
│  }                                                          │
└──────┬──────────────────────────────────────────────────────┘
       │ 3. Returns token to IAM Service
       ▼
┌─────────────────────────────────────────────────────────────┐
│  IAM Service                                                │
│  File: backend/iam-service/src/services/keycloakLogin.ts    │
├─────────────────────────────────────────────────────────────┤
│  • Receives Keycloak token                                  │
│  • Optionally verifies token (using public key)             │
│  • Fetches local permissions from IAM DB                    │
│  • Returns token + permissions to frontend                  │
└──────┬──────────────────────────────────────────────────────┘
       │ 4. Returns to frontend
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Frontend                                                   │
│  File: frontend/src/store/authStore.ts                      │
├─────────────────────────────────────────────────────────────┤
│  • Stores token in sessionStorage                           │
│  • Includes token in all API requests                       │
│  • Authorization: Bearer eyJhbGciOiJSUzI1NiIs...            │
└─────────────────────────────────────────────────────────────┘
```

---

## Token Validation Process

### Overview

Every API request that requires authentication goes through token validation:

```
┌─────────────┐
│  Frontend   │  Authorization: Bearer <token>
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend Service (Any service)                              │
│  Middleware: requireKeycloakAuth()                          │
│  File: backend/iam-service/src/middleware/keycloakAuth.ts   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Step 1: Extract Token                                     │
│  ────────────────────────                                  │
│  const authHeader = req.headers.authorization              │
│  const token = authHeader.slice(7) // Remove "Bearer "     │
│                                                             │
│  Step 2: Call verifyKeycloakToken()                        │
│  ───────────────────────────────────                       │
│  const decoded = await verifyKeycloakToken(token)          │
│                                                             │
└──────┬──────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  verifyKeycloakToken()                                      │
│  File: backend/iam-service/src/lib/keycloak.ts              │
│  Line: 145-162                                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  await jwtVerify(token, JWKS, {                             │
│    issuer: "http://localhost:8080/realms/spis-dev"         │
│  })                                                         │
│                                                             │
│  This calls jose library's jwtVerify() function            │
└──────┬──────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  jose Library (jwtVerify internals)                         │
│  Package: jose@5.x                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │ STEP 1: Parse JWT                                  │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  const [headerB64, payloadB64, signatureB64] =              │
│        token.split('.')                                     │
│                                                             │
│  header = JSON.parse(base64urlDecode(headerB64))           │
│  // { "alg": "RS256", "typ": "JWT", "kid": "nOo3ZD..." }   │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │ STEP 2: Fetch Public Key from JWKS                │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  kid = header.kid  // "nOo3ZD_Uh..."                       │
│                                                             │
│  // JWKS is RemoteJWKSet created at startup:               │
│  // const JWKS = createRemoteJWKSet(                        │
│  //   new URL('http://localhost:8080/realms/.../certs')    │
│  // )                                                       │
│                                                             │
└──────┬──────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  JWKS Fetch (if not cached)                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  GET http://localhost:8080/realms/spis-dev/                │
│      protocol/openid-connect/certs                          │
│                                                             │
│  Response:                                                  │
│  {                                                          │
│    "keys": [                                                │
│      {                                                      │
│        "kid": "nOo3ZD_Uh...",    ← Match this!             │
│        "kty": "RSA",                                        │
│        "alg": "RS256",                                      │
│        "use": "sig",                                        │
│        "n": "0vx7agoebGcCqqs...",  ← RSA modulus           │
│        "e": "AQAB"                  ← RSA exponent          │
│      }                                                      │
│    ]                                                        │
│  }                                                          │
│                                                             │
│  jose library:                                              │
│  • Caches JWKS for 10 minutes (default)                    │
│  • Finds key matching kid                                   │
│  • Constructs RSA public key from (n, e)                    │
│                                                             │
└──────┬──────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  RSA Public Key Construction                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  n = base64urlDecode("0vx7agoebGcCqqs...")                 │
│  e = base64urlDecode("AQAB")                                │
│                                                             │
│  publicKey = RSA_PUBLIC_KEY {                               │
│    modulus: n,    // Large prime number                     │
│    exponent: e    // Usually 65537 (0x010001)               │
│  }                                                          │
│                                                             │
└──────┬──────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Signature Verification (RS256)                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │ STEP 3: Reconstruct message                        │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  message = headerB64 + "." + payloadB64                     │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │ STEP 4: Hash the message                           │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  hash = SHA256(message)                                     │
│  // Output: 32 bytes (256 bits)                             │
│  // e.g., a1b2c3d4e5f6...                                   │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │ STEP 5: Decrypt signature with public key         │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  signature = base64urlDecode(signatureB64)                  │
│  // This is what Keycloak created with PRIVATE KEY          │
│                                                             │
│  decrypted = RSA_PUBLIC_DECRYPT(signature, publicKey)       │
│  // If signed with matching private key, decrypted == hash  │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │ STEP 6: Compare hashes                             │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  if (decrypted === hash) {                                  │
│    ✅ VALID: Token was signed by Keycloak's private key    │
│    ✅ UNTAMPERED: Payload hasn't been modified             │
│  } else {                                                   │
│    ❌ INVALID: Token is forged or tampered                 │
│  }                                                          │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │ STEP 7: Validate claims                            │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  payload = JSON.parse(base64urlDecode(payloadB64))         │
│                                                             │
│  • Check exp > Date.now()       (not expired)               │
│  • Check iss === expected       (from Keycloak)             │
│  • Check aud if required         (audience)                 │
│  • Check nbf <= Date.now()      (not before)                │
│                                                             │
│  if (all checks pass) {                                     │
│    return payload  // ✅ Token is VALID                     │
│  } else {                                                   │
│    throw JWTExpired / JWTInvalid                            │
│  }                                                          │
│                                                             │
└──────┬──────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Middleware: Attach user to request                         │
│  File: backend/iam-service/src/middleware/keycloakAuth.ts   │
│  Line: 88-97                                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  req.keycloakUser = {                                       │
│    sub: "keycloak-user-uuid",                               │
│    email: "user@example.com",                               │
│    preferred_username: "12345678901234",                    │
│    realm_access: {                                          │
│      roles: ["Citizen", "CaseWorker"]                       │
│    },                                                       │
│    permissions: [...] // from local DB                      │
│  }                                                          │
│                                                             │
│  next()  // Continue to route handler                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## JWKS Public Key Fetching

### How JWKS Works

```javascript
// File: backend/iam-service/src/lib/keycloak.ts
// Line: 133

const JWKS = createRemoteJWKSet(
  new URL('http://localhost:8080/realms/spis-dev/protocol/openid-connect/certs')
)
```

#### What `createRemoteJWKSet` Does:

1. **Creates a lazy loader** for public keys
2. **Fetches JWKS on first verification**
3. **Caches keys** for 10 minutes (configurable)
4. **Auto-refreshes** when cached keys expire
5. **Matches keys by `kid`** (Key ID from JWT header)

#### JWKS Endpoint Response:

```json
{
  "keys": [
    {
      "kid": "nOo3ZD_UhIDPKL6bUhCJT-KAMwQQpGBIHCpwJQ-fMz0",
      "kty": "RSA",
      "alg": "RS256",
      "use": "sig",
      "n": "0vx7agoebGcCqqsWwvi7GvJiMGBjPZDw0hW4M5dCqpQsSc9lDqQ...",
      "e": "AQAB",
      "x5c": ["MIIC..."],
      "x5t": "fYXx...",
      "x5t#S256": "3wkJ..."
    }
  ]
}
```

#### Key Components:

| Field | Description | Example |
|-------|-------------|---------|
| `kid` | Key ID - identifies which key to use | `"nOo3ZD_Uh..."` |
| `kty` | Key Type | `"RSA"` |
| `alg` | Algorithm | `"RS256"` |
| `use` | Usage | `"sig"` (signature) |
| `n` | RSA Modulus (Base64URL) | Large number |
| `e` | RSA Exponent (Base64URL) | Usually `65537` |

---

## Where Validation Happens

### 1. Admin Routes (IAM Service)

```typescript
// File: backend/iam-service/src/routes/admin.routes.ts
// Line: 22

adminRouter.use(
  requireKeycloakAuth({ fetchLocalPermissions: true }), 
  requireKeycloakRoles('SuperAdmin', 'Admin')
)
```

**All routes under `/iam/admin/*` validate token:**
- `GET /iam/admin/permissions`
- `GET /iam/admin/roles/:roleName/permissions`
- `POST /iam/admin/roles/:roleName/permissions`
- `DELETE /iam/admin/roles/:roleName/permissions/:permissionKey`

### 2. Protected Endpoints (Add middleware as needed)

```typescript
// Example: Protecting a route
router.get('/protected-data', 
  requireKeycloakAuth(),           // ← Validates token
  requireKeycloakRoles('Admin'),   // ← Checks role
  async (req, res) => {
    // req.keycloakUser is now available
    const user = req.keycloakUser
    // ... handler code
  }
)
```

### 3. Family Service (External)

```typescript
// File: backend/family-service/src/routes/auth.routes.ts
// For family service, you'd need to:

import { verifyKeycloakToken } from 'path-to-iam-keycloak-lib'

router.get('/auth/me', async (req, res) => {
  const token = req.headers.authorization?.slice(7)
  const decoded = await verifyKeycloakToken(token)
  // Use decoded.sub, decoded.email, etc.
})
```

---

## Code Walkthrough

### 1. Token Verification Entry Point

```typescript
// File: backend/iam-service/src/lib/keycloak.ts
// Lines: 145-162

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
```

**What happens here:**
1. `jwtVerify()` from jose library is called
2. Token is verified using public key from JWKS
3. Issuer claim is validated
4. If valid, returns decoded payload
5. If invalid, throws error (JWTExpired, JWTInvalid, etc.)

### 2. Middleware Integration

```typescript
// File: backend/iam-service/src/middleware/keycloakAuth.ts
// Lines: 50-106

export function requireKeycloakAuth(options?: { fetchLocalPermissions?: boolean }) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization
    
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Missing bearer token' },
      })
      return
    }

    const token = authHeader.slice(7)

    try {
      // ← THIS IS WHERE VALIDATION HAPPENS
      const decoded = await verifyKeycloakToken(token)

      // Extract roles from Keycloak token
      const roles = decoded.realm_access?.roles || []

      // Build user object
      const keycloakUser: Request['keycloakUser'] = {
        ...decoded,
        permissions: [],
      }

      // Optionally fetch local permissions from our DB
      if (options?.fetchLocalPermissions && decoded.sub) {
        try {
          const permissions = await getUserPermissions(decoded.sub)
          keycloakUser.permissions = permissions
        } catch {
          logger.warn('Could not fetch local permissions', { sub: decoded.sub })
        }
      }

      // Set both keycloakUser and legacy user for backwards compatibility
      req.keycloakUser = keycloakUser
      req.user = {
        sub: decoded.sub,
        national_id: decoded.preferred_username,
        email: decoded.email,
        roles: roles,
        permissions: keycloakUser.permissions,
      }

      next() // ← Continue to route handler
    } catch (err) {
      const message =
        (err as Error).name === 'JWTExpired'
          ? 'Token has expired'
          : (err as Error).message

      logger.warn('Keycloak JWT validation failed', { error: message })
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message },
      })
    }
  }
}
```

### 3. Role-Based Access Control

```typescript
// File: backend/iam-service/src/middleware/keycloakAuth.ts
// Lines: 111-128

export function requireKeycloakRoles(...requiredRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRoles = req.keycloakUser?.realm_access?.roles || req.user?.roles || []
    
    const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role))
    
    if (!hasRequiredRole) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Required roles: ${requiredRoles.join(' or ')}`,
        },
      })
      return
    }

    next()
  }
}
```

---

## Security Guarantees

### What RS256 Provides:

| Security Property | How It's Guaranteed |
|------------------|---------------------|
| **Authenticity** | Only Keycloak has the private key to create valid signatures |
| **Integrity** | Any modification to header/payload invalidates signature |
| **Non-repudiation** | Only Keycloak could have created the token |
| **Confidentiality** | ❌ JWT payload is NOT encrypted (use HTTPS) |
| **Distributed Verification** | Any service can verify using public key |
| **No Secret Sharing** | Private key never leaves Keycloak |

### Attack Scenarios:

#### ❌ Attack 1: Token Modification
```
Attacker changes: "roles": ["Citizen"]
             to: "roles": ["SuperAdmin"]

Result: Signature verification fails
Why: hash(modified_payload) ≠ decrypted_signature
```

#### ❌ Attack 2: Token Forgery
```
Attacker creates their own JWT with "roles": ["SuperAdmin"]

Result: Signature verification fails
Why: Attacker doesn't have Keycloak's private key
```

#### ❌ Attack 3: Algorithm Confusion
```
Attacker changes header: "alg": "RS256" → "alg": "none"

Result: jose library rejects "none" algorithm by default
```

#### ✅ Valid Token Flow
```
1. Token created by Keycloak with private key
2. Signature: RSA_SIGN(SHA256(header.payload), PRIVATE_KEY)
3. Backend verifies: RSA_VERIFY(signature, PUBLIC_KEY)
4. If valid → token is authentic and untampered
```

---

## Summary

### Validation Flow (TL;DR)

```
1. User logs in → Keycloak issues RS256 token (signed with PRIVATE KEY)
2. Frontend stores token in sessionStorage
3. Frontend includes token in every API request: Authorization: Bearer <token>
4. Backend middleware (requireKeycloakAuth) intercepts request
5. Middleware calls verifyKeycloakToken(token)
6. jose library:
   - Fetches public keys from JWKS endpoint (cached)
   - Finds matching key by kid
   - Verifies signature using public key
   - Validates claims (exp, iss, etc.)
7. If valid → req.keycloakUser populated → next()
8. If invalid → 401 Unauthorized response
```

### Key Files:

| File | Purpose |
|------|---------|
| `backend/iam-service/src/lib/keycloak.ts` | JWKS setup, token verification |
| `backend/iam-service/src/middleware/keycloakAuth.ts` | Middleware for validation |
| `backend/iam-service/src/services/keycloakLogin.ts` | Login service |
| `backend/iam-service/src/routes/admin.routes.ts` | Protected routes example |

### JWKS Endpoint:
```
http://localhost:8080/realms/spis-dev/protocol/openid-connect/certs
```

### Validation Happens:
- ✅ Every request to `/iam/admin/*`
- ✅ Any route using `requireKeycloakAuth()` middleware
- ✅ Manual calls to `verifyKeycloakToken()`
