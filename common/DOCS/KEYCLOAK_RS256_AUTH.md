# Keycloak RS256 Authentication - Complete Guide

## Overview

This project uses **Keycloak** for authentication with **RS256** (RSA + SHA-256) signed JWT tokens.

```
┌─────────────┐    1. Login Request     ┌─────────────┐
│   Frontend  │ ─────────────────────── │ IAM Service │
│             │    (national_id, pass)  │             │
└─────────────┘                         └──────┬──────┘
                                               │
                                               │ 2. Password Grant
                                               ▼
                                        ┌─────────────┐
                                        │  Keycloak   │
                                        │             │
                                        │  Signs JWT  │
                                        │  with       │
                                        │  PRIVATE    │
                                        │  KEY        │
                                        └──────┬──────┘
                                               │
                                               │ 3. RS256 Token
                                               ▼
┌─────────────┐    4. API Request       ┌─────────────┐
│   Frontend  │ ─────────────────────── │   Backend   │
│             │    Bearer <token>       │   Service   │
└─────────────┘                         └──────┬──────┘
                                               │
                                               │ 5. Fetch JWKS
                                               ▼
                                        ┌─────────────┐
                                        │  Keycloak   │
                                        │  JWKS       │
                                        │  Endpoint   │
                                        │             │
                                        │  PUBLIC     │
                                        │  KEYS       │
                                        └─────────────┘
```

## RS256 (RSA + SHA-256) Explained

### What is RS256?

RS256 is an **asymmetric** digital signature algorithm:
- **RSA**: The cryptographic algorithm (Rivest–Shamir–Adleman)
- **SHA-256**: The hash function used before signing
- **256-bit**: The signature size

### Key Pair

```
┌─────────────────────────────────────────────────────────────┐
│                    KEY GENERATION                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Keycloak generates RSA key pair (2048+ bits):              │
│                                                             │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │   PRIVATE KEY   │    │   PUBLIC KEY    │                │
│  │                 │    │                 │                │
│  │  - Stored in    │    │  - Exposed via  │                │
│  │    Keycloak DB  │    │    JWKS endpoint│                │
│  │  - NEVER shared │    │  -   │                │
│  │                 │    │  - Verifi Anyone can   │                │
│  │  - Signs tokens │    │    download  es     │                │
│  │                 │    │    tokens       │                │
│  └─────────────────┘    └─────────────────┘                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Token Signing Process

```
STEP 1: CREATE JWT HEADER & PAYLOAD
══════════════════════════════════════════════════════════════

Header:
{
  "alg": "RS256",      ← Algorithm
  "typ": "JWT",        ← Token type
  "kid": "abc123xyz"   ← Key ID (which public key to use)
}

Payload:
{
  "sub": "user-uuid-123",
  "email": "user@example.com",
  "preferred_username": "12345678901234",
  "realm_access": {
    "roles": ["Citizen", "CaseWorker"]
  },
  "iat": 1708070400,    ← Issued at
  "exp": 1708074000,    ← Expires at
  "iss": "http://localhost:8080/realms/spis-dev"
}


STEP 2: ENCODE (Base64URL)
══════════════════════════════════════════════════════════════

header_b64 = base64url(header)
           = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImFiYzEyM3h5eiJ9"

payload_b64 = base64url(payload)
            = "eyJzdWIiOiJ1c2VyLXV1aWQtMTIzIiwiZW1haWwiOiJ1c2VyQGV4YW1..."


STEP 3: CREATE SIGNATURE (RS256)
══════════════════════════════════════════════════════════════

message = header_b64 + "." + payload_b64

hash = SHA256(message)
     = a1b2c3d4e5f6...  (32 bytes)

signature = RSA_SIGN(hash, PRIVATE_KEY)
          = x9y8z7w6v5u4...  (256 bytes)

signature_b64 = base64url(signature)


STEP 4: ASSEMBLE JWT
══════════════════════════════════════════════════════════════

token = header_b64 + "." + payload_b64 + "." + signature_b64

     = eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImFiYzEyM3h5eiJ9.
       eyJzdWIiOiJ1c2VyLXV1aWQtMTIzIiwiZW1haWwiOiJ1c2VyQGV4YW1wbGUuY29...
       SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

### Token Verification Process

```
STEP 1: SPLIT TOKEN
══════════════════════════════════════════════════════════════

[header_b64, payload_b64, signature_b64] = token.split(".")


STEP 2: DECODE HEADER
══════════════════════════════════════════════════════════════

header = base64url_decode(header_b64)
       = { "alg": "RS256", "typ": "JWT", "kid": "abc123xyz" }


STEP 3: FETCH PUBLIC KEY (JWKS)
══════════════════════════════════════════════════════════════

GET http://localhost:8080/realms/spis-dev/protocol/openid-connect/certs

Response:
{
  "keys": [
    {
      "kid": "abc123xyz",    ← Match with JWT header
      "kty": "RSA",
      "alg": "RS256",
      "use": "sig",
      "n": "0vx7agoebGc...", ← RSA modulus (public key)
      "e": "AQAB"            ← RSA exponent (public key)
    }
  ]
}


STEP 4: CONSTRUCT PUBLIC KEY
══════════════════════════════════════════════════════════════

public_key = RSA_PUBLIC_KEY(n, e)


STEP 5: VERIFY SIGNATURE
══════════════════════════════════════════════════════════════

message = header_b64 + "." + payload_b64

hash = SHA256(message)

decrypted_sig = RSA_PUBLIC_DECRYPT(signature, public_key)

IF hash === decrypted_sig:
    → Token is VALID (authentic and untampered)
ELSE:
    → Token is INVALID (rejected)


STEP 6: VALIDATE CLAIMS
══════════════════════════════════════════════════════════════

- Check `exp` > current_time (not expired)
- Check `iss` === expected issuer (from Keycloak)
- Check `aud` if required
```

## JWKS Endpoint

The JSON Web Key Set (JWKS) endpoint exposes Keycloak's public keys:

```
GET http://localhost:8080/realms/spis-dev/protocol/openid-connect/certs

Response:
{
  "keys": [
    {
      "kid": "nOo3ZD...",     // Key ID - matches JWT header
      "kty": "RSA",           // Key Type
      "alg": "RS256",         // Algorithm
      "use": "sig",           // Usage (signature)
      "n": "0vx7agoe...",     // Modulus (Base64URL)
      "e": "AQAB",            // Exponent (Base64URL)
      "x5c": ["MIIC..."],     // X.509 Certificate chain
      "x5t": "fYX...",        // X.509 thumbprint
      "x5t#S256": "..."       // X.509 SHA-256 thumbprint
    }
  ]
}
```

## Why RS256 Over HS256?

| Aspect | HS256 (Symmetric) | RS256 (Asymmetric) |
|--------|-------------------|---------------------|
| **Key** | Single shared secret | Public/Private key pair |
| **Security** | Secret must be shared | Private key never leaves issuer |
| **Verification** | Only trusted parties | Anyone with public key |
| **Use Case** | Single service | Distributed microservices |
| **Performance** | Faster | Slower (RSA ops) |
| **Rotation** | Difficult | Easy (publish new public key) |

## Setup Instructions

### 1. Start Keycloak

```bash
# Using Docker Compose
docker-compose -f docker-compose.keycloak.yml up -d

# Or standalone Docker
docker run -d --name keycloak \
  -p 8080:8080 \
  -e KEYCLOAK_ADMIN=admin \
  -e KEYCLOAK_ADMIN_PASSWORD=admin \
  quay.io/keycloak/keycloak:24.0 start-dev
```

### 2. Setup Realm and Client

```bash
cd backend/iam-service
node setup-keycloak.mjs
```

### 3. Sync Users (Optional)

```bash
node sync-users-to-keycloak.mjs
```

### 4. Test Login

```bash
# Using Keycloak login endpoint
curl -X POST http://localhost:3003/iam/keycloak/login \
  -H "Content-Type: application/json" \
  -d '{"national_id": "12345678901234", "password": "password123"}'
```

## API Endpoints

### Login (Keycloak RS256)
```
POST /iam/keycloak/login
Body: { "national_id": "...", "password": "..." }
Returns: RS256 signed access_token
```

### Login (Legacy HS256)
```
POST /iam/login
Body: { "national_id": "...", "password": "..." }
Returns: HS256 signed access_token
```

### JWKS Info
```
GET /iam/keycloak/jwks-info
Returns: JWKS endpoint URL and explanation
```

## Security Considerations

1. **Private Key Protection**: Keycloak's private key is stored encrypted in its database
2. **Key Rotation**: Keycloak supports automatic key rotation
3. **HTTPS**: Always use HTTPS in production
4. **Token Lifetime**: Default 1 hour, configurable
5. **Refresh Tokens**: Keycloak issues refresh tokens for session extension

## Code References

- Keycloak Client: `backend/iam-service/src/lib/keycloak.ts`
- Login Service: `backend/iam-service/src/services/keycloakLogin.ts`
- Auth Middleware: `backend/iam-service/src/middleware/keycloakAuth.ts`
- Login Route: `backend/iam-service/src/routes/keycloakLogin.routes.ts`
