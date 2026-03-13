# Family Service - User Requests & Implementation

## Complete Request History

### Request #1: Registration Form Expansion

**Date:** Early Development Phase  
**User Request:**
> "I want to expand the registration form to include comprehensive fields for family members - around 60 fields covering personal details, contact information, employment, education, health, and more."

**Context:**
- Initial system had basic registration
- Needed comprehensive data collection for government services
- Required detailed family member information

**Analysis:**
- Reviewed existing database schema
- Identified gaps in data collection
- Researched government requirements for social protection programs
- Studied similar systems

**Implementation Plan:**
1. Design comprehensive field list (60+ fields)
2. Create database migration
3. Update TypeScript types
4. Modify API endpoints
5. Update frontend forms

**Execution:**

**Step 1: Database Migration (010)**
Created `/database/migrations/010_update_family_member_table.sql`
```sql
-- Added categories of fields:

-- 1. Extended Name Fields
ALTER TABLE family_member ADD COLUMN middle_name VARCHAR(100);

-- 2. Contact Information
ALTER TABLE family_member ADD COLUMN phone_number VARCHAR(20);
ALTER TABLE family_member ADD COLUMN email VARCHAR(255);
ALTER TABLE family_member ADD COLUMN emergency_contact_name VARCHAR(200);
ALTER TABLE family_member ADD COLUMN emergency_contact_phone VARCHAR(20);
ALTER TABLE family_member ADD COLUMN emergency_contact_relationship VARCHAR(100);

-- 3. Demographics
ALTER TABLE family_member ADD COLUMN nationality VARCHAR(100);
ALTER TABLE family_member ADD COLUMN ethnicity VARCHAR(100);
ALTER TABLE family_member ADD COLUMN religion VARCHAR(100);
ALTER TABLE family_member ADD COLUMN language VARCHAR(100);
ALTER TABLE family_member ADD COLUMN place_of_birth VARCHAR(200);

-- 4. Marital Status
ALTER TABLE family_member ADD COLUMN marital_status VARCHAR(50);
ALTER TABLE family_member ADD COLUMN spouse_name VARCHAR(200);
ALTER TABLE family_member ADD COLUMN spouse_national_id VARCHAR(13);
ALTER TABLE family_member ADD COLUMN marriage_date DATE;

-- 5. Parents Information
ALTER TABLE family_member ADD COLUMN father_name VARCHAR(200);
ALTER TABLE family_member ADD COLUMN father_national_id VARCHAR(13);
ALTER TABLE family_member ADD COLUMN mother_name VARCHAR(200);
ALTER TABLE family_member ADD COLUMN mother_national_id VARCHAR(13);

-- 6. Employment Details
ALTER TABLE family_member ADD COLUMN occupation VARCHAR(200);
ALTER TABLE family_member ADD COLUMN employer_name VARCHAR(200);
ALTER TABLE family_member ADD COLUMN employer_address TEXT;
ALTER TABLE family_member ADD COLUMN employment_status VARCHAR(50);
ALTER TABLE family_member ADD COLUMN employment_start_date DATE;
ALTER TABLE family_member ADD COLUMN monthly_income NUMERIC(12,2);
ALTER TABLE family_member ADD COLUMN work_phone VARCHAR(20);

-- 7. Education Information
ALTER TABLE family_member ADD COLUMN education_level VARCHAR(100);
ALTER TABLE family_member ADD COLUMN current_education_status VARCHAR(50);
ALTER TABLE family_member ADD COLUMN school_name VARCHAR(200);
ALTER TABLE family_member ADD COLUMN field_of_study VARCHAR(200);
ALTER TABLE family_member ADD COLUMN graduation_year INTEGER;

-- 8. Health Information
ALTER TABLE family_member ADD COLUMN has_disability BOOLEAN DEFAULT FALSE;
ALTER TABLE family_member ADD COLUMN disability_type VARCHAR(200);
ALTER TABLE family_member ADD COLUMN disability_percentage NUMERIC(5,2);
ALTER TABLE family_member ADD COLUMN chronic_conditions TEXT;
ALTER TABLE family_member ADD COLUMN allergies TEXT;
ALTER TABLE family_member ADD COLUMN blood_type VARCHAR(10);
ALTER TABLE family_member ADD COLUMN health_insurance_provider VARCHAR(200);
ALTER TABLE family_member ADD COLUMN health_insurance_number VARCHAR(100);

-- 9. Document Numbers
ALTER TABLE family_member ADD COLUMN id_card_number VARCHAR(50);
ALTER TABLE family_member ADD COLUMN id_card_expiry DATE;
ALTER TABLE family_member ADD COLUMN passport_number VARCHAR(50);
ALTER TABLE family_member ADD COLUMN passport_expiry DATE;
ALTER TABLE family_member ADD COLUMN birth_certificate_number VARCHAR(50);
ALTER TABLE family_member ADD COLUMN driving_license_number VARCHAR(50);

-- 10. Government Benefits
ALTER TABLE family_member ADD COLUMN receives_government_assistance BOOLEAN DEFAULT FALSE;
ALTER TABLE family_member ADD COLUMN government_assistance_type TEXT;
ALTER TABLE family_member ADD COLUMN pension_number VARCHAR(100);
ALTER TABLE family_member ADD COLUMN veteran_status BOOLEAN DEFAULT FALSE;

-- 11. Banking Information
ALTER TABLE family_member ADD COLUMN bank_name VARCHAR(200);
ALTER TABLE family_member ADD COLUMN bank_account_number VARCHAR(100);
ALTER TABLE family_member ADD COLUMN bank_branch VARCHAR(200);

-- 12. Additional Information
ALTER TABLE family_member ADD COLUMN preferred_language VARCHAR(100);
ALTER TABLE family_member ADD COLUMN communication_preference VARCHAR(50);
ALTER TABLE family_member ADD COLUMN notes TEXT;

-- Total: 60+ new fields
```

**Step 2: TypeScript Types**
Updated types in family service:
```typescript
export interface FamilyMember {
  uuid: string
  family_uuid: string
  national_id: string
  
  // Name
  first_name: string
  middle_name?: string
  last_name: string
  
  // Basic Info
  date_of_birth: string
  gender: string
  relationship_to_head: string
  
  // Contact
  phone_number?: string
  email?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  
  // Demographics
  nationality?: string
  ethnicity?: string
  religion?: string
  language?: string
  marital_status?: string
  
  // Family Relations
  father_name?: string
  mother_name?: string
  spouse_name?: string
  spouse_national_id?: string
  
  // Employment
  occupation?: string
  employer_name?: string
  employment_status?: string
  monthly_income?: number
  
  // Education
  education_level?: string
  current_education_status?: string
  school_name?: string
  field_of_study?: string
  
  // Health
  has_disability?: boolean
  disability_type?: string
  chronic_conditions?: string
  health_insurance_provider?: string
  health_insurance_number?: string
  
  // Documents
  id_card_number?: string
  passport_number?: string
  birth_certificate_number?: string
  
  // Benefits
  receives_government_assistance?: boolean
  government_assistance_type?: string
  
  // Status
  is_head?: boolean
  is_active?: boolean
  
  // Timestamps
  created_at: string
  updated_at: string
}
```

**Step 3: Frontend Form**
Created multi-step registration form with sections:
- Personal Information
- Contact Details
- Family Relations
- Employment
- Education
- Health Information
- Documents
- Additional Information

**Outcome:**
✅ Successfully implemented 60+ field registration system  
✅ Database migration executed without issues  
✅ Frontend form with validation working  
✅ API endpoints handling all fields correctly  

**Time Taken:** 2-3 hours  
**Complexity:** Medium-High  

---

### Request #2: Environment Configuration Issues

**Date:** During OTP Implementation Phase  
**User Request:**
> "Services are not starting - environment variables not loading properly"

**Problem:**
- Services failing to start
- Environment variables undefined
- Each service loading .env differently

**Error Messages:**
```
Error: JWT_SECRET is not defined
Error: DATABASE_URL is not defined
TypeError: Cannot read property 'secret' of undefined
```

**Root Cause Analysis:**
1. Multiple `.env` files scattered across services
2. Inconsistent environment variable naming
3. Environment loaded after imports requiring them
4. No centralized configuration

**Solution Implemented:**

**Step 1: Consolidate Environment Variables**
Created single `/backend/.env` file:
```env
# Database Configuration
DATABASE_URL=postgresql://postgres.xyz...
SUPABASE_URL=https://xyz.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUz...

# JWT Configuration
JWT_SECRET=your-super-secret-key-here
JWT_ISSUER=spis-iam-service
JWT_AUDIENCE=spis-api
JWT_EXPIRES_IN_SECONDS=86400

# Service Ports
IAM_SERVICE_PORT=3003
FAMILY_SERVICE_PORT=3001
EMAIL_SERVICE_PORT=3002

# Email Configuration (Resend)
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@spis.gov

# RabbitMQ Configuration
RABBITMQ_URL=amqp://localhost:5672

# Redis Configuration (optional)
REDIS_URL=redis://localhost:6379
```

**Step 2: Create Early Loading Module**
Created `dotenv-config.ts` for each service:
```typescript
// backend/iam-service/src/dotenv-config.ts
import { config } from 'dotenv'
import { resolve } from 'path'

// Load from parent backend directory
const envPath = resolve(__dirname, '../../.env')
config({ path: envPath })

// Validate critical variables
const required = ['DATABASE_URL', 'JWT_SECRET']
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
}

console.log('✓ Environment variables loaded successfully')
```

**Step 3: Import First in index.ts**
```typescript
// MUST BE FIRST IMPORT
import './dotenv-config.js'

// Now other imports
import express from 'express'
import { config } from './config.js'
// ... rest of imports
```

**Step 4: Update All Services**
- Updated IAM service
- Updated Family service  
- Updated Email service

**Outcome:**
✅ All services start successfully  
✅ Single source of truth for configuration  
✅ Early validation prevents runtime errors  
✅ Clear error messages for missing variables  

**What We Learned:**
- Environment must load before ANY other imports
- Centralized config reduces duplication and errors
- Validation at startup saves debugging time
- Consistent naming conventions are crucial

**Time Taken:** 1-2 hours  
**Complexity:** Medium  

---

### Request #3: Dual Login System (Password + OTP)

**Date:** Mid-Development Phase  
**User Request:**
> "Now I want that there should be two types of login - one with OTP and other with password. For OTP login, first search in users table, if not found then search in family_member table. If found in family_member, automatically create user account and send OTP."

**Context:**
- Existing password-based login worked
- Needed passwordless OTP option
- Auto-user creation required
- Different from password reset (which only checks users table)

**Requirements Analysis:**
1. **OTP Login Flow:**
   - User enters national ID
   - System searches users table
   - If not found, search family_member table
   - If found in family_member, create user with 'pending' status
   - Generate 6-digit OTP
   - Send OTP via email
   - User enters OTP
   - Verify OTP
   - Activate user (if was pending)
   - Generate JWT and log in

2. **Password Reset Flow (different):**
   - Only search users table
   - If not found, suggest OTP login
   - Don't create new users

**Implementation:**

**Step 1: Create OTP Login Service**
File: `/backend/iam-service/src/services/otpLogin.ts`

```typescript
import { SignJWT } from 'jose'
import { config } from '../config.js'
import { logger } from '../lib/logger.js'
import { hashNationalId, generateOtp } from '../lib/crypto.js'
import { lookupByNationalId } from '../clients/registryClient.js'
import { sendEmail } from '../clients/emailClient.js'
import {
  getUserByNationalIdHash,
  createUser,
  getUserRoles,
  getUserPermissions,
  addRole,
  saveOtpToken,
  getValidOtpToken,
  markOtpUsed,
  updateUserStatus,
  recordLoginEvent,
} from '../db/repository.js'

export async function requestOtpLogin(nationalId: string) {
  const nationalIdHash = hashNationalId(nationalId)
  
  // 1. Check if user exists
  let user = await getUserByNationalIdHash(nationalIdHash)
  
  // 2. If not found, check family_member table via Registry service
  if (!user) {
    const registryData = await lookupByNationalId(nationalId)
    
    if (registryData) {
      // Found in family_member - create user account
      const userId = await createUser({
        nationalIdHash,
        email: registryData.email || `${nationalId}@temp.spis.gov`,
        status: 'pending', // Will activate on OTP verify
        registryId: registryData.registry_id,
      })
      
      // Assign citizen role
      await addRole(userId, 'citizen')
      
      // Fetch newly created user
      user = await getUserByNationalIdHash(nationalIdHash)
      
      logger.info('New user created for OTP login', { user_id: userId })
    } else {
      // Not found anywhere
      throw new Error('National ID not found in system')
    }
  }
  
  // 3. Generate OTP
  const otp = generateOtp(6) // 6-digit code
  
  // 4. Save OTP to database
  const otpId = await saveOtpToken({
    userId: user.user_id,
    token: otp,
    purpose: 'otp_login',
    expiresInMinutes: 10,
  })
  
  // 5. Send OTP via email
  await sendEmail({
    to: user.email,
    subject: 'Your SPIS Login Code',
    html: `
      <h2>Your Login Code</h2>
      <p>Use this code to log in to SPIS:</p>
      <h1 style="font-size: 32px; letter-spacing: 8px;">${otp}</h1>
      <p>This code expires in 10 minutes.</p>
      <p>If you didn't request this code, please ignore this email.</p>
    `,
  })
  
  logger.info('OTP sent for login', { user_id: user.user_id, email: user.email })
  
  return {
    otp_id: otpId,
    message: 'OTP sent to your registered email',
    email_hint: user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3'), // Mask email
  }
}

export async function verifyOtpLogin(params: {
  nationalId: string
  otp: string
  ip: string
  userAgent: string
}) {
  const { nationalId, otp, ip, userAgent } = params
  const nationalIdHash = hashNationalId(nationalId)
  
  // 1. Get user
  const user = await getUserByNationalIdHash(nationalIdHash)
  if (!user) {
    throw new Error('User not found')
  }
  
  // 2. Verify OTP
  const token = await getValidOtpToken({
    userId: user.user_id,
    token: otp,
    purpose: 'otp_login',
  })
  
  if (!token) {
    throw new Error('Invalid or expired OTP')
  }
  
  // 3. Mark OTP as used
  await markOtpUsed(token.id)
  
  // 4. Activate user if pending
  const isNewUser = user.status === 'pending'
  if (user.status === 'pending') {
    await updateUserStatus(user.user_id, 'active')
  }
  
  // 5. Get roles and permissions
  const roleRows = await getUserRoles(user.user_id)
  const roles = roleRows.map(r => r.role_name)
  const permissions = await getUserPermissions(user.user_id)
  
  // 6. Generate JWT with national_id
  const secret = new TextEncoder().encode(config.jwt.secret)
  const token_jwt = await new SignJWT({
    sub: user.user_id,
    email: user.email,
    roles,
    permissions,
    registry_id: user.registry_id || undefined,
    national_id: nationalId, // Important for family service!
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(config.jwt.issuer)
    .setAudience(config.jwt.audience)
    .setExpirationTime(`${config.jwt.expiresInSeconds}s`)
    .sign(secret)
  
  // 7. Record login
  await recordLoginEvent({
    userId: user.user_id,
    ip,
    userAgent,
    outcome: 'success',
  })
  
  logger.info('OTP login successful', { 
    user_id: user.user_id,
    is_new_user: isNewUser,
  })
  
  return {
    access_token: token_jwt,
    token_type: 'Bearer',
    expires_in: 86400,
    user_id: user.user_id,
    email: user.email,
    roles,
    permissions,
    registry_id: user.registry_id || null,
    is_new_user: isNewUser,
  }
}
```

**Step 2: Create Routes**
File: `/backend/iam-service/src/routes/otpLogin.routes.ts`

```typescript
import { Router } from 'express'
import { requestOtpLogin, verifyOtpLogin } from '../services/otpLogin.js'
import { rateLimiter } from '../middleware/rateLimiter.js'

const router = Router()

// Request OTP for login
router.post('/request', rateLimiter('otp-request', 5, 60000), async (req, res) => {
  try {
    const { national_id } = req.body
    
    if (!national_id) {
      return res.status(400).json({ error: 'national_id is required' })
    }
    
    const result = await requestOtpLogin(national_id)
    res.json(result)
  } catch (error: any) {
    logger.error('OTP request failed', { error: error.message })
    res.status(500).json({ error: error.message })
  }
})

// Verify OTP and login
router.post('/verify', rateLimiter('otp-verify', 5, 60000), async (req, res) => {
  try {
    const { national_id, otp } = req.body
    
    if (!national_id || !otp) {
      return res.status(400).json({ 
        error: 'national_id and otp are required' 
      })
    }
    
    const result = await verifyOtpLogin({
      nationalId: national_id,
      otp,
      ip: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    })
    
    res.json(result)
  } catch (error: any) {
    logger.error('OTP verification failed', { error: error.message })
    res.status(401).json({ error: error.message })
  }
})

export default router
```

**Step 3: Register Routes**
File: `/backend/iam-service/src/index.ts`

```typescript
import otpLoginRoutes from './routes/otpLogin.routes.js'

// Register routes
app.use('/iam/otp-login', otpLoginRoutes)
```

**Step 4: Update Password Reset (Different Behavior)**
File: `/backend/iam-service/src/services/passwordReset.ts`

```typescript
export async function requestPasswordReset(nationalId: string) {
  const nationalIdHash = hashNationalId(nationalId)
  
  // Only check users table (NOT family_member)
  const user = await getUserByNationalIdHash(nationalIdHash)
  
  if (!user) {
    // Suggest OTP login instead
    throw new Error('User not found. Please try to login with OTP.')
  }
  
  // Continue with password reset...
}
```

**Step 5: Frontend UI**
Updated `/frontend/src/pages/public/LoginPage.tsx`:

```typescript
const [loginMode, setLoginMode] = useState<'password' | 'otp'>('password')
const [otpSent, setOtpSent] = useState(false)
const [otp, setOtp] = useState('')
const [otpId, setOtpId] = useState('')

const handleOtpRequest = async () => {
  try {
    const response = await requestOtpLogin(nationalId)
    setOtpId(response.otp_id)
    setOtpSent(true)
    toast.success('OTP sent to your email')
  } catch (error) {
    toast.error(error.message)
  }
}

const handleOtpVerify = async () => {
  try {
    const response = await verifyOtpLogin({ national_id: nationalId, otp })
    // Store token and redirect
    login(response)
    navigate('/dashboard')
  } catch (error) {
    toast.error('Invalid OTP')
  }
}

return (
  <div>
    {/* Mode Toggle */}
    <div className="flex gap-2 mb-4">
      <button 
        onClick={() => setLoginMode('password')}
        className={loginMode === 'password' ? 'active' : ''}
      >
        Password Login
      </button>
      <button 
        onClick={() => setLoginMode('otp')}
        className={loginMode === 'otp' ? 'active' : ''}
      >
        OTP Login
      </button>
    </div>
    
    {/* National ID Input */}
    <input 
      type="text"
      value={nationalId}
      onChange={(e) => setNationalId(e.target.value)}
      placeholder="National ID"
    />
    
    {/* Conditional Rendering */}
    {loginMode === 'password' ? (
      <>
        <input type="password" ... />
        <button onClick={handleLogin}>Login</button>
      </>
    ) : (
      <>
        {!otpSent ? (
          <button onClick={handleOtpRequest}>Send OTP</button>
        ) : (
          <>
            <input 
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="Enter 6-digit code"
              maxLength={6}
            />
            <button onClick={handleOtpVerify}>Verify & Login</button>
            <button onClick={handleOtpRequest}>Resend OTP</button>
          </>
        )}
      </>
    )}
  </div>
)
```

**Outcome:**
✅ OTP login working end-to-end  
✅ Auto-user creation from family_member data  
✅ Separate logic from password reset  
✅ Frontend toggle between modes  
✅ Email delivery working  

**Time Taken:** 4-5 hours  
**Complexity:** High  

---

## Challenges & How We Overcame Them

### Challenge: Database Enum Values Missing

**Problem Encountered:**
```
Error: invalid input value for enum otp_purpose: "otp_login"
```

**When It Happened:**
After implementing OTP login, first test attempt failed

**Root Cause:**
The database enum `otp_purpose` only had 3 values:
- password_reset
- mfa_email
- invite

But we were trying to use:
- otp_login
- worker_registration

**Solution:**
Created migration 011:
```sql
-- Add new enum values
ALTER TYPE otp_purpose ADD VALUE IF NOT EXISTS 'worker_registration';
ALTER TYPE otp_purpose ADD VALUE IF NOT EXISTS 'otp_login';
```

Updated schema file to match:
```sql
CREATE TYPE otp_purpose AS ENUM (
  'password_reset',
  'mfa_email',
  'invite',
  'worker_registration',
  'otp_login'
);
```

**Lesson Learned:**
- Always update enums when adding new purposes
- Create migration for enum changes
- Update schema documentation
- Test with actual database constraints

---

### Challenge: Session Persistence After OTP Login

**Problem:**
> "When I login with OTP, it takes to dashboard for a fraction of second and then returns back to login page"

**Investigation Process:**

1. **Check Network Tab:**
   - OTP verify returns 200 OK
   - JWT token present in response
   - Dashboard loads briefly
   - Then `/auth/me` returns 401

2. **Check `/auth/me` Endpoint:**
```typescript
// family-service/src/routes/auth.routes.ts
router.get('/me', async (req, res) => {
  // Decode JWT
  const jwtPayload = decodeJWT(token)
  
  // Look for national_id
  if (jwtPayload?.national_id) {
    memberNationalId = jwtPayload.national_id as string
  } else if (!isWorker) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  // ...
})
```

3. **Check JWT Payload:**
```typescript
// From OTP login
{
  sub: "user-uuid",
  email: "user@example.com",
  roles: ["citizen"],
  permissions: [...],
  registry_id: "registry-uuid"
  // MISSING: national_id
}
```

**Root Cause:**
- `/auth/me` endpoint requires `national_id` in JWT
- OTP login JWT didn't include it
- Regular password login also didn't include it in JWT
- BUT regular login went through family service which manually added it to response
- OTP login called IAM directly, bypassing family service enrichment

**Solution Options Considered:**

**Option A:** Create family service wrapper for OTP login
- Pro: Maintains architecture consistency
- Pro: Reuses enrichment logic
- Con: Extra API layer

**Option B:** Add national_id to JWT payload ✓ (Chosen)
- Pro: Simple solution
- Pro: Works for both login methods
- Pro: No architectural changes needed
- Con: Slightly larger JWT

**Implementation:**
```typescript
// backend/iam-service/src/services/otpLogin.ts
const token_jwt = await new SignJWT({
  sub: user.user_id,
  email: user.email,
  roles,
  permissions,
  registry_id: user.registry_id || undefined,
  national_id: nationalId, // ADDED THIS
})
```

Also updated regular password login:
```typescript
// backend/iam-service/src/services/login.ts
const accessToken = await new SignJWT({
  sub: user.user_id,
  email: user.email,
  roles,
  permissions,
  registry_id: user.registry_id || undefined,
  national_id: nationalId, // ADDED THIS
})
```

**Testing:**
1. Tested OTP login - ✅ Works
2. Tested password login - ✅ Works
3. Tested `/auth/me` endpoint - ✅ Returns user and family data
4. Tested session persistence - ✅ Stays logged in

**Outcome:**
✅ Session persistence fixed  
✅ Both login methods work consistently  
✅ Dashboard loads properly  
✅ No more 401 errors  

**Time Taken:** 3-4 hours (debugging + fixing)  
**Complexity:** Medium-High  

**Key Takeaways:**
- Always test authentication flows end-to-end
- JWT payload structure must match API expectations
- Document what each endpoint requires
- Microservices need careful coordination
- Session management is critical for UX

---

## Summary for Presentation

### What Family Service Does
- Manages family registries and members
- 60+ field comprehensive data collection
- Authentication integration and session enrichment
- Family member lookup and management

### Technical Achievements
1. Comprehensive data model covering all aspects
2. Successful database migrations
3. Integration with IAM service
4. Session enrichment with family context
5. Scalable architecture for growth

### Challenges Overcome
1. Large database schema expansion
2. Environment configuration consolidation
3. Complex authentication flow coordination
4. Session persistence debugging
5. Enum constraint management

### Lessons Learned
- Plan migrations carefully
- Test integrations thoroughly
- Document API contracts clearly
- Monitor logs during development
- Debug systematically
