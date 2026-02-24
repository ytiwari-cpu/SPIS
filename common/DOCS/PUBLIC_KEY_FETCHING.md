# How Public Key Fetching Works

## Overview

The public key is fetched automatically by the `jose` library using the JWKS (JSON Web Key Set) endpoint. Let's trace through the entire process step by step.

---

## 1. JWKS Initialization (Module Load Time)

### File: `backend/iam-service/src/lib/keycloak.ts`
### Line: 133

```typescript
import { createRemoteJWKSet, jwtVerify } from 'jose'

// ...

const URLS = {
  // ...
  jwksEndpoint: `${KEYCLOAK_BASE}/realms/${REALM}/protocol/openid-connect/certs`,
  // For us: http://localhost:8080/realms/spis-dev/protocol/openid-connect/certs
}

// This runs when the module is first imported
const JWKS = createRemoteJWKSet(new URL(URLS.jwksEndpoint))
```

### What `createRemoteJWKSet` Does:

```
┌─────────────────────────────────────────────────────────────┐
│  createRemoteJWKSet(url)                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Returns: A function that fetches and caches JWKs          │
│                                                             │
│  Behavior:                                                  │
│  • LAZY LOADING: Does NOT fetch immediately                │
│  • Fetches ONLY when first token verification happens      │
│  • Caches keys for 10 minutes (600 seconds) by default     │
│  • Auto-refreshes on cache expiry                          │
│  • Thread-safe (prevents duplicate requests)               │
│                                                             │
│  Returns a function: (protectedHeader, token) => PublicKey │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Important:** At this point, **NO HTTP REQUEST** has been made yet. The JWKS object is just a promise-returning function waiting to be called.

---

## 2. Token Verification Triggers Key Fetch

### File: `backend/iam-service/src/lib/keycloak.ts`
### Lines: 145-162

```typescript
export async function verifyKeycloakToken(token: string): Promise<DecodedKeycloakToken> {
  try {
    // This is where the magic happens!
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `${KEYCLOAK_BASE}/realms/${REALM}`,
    })

    return payload as DecodedKeycloakToken
  } catch (error) {
    logger.warn('Keycloak token verification failed', { error: (error as Error).message })
    throw error
  }
}
```

### What Happens Inside `jwtVerify`:

```
┌─────────────────────────────────────────────────────────────┐
│  jwtVerify(token, JWKS, options)                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Step 1: Parse JWT Header                                  │
│  ─────────────────────────                                 │
│  token = "eyJhbGci...eyJzdWI...signature"                  │
│  [headerB64, payloadB64, signatureB64] = token.split('.')  │
│                                                             │
│  header = base64urlDecode(headerB64)                        │
│  // Result:                                                 │
│  // {                                                       │
│  //   "alg": "RS256",                                       │
│  //   "typ": "JWT",                                         │
│  //   "kid": "nOo3ZD_UhIDPKL6bUhCJT-KAMwQQpGBIHCpwJQ-fMz0" │
│  // }                                                       │
│                                                             │
│  Step 2: Extract Key ID                                    │
│  ───────────────────────                                   │
│  kid = header.kid  // "nOo3ZD_UhIDPKL6bUhCJT..."           │
│                                                             │
│  Step 3: Call JWKS Function                                │
│  ───────────────────────────                               │
│  publicKey = await JWKS(header, token)                     │
│                                                             │
│  ← THIS TRIGGERS THE HTTP REQUEST TO KEYCLOAK              │
│                                                             │
└──────┬──────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  JWKS Internal Logic (jose library)                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  if (cacheIsValid && cacheHasKey(kid)) {                    │
│    return cachedKey  // ← Cache hit, no HTTP request       │
│  }                                                          │
│                                                             │
│  // Cache miss or expired - fetch from Keycloak            │
│  console.log('Fetching JWKS from:', jwksUrl)               │
│  const response = await fetch(jwksUrl)                     │
│  const jwks = await response.json()                        │
│                                                             │
└──────┬──────────────────────────────────────────────────────┘
       │
       ▼
```

---

## 3. HTTP Request to Keycloak JWKS Endpoint

### Request:
```http
GET /realms/spis-dev/protocol/openid-connect/certs HTTP/1.1
Host: localhost:8080
Accept: application/json
```

### Response:
```json
{
  "keys": [
    {
      "kid": "nOo3ZD_UhIDPKL6bUhCJT-KAMwQQpGBIHCpwJQ-fMz0",
      "kty": "RSA",
      "alg": "RS256",
      "use": "sig",
      "n": "0vx7agoebGcCqqsWwvi7GvJiMGBjPZDw0hW4M5dCqpQsSc9lDqQ6Wn8_gqLZoLQx-rQeOsJnH0k8z-vNqJ_HVrYRnk6kYwZWaT6c8jJKf7PzVJmkXVdYRvKWqt3pU5QiZEkNNFnLXIDQqNr9GUPgKsLqFLKzDdqQ6-0r8qMp3sP3MdP9RVJDX9fVKqLj6QpJqLYBWJqYpH-QqJ_0Qp3MqDLKqJ-Q0q3QqQpJ6Q0qLJ6Q0",
      "e": "AQAB",
      "x5c": [
        "MIICnTCCAYUCBgGNH..."
      ],
      "x5t": "fYXxpE5i9M8...",
      "x5t#S256": "3wkJqTGD..."
    },
    {
      "kid": "OLD_KEY_ID_xyz123",
      "kty": "RSA",
      "alg": "RS256",
      "use": "sig",
      "n": "old_key_modulus...",
      "e": "AQAB"
    }
  ]
}
```

**Note:** Multiple keys are returned to support **key rotation**. Old keys remain available for a grace period.

---

## 4. Key Matching and Selection

```
┌─────────────────────────────────────────────────────────────┐
│  JWKS Key Selection Logic                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  const jwks = {                                             │
│    keys: [                                                  │
│      { kid: "nOo3ZD_Uh...", n: "...", e: "..." },          │
│      { kid: "OLD_KEY_xyz", n: "...", e: "..." }            │
│    ]                                                        │
│  }                                                          │
│                                                             │
│  // JWT header has:                                         │
│  header.kid = "nOo3ZD_Uh..."                                │
│                                                             │
│  // Find matching key:                                      │
│  const matchingKey = jwks.keys.find(key => key.kid === header.kid) │
│                                                             │
│  if (!matchingKey) {                                        │
│    throw new Error('Unable to find matching key')          │
│  }                                                          │
│                                                             │
│  // Extract RSA components:                                 │
│  const n = base64urlDecode(matchingKey.n)  // Modulus       │
│  const e = base64urlDecode(matchingKey.e)  // Exponent      │
│                                                             │
└──────┬──────────────────────────────────────────────────────┘
       │
       ▼
```

---

## 5. Public Key Construction

```
┌─────────────────────────────────────────────────────────────┐
│  RSA Public Key Construction from JWK                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Input JWK:                                                 │
│  {                                                          │
│    "n": "0vx7agoebGcCqqs...",  // Base64URL encoded        │
│    "e": "AQAB"                  // Base64URL encoded        │
│  }                                                          │
│                                                             │
│  Step 1: Decode Base64URL                                  │
│  ─────────────────────────                                 │
│  n_bytes = base64urlDecode("0vx7agoebGcCqqs...")           │
│  // Result: 256-byte buffer (for 2048-bit RSA)             │
│  // e.g., [0x0v, 0x07, 0xf3, 0x6a, 0x82, ...]              │
│                                                             │
│  e_bytes = base64urlDecode("AQAB")                          │
│  // Result: [0x01, 0x00, 0x01]                             │
│  // Converts to integer: 65537                             │
│                                                             │
│  Step 2: Construct RSA Public Key Object                   │
│  ────────────────────────────────────────                  │
│  publicKey = createPublicKey({                              │
│    key: {                                                   │
│      kty: 'RSA',                                            │
│      n: n_bytes,                                            │
│      e: e_bytes                                             │
│    },                                                       │
│    format: 'jwk'                                            │
│  })                                                         │
│                                                             │
│  // This creates a Node.js KeyObject:                       │
│  // - Type: 'public'                                        │
│  // - Algorithm: 'RSA'                                      │
│  // - Can be used with crypto.verify()                      │
│                                                             │
└──────┬──────────────────────────────────────────────────────┘
       │
       ▼
```

---

## 6. Caching Mechanism

```
┌─────────────────────────────────────────────────────────────┐
│  JWKS Caching Strategy (jose library)                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Cache Key: JWKS endpoint URL                               │
│  Cache Value: { keys: [...], fetchedAt: timestamp }        │
│  Cache TTL: 10 minutes (600 seconds) - configurable        │
│                                                             │
│  Timeline:                                                  │
│  ────────────────────────────────────────────────────────  │
│                                                             │
│  T = 0:00    First token verification                      │
│              → Fetch JWKS from Keycloak                     │
│              → Cache keys with timestamp                    │
│                                                             │
│  T = 0:01    Second token verification                     │
│              → Check cache (valid, < 10 min old)           │
│              → Use cached key                               │
│              → NO HTTP REQUEST                              │
│                                                             │
│  T = 0:02    Third token verification                      │
│              → Use cached key                               │
│              → NO HTTP REQUEST                              │
│                                                             │
│  ...         (many requests)                                │
│              → All use cached keys                          │
│              → NO HTTP REQUESTS                             │
│                                                             │
│  T = 10:01   Token verification after 10 minutes           │
│              → Cache expired                                │
│              → Fetch JWKS again                             │
│              → Update cache                                 │
│                                                             │
│  Benefits:                                                  │
│  • Reduces load on Keycloak                                │
│  • Faster verification (no network latency)                │
│  • Automatic refresh ensures new keys are picked up        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  Token Verification Request                                 │
└──────┬──────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  verifyKeycloakToken(token)                                 │
│  → jwtVerify(token, JWKS, {...})                            │
└──────┬──────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  JWKS Function Called                                       │
│  → JWKS(protectedHeader, token)                             │
└──────┬──────────────────────────────────────────────────────┘
       │
       ▼
       ┌──────────────────────┐
       │  Is cache valid?     │
       └──────┬───────────────┘
              │
        Yes   │   No
      ────────┴────────
     │                 │
     ▼                 ▼
┌─────────┐    ┌──────────────────────────────────┐
│ Return  │    │ HTTP GET Request                 │
│ cached  │    │                                  │
│ key     │    │ GET /realms/spis-dev/            │
│         │    │     protocol/openid-connect/certs│
└─────────┘    └──────┬───────────────────────────┘
                      │
                      ▼
               ┌──────────────────────────────────┐
               │ Parse JWKS Response              │
               │ {                                │
               │   "keys": [...]                  │
               │ }                                │
               └──────┬───────────────────────────┘
                      │
                      ▼
               ┌──────────────────────────────────┐
               │ Find key by kid                  │
               │ key = keys.find(k => k.kid ===   │
               │                 header.kid)       │
               └──────┬───────────────────────────┘
                      │
                      ▼
               ┌──────────────────────────────────┐
               │ Construct RSA Public Key         │
               │ from n (modulus) and e (exponent)│
               └──────┬───────────────────────────┘
                      │
                      ▼
               ┌──────────────────────────────────┐
               │ Cache key for 10 minutes         │
               └──────┬───────────────────────────┘
                      │
                      ▼
               ┌──────────────────────────────────┐
               │ Return PublicKey                 │
               └──────────────────────────────────┘
```

---

## 8. Code Example: Manual Key Fetching

If you wanted to manually fetch and inspect the public keys:

```typescript
// File: backend/iam-service/test-jwks.ts

import fetch from 'node-fetch'

async function fetchJWKS() {
  const url = 'http://localhost:8080/realms/spis-dev/protocol/openid-connect/certs'
  
  console.log('Fetching JWKS from:', url)
  const response = await fetch(url)
  const jwks = await response.json()
  
  console.log('JWKS Response:')
  console.log(JSON.stringify(jwks, null, 2))
  
  // Extract first key
  const firstKey = jwks.keys[0]
  console.log('\nFirst Key Details:')
  console.log('- Key ID (kid):', firstKey.kid)
  console.log('- Algorithm:', firstKey.alg)
  console.log('- Modulus length:', firstKey.n.length, 'chars')
  console.log('- Exponent:', firstKey.e)
  
  return jwks
}

fetchJWKS().catch(console.error)
```

**Run it:**
```bash
cd backend/iam-service
npx tsx test-jwks.ts
```

---

## 9. Configuration Options

You can customize the JWKS fetching behavior:

```typescript
import { createRemoteJWKSet } from 'jose'

const JWKS = createRemoteJWKSet(
  new URL('http://localhost:8080/realms/spis-dev/protocol/openid-connect/certs'),
  {
    cooldownDuration: 30000,  // Wait 30s before refetching after error
    cacheMaxAge: 600000,      // Cache for 10 minutes (default)
    timeoutDuration: 5000,    // HTTP request timeout: 5 seconds
  }
)
```

---

## 10. Key Rotation Handling

```
Keycloak Key Rotation Scenario:
────────────────────────────────

Day 1:
  Active Key: kid = "KEY_2024_01"
  Tokens signed with: KEY_2024_01

Day 2 (rotation happens):
  Active Key: kid = "KEY_2024_02"  ← New key starts signing
  Old Key: kid = "KEY_2024_01"     ← Still in JWKS for grace period
  
  JWKS returns both keys:
  {
    "keys": [
      { "kid": "KEY_2024_02", ... },  ← New
      { "kid": "KEY_2024_01", ... }   ← Old (still valid)
    ]
  }
  
  • Old tokens (signed with KEY_2024_01) still work
  • New tokens (signed with KEY_2024_02) work
  • No downtime!

Day 7 (grace period ends):
  JWKS only returns: KEY_2024_02
  Old tokens with KEY_2024_01 fail (expected)
```

**Our Implementation Handles This Automatically:**
- `JWKS` function fetches ALL keys from endpoint
- Matches by `kid` - works with both old and new keys
- Cache refresh picks up new keys
- No code changes needed!

---

## Summary

### How Public Key Fetching Works:

1. **Module Load**: `JWKS = createRemoteJWKSet(url)` creates lazy loader
2. **First Verification**: `jwtVerify()` triggers HTTP GET to JWKS endpoint
3. **Parse Response**: Extract all public keys from JSON response
4. **Match Key**: Find key matching `kid` from JWT header
5. **Construct Key**: Create RSA public key from `n` and `e` components
6. **Cache**: Store keys for 10 minutes
7. **Subsequent Requests**: Use cached keys (no HTTP request)
8. **Cache Expiry**: After 10 minutes, refetch from Keycloak

### Key Points:

- ✅ **Lazy Loading**: No fetch until first token verification
- ✅ **Automatic Caching**: 10-minute cache reduces load
- ✅ **Key Rotation**: Supports multiple keys simultaneously
- ✅ **Thread-Safe**: jose library handles concurrency
- ✅ **Error Handling**: Auto-retry with cooldown on failures
- ✅ **Zero Configuration**: Works out of the box

### Where It Happens:

| File | Line | What |
|------|------|------|
| `backend/iam-service/src/lib/keycloak.ts` | 133 | JWKS initialization |
| `backend/iam-service/src/lib/keycloak.ts` | 148 | Token verification |
| `jose` library internals | N/A | HTTP fetch, caching, key selection |

### JWKS Endpoint:
```
http://localhost:8080/realms/spis-dev/protocol/openid-connect/certs
```
