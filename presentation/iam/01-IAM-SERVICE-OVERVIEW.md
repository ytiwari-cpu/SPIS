# IAM Service - Complete Documentation

## Service Overview

**Port:** 3003  
**Purpose:** Identity and Access Management - Authentication, Authorization, User Management  
**Database:** Supabase PostgreSQL (iam schema)

---

## Core Responsibilities

### 1. Authentication
- Password-based login
- OTP-based login (passwordless)
- Multi-factor authentication (MFA)
- Session management with JWT

### 2. User Management
- User account creation
- User status management (active, pending, disabled, locked)
- Password hashing and verification
- Failed login tracking and account lockout

### 3. Authorization
- Role-based access control (RBAC)
- Permission management
- Role assignment
- Permission querying

### 4. Security Features
- National ID hashing (SHA-256)
- Password hashing (bcrypt)
- OTP generation and validation
- Login event auditing
- Rate limiting

---

## Development Journey - IAM Service

### Phase 1: OTP Login System Implementation

**User Request:**
> "I want two types of login - one with OTP and other with password. For OTP login, search users table first, if not found then search family_member table, and auto-create user if found."

**Challenge:**
This was the most complex feature because it required:
1. Cross-service communication (IAM ↔ Family Service)
2. Auto-user creation logic
3. Different behavior from password reset
4. Email integration
5. Frontend UI changes
6. JWT token generation
7. Session management

**Implementation Steps:**

#### Step 1: Design the Flow

**OTP Login Flow:**
```
User enters National ID
         ↓
Hash National ID (SHA-256)
         ↓
Search users table by hash
         ↓
    Found? ─── YES → Generate OTP
         |           ↓
        NO          Save OTP to database
         |           ↓
         ↓          Send email via Email Service
Call Registry/Family Service              ↓
         ↓          User receives email
Search family_member table              ↓
         ↓          User enters OTP
    Found? ─── YES → Validate OTP
         |           ↓
        NO      Mark OTP as used
         |           ↓
         ↓      Activate user (if pending)
Return "Not Found"                      ↓
                   Generate JWT with all claims
                            ↓
                   Return access token
```

**Key Decision Points:**
1. **Where to search first?** Users table (performance)
2. **What if not in users?** Check family_member via Registry service
3. **Create user or reject?** Create with 'pending' status
4. **What email to use?** From family_member data, or temp email
5. **When to activate?** On successful OTP verification
6. **What to include in JWT?** national_id is critical!

#### Step 2: Create OTP Service

**File:** `/backend/iam-service/src/services/otpLogin.ts`

**Key Functions:**

**1. Request OTP Login**
```typescript
export async function requestOtpLogin(nationalId: string): Promise<OtpLoginRequestResult> {
  logger.info('OTP login requested', { national_id: nationalId })
  
  const nationalIdHash = hashNationalId(nationalId)
  
  // Step 1: Check if user already exists
  let user = await getUserByNationalIdHash(nationalIdHash)
  let isNewUser = false
  
  // Step 2: If not found, check Registry/Family Member table
  if (!user) {
    logger.info('User not found in IAM, checking family_member table', { 
      national_id: nationalId 
    })
    
    try {
      // Call Registry service to look up by national_id
      const registryData = await lookupByNationalId(nationalId)
      
      if (!registryData) {
        logger.warn('National ID not found in any system', { national_id: nationalId })
        const err = new Error('National ID not registered in the system')
        ;(err as Error & { statusCode: number }).statusCode = 404
        throw err
      }
      
      logger.info('Found in family_member, creating new user', { 
        national_id: nationalId,
        registry_id: registryData.registry_id,
      })
      
      // Step 3: Create new user account
      const email = registryData.email || `${nationalId}@temp.spis.gov`
      const userId = await createUser({
        nationalIdHash,
        email,
        status: 'pending', // Will be activated on OTP verification
        registryId: registryData.registry_id,
      })
      
      // Step 4: Assign default citizen role
      await addRole(userId, 'citizen')
      
      // Step 5: Fetch the newly created user
      user = await getUserByNationalIdHash(nationalIdHash)
      isNewUser = true
      
      logger.info('New user created successfully', { user_id: userId })
    } catch (error: any) {
      logger.error('Error looking up or creating user', { 
        error: error.message,
        national_id: nationalId,
      })
      throw error
    }
  }
  
  // Step 6: Check if user is locked
  if (user.status === 'locked') {
    const err = new Error('Account is locked. Please contact support.')
    ;(err as Error & { statusCode: number }).statusCode = 423
    throw err
  }
  
  if (user.status === 'disabled') {
    const err = new Error('Account is disabled. Please contact support.')
    ;(err as Error & { statusCode: number }).statusCode = 403
    throw err
  }
  
  // Step 7: Generate OTP (6-digit code)
  const otp = generateOtp(6)
  
  // Step 8: Save OTP token to database
  const tokenId = await saveOtpToken({
    userId: user.user_id,
    token: otp,
    purpose: 'otp_login',
    expiresInMinutes: 10,
  })
  
  // Step 9: Send OTP via email
  try {
    await sendEmail({
      to: user.email,
      subject: 'Your SPIS Login Code',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .code { 
              font-size: 36px; 
              font-weight: bold; 
              letter-spacing: 8px; 
              color: #2563eb;
              text-align: center;
              padding: 20px;
              background: #f3f4f6;
              border-radius: 8px;
              margin: 20px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Your SPIS Login Code</h2>
            <p>Use this code to log in to your SPIS account:</p>
            <div class="code">${otp}</div>
            <p><strong>This code expires in 10 minutes.</strong></p>
            <p>If you didn't request this code, please ignore this email.</p>
            <hr>
            <p style="color: #666; font-size: 12px;">
              This is an automated message from SPIS (Social Protection Information System).
            </p>
          </div>
        </body>
        </html>
      `,
    })
    
    logger.info('OTP email sent successfully', { 
      user_id: user.user_id,
      email: maskEmail(user.email),
    })
  } catch (emailError: any) {
    logger.error('Failed to send OTP email', { 
      error: emailError.message,
      user_id: user.user_id,
    })
    // Don't fail the request, OTP is still in database
  }
  
  // Step 10: Return success response
  return {
    otp_id: tokenId,
    message: 'OTP sent to your registered email address',
    email_hint: maskEmail(user.email),
    is_new_user: isNewUser,
  }
}
```

**2. Verify OTP Login**
```typescript
export async function verifyOtpLogin(params: {
  nationalId: string
  otp: string
  ip: string
  userAgent: string
}): Promise<OtpLoginVerifyResult> {
  const { nationalId, otp, ip, userAgent } = params
  
  logger.info('OTP verification attempt', { national_id: nationalId })
  
  const nationalIdHash = hashNationalId(nationalId)
  
  // Step 1: Get user by national ID
  const user = await getUserByNationalIdHash(nationalIdHash)
  
  if (!user) {
    logger.warn('User not found during OTP verification', { national_id: nationalId })
    const err = new Error('User not found')
    ;(err as Error & { statusCode: number }).statusCode = 404
    throw err
  }
  
  // Step 2: Verify OTP token
  const token = await getValidOtpToken({
    userId: user.user_id,
    token: otp,
    purpose: 'otp_login',
  })
  
  if (!token) {
    logger.warn('Invalid or expired OTP', { 
      user_id: user.user_id,
      national_id: nationalId,
    })
    
    // Record failed login
    await recordLoginEvent({
      userId: user.user_id,
      ip,
      userAgent,
      outcome: 'failed',
    })
    
    const err = new Error('Invalid or expired OTP code')
    ;(err as Error & { statusCode: number }).statusCode = 401
    throw err
  }
  
  // Step 3: Mark OTP as used (prevent reuse)
  await markOtpUsed(token.id)
  
  // Step 4: Check if this is a new user (was pending)
  const isNewUser = user.status === 'pending'
  
  // Step 5: Activate user if pending
  if (user.status === 'pending') {
    await updateUserStatus(user.user_id, 'active')
    logger.info('User activated after OTP verification', { user_id: user.user_id })
  }
  
  // Step 6: Get user roles and permissions
  const roleRows = await getUserRoles(user.user_id)
  const roles = roleRows.map(r => r.role_name)
  const permissions = await getUserPermissions(user.user_id)
  
  // Step 7: Generate JWT token with national_id claim
  const secret = new TextEncoder().encode(config.jwt.secret)
  const token_jwt = await new SignJWT({
    sub: user.user_id,
    email: user.email,
    roles,
    permissions,
    registry_id: user.registry_id || undefined,
    national_id: nationalId, // CRITICAL: Include for family service /auth/me
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(config.jwt.issuer)
    .setAudience(config.jwt.audience)
    .setExpirationTime(`${config.jwt.expiresInSeconds}s`)
    .sign(secret)
  
  // Step 8: Record successful login event
  await recordLoginEvent({
    userId: user.user_id,
    ip,
    userAgent,
    outcome: 'success',
  })
  
  logger.info('OTP login successful', { 
    user_id: user.user_id,
    is_new_user: isNewUser,
    roles,
  })
  
  return {
    access_token: token_jwt,
    token_type: 'Bearer',
    expires_in: config.jwt.expiresInSeconds,
    user_id: user.user_id,
    email: user.email,
    roles,
    permissions,
    registry_id: user.registry_id || null,
    is_new_user: isNewUser,
  }
}
```

#### Step 3: Create API Routes

**File:** `/backend/iam-service/src/routes/otpLogin.routes.ts`

```typescript
import { Router, Request, Response } from 'express'
import { logger } from '../lib/logger.js'
import { requestOtpLogin, verifyOtpLogin } from '../services/otpLogin.js'
import { rateLimiter } from '../middleware/rateLimiter.js'

const router = Router()

/**
 * POST /iam/otp-login/request
 * Request an OTP for login
 */
router.post(
  '/request',
  rateLimiter('otp-request', 5, 60000), // 5 requests per minute
  async (req: Request, res: Response) => {
    try {
      const { national_id } = req.body
      
      // Validation
      if (!national_id) {
        return res.status(400).json({ 
          error: 'national_id is required' 
        })
      }
      
      if (typeof national_id !== 'string') {
        return res.status(400).json({ 
          error: 'national_id must be a string' 
        })
      }
      
      // Clean and validate national_id format
      const cleanNationalId = national_id.trim()
      if (cleanNationalId.length !== 13) {
        return res.status(400).json({ 
          error: 'national_id must be 13 digits' 
        })
      }
      
      if (!/^\d+$/.test(cleanNationalId)) {
        return res.status(400).json({ 
          error: 'national_id must contain only digits' 
        })
      }
      
      // Call service
      const result = await requestOtpLogin(cleanNationalId)
      
      res.json(result)
    } catch (error: any) {
      logger.error('OTP request failed', { 
        error: error.message,
        stack: error.stack,
      })
      
      const statusCode = error.statusCode || 500
      res.status(statusCode).json({ 
        error: error.message || 'Failed to send OTP' 
      })
    }
  }
)

/**
 * POST /iam/otp-login/verify
 * Verify OTP and complete login
 */
router.post(
  '/verify',
  rateLimiter('otp-verify', 5, 60000), // 5 requests per minute
  async (req: Request, res: Response) => {
    try {
      const { national_id, otp } = req.body
      
      // Validation
      if (!national_id || !otp) {
        return res.status(400).json({ 
          error: 'national_id and otp are required' 
        })
      }
      
      if (typeof national_id !== 'string' || typeof otp !== 'string') {
        return res.status(400).json({ 
          error: 'national_id and otp must be strings' 
        })
      }
      
      // Validate OTP format (6 digits)
      if (!/^\d{6}$/.test(otp)) {
        return res.status(400).json({ 
          error: 'OTP must be 6 digits' 
        })
      }
      
      // Get client info
      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() 
                 || req.socket.remoteAddress 
                 || 'unknown'
      const userAgent = req.headers['user-agent'] || 'unknown'
      
      // Call service
      const result = await verifyOtpLogin({
        nationalId: national_id.trim(),
        otp: otp.trim(),
        ip,
        userAgent,
      })
      
      res.json(result)
    } catch (error: any) {
      logger.error('OTP verification failed', { 
        error: error.message,
        stack: error.stack,
      })
      
      const statusCode = error.statusCode || 500
      res.status(statusCode).json({ 
        error: error.message || 'OTP verification failed' 
      })
    }
  }
)

export default router
```

#### Step 4: Register Routes in Main Server

**File:** `/backend/iam-service/src/index.ts`

```typescript
import otpLoginRoutes from './routes/otpLogin.routes.js'

// ... other routes

// OTP Login routes
app.use('/iam/otp-login', otpLoginRoutes)

// ... server startup
```

#### Step 5: Update Password Reset (Different Behavior)

**User Request:**
> "Password reset should only check users table, not create new users. If not found, suggest OTP login."

**File:** `/backend/iam-service/src/services/passwordReset.ts`

**Before:**
```typescript
export async function requestPasswordReset(nationalId: string) {
  // Check users
  let user = await getUserByNationalIdHash(hash)
  
  // If not found, check Registry and create
  if (!user) {
    const registryData = await lookupByNationalId(nationalId)
    if (registryData) {
      userId = await createUser({...})
    }
  }
  // ...
}
```

**After:**
```typescript
export async function requestPasswordReset(nationalId: string) {
  logger.info('Password reset requested', { national_id: nationalId })
  
  const nationalIdHash = hashNationalId(nationalId)
  
  // ONLY check users table
  const user = await getUserByNationalIdHash(nationalIdHash)
  
  // If not found, DON'T create - suggest OTP login instead
  if (!user) {
    logger.warn('User not found for password reset', { national_id: nationalId })
    const err = new Error(
      'User not found. Please try to login with OTP to create your account.'
    )
    ;(err as Error & { statusCode: number }).statusCode = 404
    throw err
  }
  
  // Continue with password reset...
  // Generate reset token
  // Send email
  // Return success
}
```

**Key Differences:**
| Feature | OTP Login | Password Reset |
|---------|-----------|----------------|
| Check users table | ✅ | ✅ |
| Check family_member | ✅ | ❌ |
| Create new user | ✅ | ❌ |
| User status | 'pending' → 'active' | Must be 'active' |
| Token purpose | 'otp_login' | 'password_reset' |

---

### Phase 2: Database Enum Constraint Error

**Problem Encountered:**
```json
{
  "error": "invalid input value for enum otp_purpose: \"otp_login\""
}
```

**When:** First attempt to use OTP login after implementation

**Root Cause:**
The `otp_purpose` enum in database only had 3 values:
```sql
CREATE TYPE otp_purpose AS ENUM (
  'password_reset',
  'mfa_email',
  'invite'
);
```

But code was trying to use:
- `'otp_login'` (new for OTP login feature)
- `'worker_registration'` (new for worker registration)

**Solution:**

**Created Migration 011:**
```sql
-- /database/migrations/011_add_otp_purposes.sql

-- Add new enum values to otp_purpose type
ALTER TYPE otp_purpose ADD VALUE IF NOT EXISTS 'worker_registration';
ALTER TYPE otp_purpose ADD VALUE IF NOT EXISTS 'otp_login';

-- Note: PostgreSQL doesn't support removing enum values
-- If you need to remove a value, you must recreate the enum type
```

**Updated Schema File:**
```sql
-- /database/iam-service-schema.sql

-- Updated enum definition
CREATE TYPE otp_purpose AS ENUM (
  'password_reset',
  'mfa_email',
  'invite',
  'worker_registration',
  'otp_login'
);
```

**Updated TypeScript Types:**
```typescript
// /backend/iam-service/src/types.ts

export type OtpPurpose = 
  | 'password_reset'
  | 'mfa_email'
  | 'invite'
  | 'worker_registration'
  | 'otp_login'
```

**Execution:**
```bash
# Connect to database
psql $DATABASE_URL

# Run migration
\i /database/migrations/011_add_otp_purposes.sql

# Verify
\dT+ otp_purpose
```

**Lesson Learned:**
- Always update database enums when adding new purposes
- Create proper migrations for enum changes
- Update TypeScript types to match database
- Test with actual database constraints
- Document enum values and their purposes

---

### Phase 3: JWT Token Structure Fix

**Problem:**
> "When I login with OTP, dashboard loads briefly then redirects back to login"

**Investigation:**

**Step 1: Check Browser Network Tab**
- OTP verify: 200 OK ✅
- JWT token received ✅
- Token stored in localStorage ✅
- Navigate to dashboard ✅
- Dashboard calls `/auth/me` ❌ 401 Unauthorized

**Step 2: Check Family Service `/auth/me` Endpoint**
```typescript
// /backend/family-service/src/routes/auth.routes.ts

router.get('/me', async (req, res) => {
  // Extract and decode JWT
  const token = req.headers.authorization?.replace('Bearer ', '')
  const jwtPayload = decodeJWT(token)
  
  // Look for national_id in JWT
  let memberNationalId: string | null = null
  
  if (jwtPayload?.national_id) {
    memberNationalId = jwtPayload.national_id as string
  } else {
    // Check if user is worker
    const isWorker = jwtPayload?.roles?.includes('worker')
    
    if (!isWorker) {
      // NOT WORKER AND NO NATIONAL_ID = REJECT
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }
  
  // ... rest of logic
})
```

**Step 3: Check OTP Login JWT Payload**
```typescript
// FROM: /backend/iam-service/src/services/otpLogin.ts

const token_jwt = await new SignJWT({
  sub: user.user_id,
  email: user.email,
  roles,
  permissions,
  registry_id: user.registry_id || undefined,
  // MISSING: national_id
})
```

**Root Cause:**
- OTP login JWT didn't include `national_id`
- Family service `/auth/me` requires it for non-worker users
- Frontend calls `/auth/me` after login to load user/family data
- 401 response triggers redirect to login page

**Solution:**

**Updated OTP Login Service:**
```typescript
// /backend/iam-service/src/services/otpLogin.ts

const token_jwt = await new SignJWT({
  sub: user.user_id,
  email: user.email,
  roles,
  permissions,
  registry_id: user.registry_id || undefined,
  national_id: nationalId, // ADDED: Critical for family service
})
```

**Also Updated Regular Password Login for Consistency:**
```typescript
// /backend/iam-service/src/services/login.ts

const accessToken = await new SignJWT({
  sub: user.user_id,
  email: user.email,
  roles,
  permissions,
  registry_id: user.registry_id || undefined,
  national_id: nationalId, // ADDED: Same structure as OTP login
})
```

**Result:**
✅ OTP login works completely  
✅ Dashboard loads properly  
✅ `/auth/me` returns user and family data  
✅ Session persists  
✅ No more 401 errors  

**JWT Payload Now:**
```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "roles": ["citizen"],
  "permissions": ["read:family", "update:family"],
  "registry_id": "660e8400-e29b-41d4-a716-446655440000",
  "national_id": "1234567890123",
  "iat": 1708329600,
  "exp": 1708416000,
  "iss": "spis-iam-service",
  "aud": "spis-api"
}
```

**Time Invested:** 3-4 hours of debugging

**Key Lessons:**
1. Document JWT payload structure clearly
2. Ensure consistent token claims across all authentication methods
3. Test authentication flows end-to-end
4. Check what downstream services expect
5. Log JWT payloads during development (but not in production!)

---

## Challenges & Solutions Summary

### Challenge 1: Cross-Service User Lookup

**Problem:** IAM service needs to check family_member table (in family service schema)

**Options Considered:**
1. Direct database access to family schema ❌ (breaks service boundaries)
2. HTTP API call to family service ✅ (chosen)
3. Shared database views ❌ (complex setup)
4. Event-based lookup ❌ (too slow for login)

**Solution:** Created Registry Client for cross-service communication
```typescript
// /backend/iam-service/src/clients/registryClient.ts

export async function lookupByNationalId(nationalId: string) {
  const response = await axios.get(
    `${config.familyServiceUrl}/api/v1/registry/lookup`,
    {
      params: { national_id: nationalId },
      headers: { 'X-Internal-Service': 'iam-service' },
    }
  )
  return response.data
}
```

---

### Challenge 2: Auto-User Creation

**Problem:** When creating user from family_member data, what fields to use?

**Decisions Made:**
- **national_id:** From family_member (store as hash)
- **email:** From family_member if available, else temp email
- **status:** 'pending' (activate on OTP verification)
- **registry_id:** From family_member lookup
- **role:** Auto-assign 'citizen' role
- **password:** NULL (passwordless user)

---

### Challenge 3: OTP Security

**Requirements:**
- Secure random generation
- Single-use tokens
- Time-limited validity
- Purpose-specific (prevent token reuse across features)

**Implementation:**
```typescript
// OTP Generation
export function generateOtp(length: number = 6): string {
  const min = Math.pow(10, length - 1)
  const max = Math.pow(10, length) - 1
  return Math.floor(min + Math.random() * (max - min + 1)).toString()
}

// OTP Storage
await saveOtpToken({
  userId: user.user_id,
  token: otp,
  purpose: 'otp_login',
  expiresInMinutes: 10,
})

// OTP Validation
const token = await getValidOtpToken({
  userId: user.user_id,
  token: otp,
  purpose: 'otp_login',
})

if (token && token.expires_at > new Date() && !token.used_at) {
  // Valid
  await markOtpUsed(token.id)
} else {
  // Invalid/Expired
  throw new Error('Invalid or expired OTP')
}
```

---

### Challenge 4: Email Delivery

**Problem:** How to send OTP emails reliably?

**Solution:** Used Resend service
```typescript
// /backend/iam-service/src/clients/emailClient.ts

import axios from 'axios'
import { config } from '../config.js'

export async function sendEmail(params: {
  to: string
  subject: string
  html: string
}) {
  try {
    await axios.post(
      `${config.emailServiceUrl}/api/email/send`,
      {
        to: params.to,
        from: config.emailFrom,
        subject: params.subject,
        html: params.html,
      }
    )
  } catch (error) {
    logger.error('Failed to send email', { error })
    throw error
  }
}
```

---

### Challenge 5: Rate Limiting

**Problem:** Prevent OTP spam and brute force attacks

**Solution:** Implemented rate limiting middleware
```typescript
// /backend/iam-service/src/middleware/rateLimiter.ts

export function rateLimiter(
  name: string,
  maxRequests: number,
  windowMs: number
) {
  const requests = new Map<string, number[]>()
  
  return (req, res, next) => {
    const key = `${name}:${req.ip}`
    const now = Date.now()
    
    // Get request timestamps for this IP
    const timestamps = requests.get(key) || []
    
    // Remove old timestamps outside window
    const validTimestamps = timestamps.filter(t => now - t < windowMs)
    
    // Check if limit exceeded
    if (validTimestamps.length >= maxRequests) {
      return res.status(429).json({ 
        error: 'Too many requests. Please try again later.' 
      })
    }
    
    // Add current timestamp
    validTimestamps.push(now)
    requests.set(key, validTimestamps)
    
    next()
  }
}

// Usage
router.post('/request', rateLimiter('otp-request', 5, 60000), handler)
// Allows 5 OTP requests per minute per IP
```

---

## API Documentation

### Endpoints

#### POST /iam/otp-login/request
Request an OTP for passwordless login

**Request:**
```json
{
  "national_id": "1234567890123"
}
```

**Response (Success):**
```json
{
  "otp_id": "uuid",
  "message": "OTP sent to your registered email address",
  "email_hint": "us***@example.com",
  "is_new_user": false
}
```

**Response (Not Found):**
```json
{
  "error": "National ID not registered in the system"
}
```

---

#### POST /iam/otp-login/verify
Verify OTP and complete login

**Request:**
```json
{
  "national_id": "1234567890123",
  "otp": "123456"
}
```

**Response (Success):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 86400,
  "user_id": "uuid",
  "email": "user@example.com",
  "roles": ["citizen"],
  "permissions": ["read:family", "update:family"],
  "registry_id": "uuid",
  "is_new_user": false
}
```

**Response (Invalid OTP):**
```json
{
  "error": "Invalid or expired OTP code"
}
```

---

#### POST /iam/login
Traditional password-based login

**Request:**
```json
{
  "national_id": "1234567890123",
  "password": "SecurePassword123"
}
```

**Response:** Same as OTP verify (with JWT)

---

#### POST /iam/password-reset/request
Request password reset (only for existing users)

**Request:**
```json
{
  "national_id": "1234567890123"
}
```

**Response:**
```json
{
  "message": "Password reset link sent to your email"
}
```

**Response (User Not Found):**
```json
{
  "error": "User not found. Please try to login with OTP to create your account."
}
```

---

## Database Schema

### users Table
```sql
CREATE TABLE users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  national_id_hash VARCHAR(64) UNIQUE NOT NULL, -- SHA-256 hash
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255), -- NULL for passwordless users
  status VARCHAR(20) DEFAULT 'active', -- active, pending, disabled, locked
  failed_login_count INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,
  registry_id UUID, -- Link to family service
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_national_id_hash ON users(national_id_hash);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
```

### otp_tokens Table
```sql
CREATE TABLE otp_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL,
  purpose otp_purpose NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_otp_tokens_user_id ON otp_tokens(user_id);
CREATE INDEX idx_otp_tokens_purpose ON otp_tokens(purpose);
CREATE INDEX idx_otp_tokens_expires_at ON otp_tokens(expires_at);
```

### login_events Table (Audit Log)
```sql
CREATE TABLE login_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
  ip_address VARCHAR(45), -- IPv6 compatible
  user_agent TEXT,
  outcome VARCHAR(20), -- success, failed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_login_events_user_id ON login_events(user_id);
CREATE INDEX idx_login_events_created_at ON login_events(created_at);
```

---

## Security Measures

### 1. National ID Protection
- **Never store plaintext national IDs**
- Hash with SHA-256 before storage
- Only include in JWT payload (encrypted in transit)

### 2. Password Security
- Bcrypt hashing with salt rounds = 10
- No password storage for OTP-only users
- Password complexity requirements (if set)

### 3. OTP Security
- Cryptographically random generation
- 10-minute expiration
- Single-use tokens
- Purpose-specific to prevent reuse

### 4. JWT Security
- HS256 algorithm
- 24-hour expiration
- Issuer and audience validation
- Secure secret key

### 5. Account Protection
- Failed login tracking
- Auto-lockout after 5 failed attempts
- 30-minute lockout duration
- IP and user agent logging

### 6. Rate Limiting
- 5 OTP requests per minute per IP
- 5 OTP verification attempts per minute
- 10 login attempts per minute

---

## Testing Recommendations

### Unit Tests
```typescript
describe('OTP Login Service', () => {
  test('should generate 6-digit OTP', () => {
    const otp = generateOtp(6)
    expect(otp).toMatch(/^\d{6}$/)
  })
  
  test('should create user from family_member data', async () => {
    const result = await requestOtpLogin('1234567890123')
    expect(result.is_new_user).toBe(true)
  })
  
  test('should reject invalid OTP', async () => {
    await expect(
      verifyOtpLogin({
        nationalId: '1234567890123',
        otp: '000000',
        ip: '127.0.0.1',
        userAgent: 'test',
      })
    ).rejects.toThrow('Invalid or expired OTP')
  })
})
```

### Integration Tests
- Test complete OTP login flow
- Test user creation from family_member
- Test JWT token generation and validation
- Test email delivery
- Test rate limiting

### Security Tests
- Test OTP expiration
- Test OTP reuse prevention
- Test account lockout
- Test JWT validation
- Test rate limiting bypass attempts

---

## Lessons for Presentation

### Key Points
1. **Passwordless Authentication** - Modern, secure, user-friendly
2. **Auto-User Creation** - Seamless onboarding from family data
3. **Security First** - Hashing, rate limiting, single-use tokens
4. **Cross-Service Communication** - Microservices coordination
5. **Error Handling** - Clear, actionable error messages

### Demo Flow
1. Show dual login UI (Password vs OTP toggle)
2. Enter national ID for OTP login
3. Show email with OTP code
4. Enter OTP and verify
5. Show successful login and dashboard
6. Explain JWT payload in browser devtools
7. Show database tables (users, otp_tokens, login_events)

### Common Questions
**Q:** Why OTP instead of just password?  
**A:** Better security, no password to remember, easier for users

**Q:** What if email fails to send?  
**A:** OTP still saved in database, can be resent, logs error for monitoring

**Q:** Can OTP be reused?  
**A:** No, marked as used immediately after successful verification

**Q:** What if someone spams OTP requests?  
**A:** Rate limiting prevents abuse (5 per minute)

**Q:** How long does OTP last?  
**A:** 10 minutes, then expires automatically

**Q:** What if user not in family_member table?  
**A:** Returns error "National ID not registered in the system"
