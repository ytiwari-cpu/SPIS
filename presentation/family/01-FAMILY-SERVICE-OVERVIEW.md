# Family Service - Complete Documentation

## Service Overview

**Port:** 3001  
**Purpose:** Manage family registries, family members, and family-related operations  
**Database:** Supabase PostgreSQL (public schema)

---

## Key Features

### 1. Family Registration
- Create new family records with comprehensive data
- 60+ field registration form support
- Family head designation
- Member management
- Document attachment support

### 2. Family Member Management
- Add/update/remove family members
- Relationship tracking
- Member demographics and details
- Health information tracking
- Education and employment data

### 3. Authentication Integration
- Integration with IAM service for authentication
- Session enrichment with family data
- JWT validation and user lookup
- Family-based access control

---

## Development Journey - Family Service

### Initial State
The family service initially had:
- Basic family CRUD operations
- Simple member management
- Basic authentication flow

### Phase 1: Registration Form Expansion

**User Request:**
> "I want to expand the registration form to include 60+ fields covering all aspects of family and member information"

**Implementation Steps:**

1. **Database Schema Analysis**
   - Reviewed existing `family` and `family_member` tables
   - Identified missing fields
   - Planned schema expansion

2. **Created Migration 010**
   - Added 60+ new fields to `family_member` table
   - Fields included:
     - Personal details (name, national ID, DOB, gender, marital status)
     - Contact information (phone, email, address)
     - Demographics (religion, nationality, ethnicity)
     - Family relationships (mother name, father name, spouse)
     - Employment details (occupation, employer, income)
     - Education information (level, institution, field of study)
     - Health data (disabilities, chronic conditions, health insurance)
     - Documentation (ID card, passport, birth certificate)
     - Government benefits and assistance
     - Emergency contact information

3. **Updated TypeScript Interfaces**
   - Created comprehensive `FamilyMember` type
   - Added validation types
   - Updated API request/response types

4. **Frontend Form Implementation**
   - Multi-step registration wizard
   - Field validation and error handling
   - Progress tracking
   - Form state persistence

### Phase 2: Authentication Flow Enhancement

**User Request:**
> "When I login with OTP, it redirects back to login page after brief dashboard display"

**Problem Discovered:**
- The `/auth/me` endpoint expected `national_id` in JWT payload
- OTP login was calling IAM directly, bypassing family service enrichment
- Regular password login went through family service which manually added family data

**Solution Implemented:**
- Updated IAM service to include `national_id` in JWT payload
- Ensured `/auth/me` endpoint could extract user and family data from JWT
- Fixed session persistence issue

### Files Modified

**Key Files:**
1. `/backend/family-service/src/routes/auth.routes.ts`
   - Authentication endpoints
   - `/auth/login` - Password login with family enrichment
   - `/auth/me` - Get current session with family data

2. `/database/migrations/010_update_family_member_table.sql`
   - Added 60+ fields to family_member table
   - Updated constraints and indexes

3. `/frontend/src/pages/registration/RegistrationForm.tsx`
   - Multi-step registration form
   - Field validation
   - Progress tracking

---

## Challenges Faced & Solutions

### Challenge 1: Large Database Migration
**Problem:** Adding 60+ fields in one migration was complex and error-prone

**Solution:**
- Carefully planned field names and types
- Used proper NULL/NOT NULL constraints
- Added default values where appropriate
- Tested migration on development database first

**What We Learned:**
- Always backup database before migrations
- Test migrations incrementally
- Use descriptive field names
- Document field purposes

---

### Challenge 2: Session Persistence with JWT
**Problem:** `/auth/me` endpoint returned 401 after OTP login

**Root Cause Analysis:**
```typescript
// /auth/me endpoint expected this:
if (jwtPayload?.national_id) {
  memberNationalId = jwtPayload.national_id as string
} else if (!isWorker) {
  return res.status(401).json({ error: 'Unauthorized' })
}
```

**Solution:**
- Added `national_id` to JWT payload in IAM service
- Updated both password login and OTP login to include it
- Ensured consistent JWT structure across authentication methods

**What We Learned:**
- Document JWT payload structure clearly
- Ensure consistent token claims across services
- Test authentication flows end-to-end
- Microservices need careful coordination

---

### Challenge 3: Family Member Lookup
**Problem:** Needed to find family member by national_id for session enrichment

**Solution:**
```typescript
// Look up family member by national_id
const { data: member, error: memberError } = await supabase
  .from('family_member')
  .select('*')
  .eq('national_id', cleanNationalId)
  .single()

// Look up family record
const { data: family, error: familyError } = await supabase
  .from('family')
  .select('*')
  .eq('uuid', member.family_uuid)
  .single()
```

**What We Learned:**
- Proper indexing on lookup fields is crucial
- Handle cases where member not found
- Graceful error handling for missing data

---

## API Endpoints

### Authentication Endpoints

#### POST /api/v1/auth/login
**Purpose:** Authenticate user with password and enrich with family data

**Request:**
```json
{
  "national_id": "1234567890123",
  "password": "SecurePassword123"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 86400,
  "user": {
    "user_id": "uuid",
    "email": "user@example.com",
    "national_id": "1234567890123",
    "roles": ["citizen"],
    "permissions": ["read:family"]
  },
  "family": {
    "family_id": "uuid",
    "head_national_id": "1234567890123",
    "address": "...",
    "members_count": 4
  }
}
```

#### GET /api/v1/auth/me
**Purpose:** Get current authenticated user and family data

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response:**
```json
{
  "user": {
    "user_id": "uuid",
    "email": "user@example.com",
    "national_id": "1234567890123",
    "roles": ["citizen"]
  },
  "family": {
    "family_id": "uuid",
    "members": [...],
    "address": "..."
  }
}
```

### Family Management Endpoints

#### POST /api/v1/families
**Purpose:** Create new family registration

**Request:** (60+ fields)
```json
{
  "family": {
    "head_national_id": "1234567890123",
    "address": "123 Main St",
    "city": "Capital City",
    "province": "Central",
    "postal_code": "12345",
    "dwelling_type": "house",
    "ownership_status": "owned"
  },
  "members": [
    {
      "national_id": "1234567890123",
      "first_name": "John",
      "last_name": "Doe",
      "date_of_birth": "1980-01-01",
      "gender": "male",
      "relationship_to_head": "head",
      "phone_number": "+1234567890",
      "email": "john@example.com",
      "marital_status": "married",
      "occupation": "Engineer",
      "monthly_income": 50000,
      "education_level": "bachelors",
      // ... 50+ more fields
    }
  ]
}
```

#### GET /api/v1/families/:id
**Purpose:** Get family details by ID

**Response:**
```json
{
  "family_id": "uuid",
  "head_national_id": "1234567890123",
  "members": [...],
  "address": "...",
  "created_at": "2026-01-15T10:30:00Z",
  "updated_at": "2026-02-10T14:20:00Z"
}
```

---

## Database Schema

### family Table
```sql
CREATE TABLE family (
  uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registry_id UUID REFERENCES registry(id),
  head_national_id VARCHAR(13) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  province VARCHAR(100),
  postal_code VARCHAR(10),
  dwelling_type VARCHAR(50),
  ownership_status VARCHAR(50),
  household_size INTEGER,
  monthly_household_income NUMERIC(12,2),
  has_electricity BOOLEAN,
  has_water BOOLEAN,
  has_sanitation BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### family_member Table (60+ fields)
```sql
CREATE TABLE family_member (
  uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_uuid UUID REFERENCES family(uuid),
  
  -- Basic Identity
  national_id VARCHAR(13) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100),
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE NOT NULL,
  gender VARCHAR(20),
  
  -- Contact
  phone_number VARCHAR(20),
  email VARCHAR(255),
  emergency_contact_name VARCHAR(200),
  emergency_contact_phone VARCHAR(20),
  
  -- Demographics
  nationality VARCHAR(100),
  ethnicity VARCHAR(100),
  religion VARCHAR(100),
  language VARCHAR(100),
  marital_status VARCHAR(50),
  
  -- Family Relations
  relationship_to_head VARCHAR(50),
  father_name VARCHAR(200),
  mother_name VARCHAR(200),
  spouse_name VARCHAR(200),
  spouse_national_id VARCHAR(13),
  
  -- Employment
  occupation VARCHAR(200),
  employer_name VARCHAR(200),
  employment_status VARCHAR(50),
  monthly_income NUMERIC(12,2),
  
  -- Education
  education_level VARCHAR(100),
  current_education_status VARCHAR(50),
  school_name VARCHAR(200),
  field_of_study VARCHAR(200),
  
  -- Health
  has_disability BOOLEAN DEFAULT FALSE,
  disability_type VARCHAR(200),
  chronic_conditions TEXT,
  health_insurance_provider VARCHAR(200),
  health_insurance_number VARCHAR(100),
  
  -- Documents
  id_card_number VARCHAR(50),
  passport_number VARCHAR(50),
  birth_certificate_number VARCHAR(50),
  
  -- Benefits
  receives_government_assistance BOOLEAN DEFAULT FALSE,
  government_assistance_type TEXT,
  
  -- Status
  is_head BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Integration Points

### With IAM Service
- Calls IAM for authentication
- Validates JWT tokens
- Enriches sessions with family data

### With Email Service
- Sends family registration confirmations
- Notifications for member changes
- Document submission notifications

---

## Testing Recommendations

### Unit Tests
- Family creation validation
- Member relationship validation
- Field validation rules
- Permission checks

### Integration Tests
- Complete registration flow
- Authentication with family lookup
- Member CRUD operations
- Session management

### End-to-End Tests
- User registration journey
- Login and access family data
- Update member information
- Document upload flow

---

## Performance Considerations

### Database Optimization
- Index on `national_id` fields for fast lookup
- Index on `family_uuid` for member queries
- Consider partitioning for large datasets

### Caching Strategy
- Cache family data after lookup
- Cache member lists
- Invalidate on updates

### Query Optimization
- Use selective field loading
- Avoid N+1 queries
- Batch member queries

---

## Security Measures

### Data Protection
- National ID stored in plaintext in family service (needed for lookups)
- Proper access control on family data
- Family members can only see their own family
- Workers have limited access based on permissions

### Input Validation
- Sanitize all input fields
- Validate national ID format
- Email and phone validation
- Date range validation

### Audit Logging
- Log all family modifications
- Track who made changes
- Record access attempts

---

## Future Enhancements

### Planned Features
1. **Family Relationship Graph** - Visualize family connections
2. **Document Verification** - Automated document validation
3. **Benefit Calculation** - Automatic eligibility calculation
4. **Timeline View** - Family history timeline
5. **Member Status Tracking** - Life events tracking
6. **Bulk Import** - Import families from CSV/Excel
7. **Export Reports** - Generate family reports
8. **Member Photos** - Profile photo support

### Technical Improvements
1. GraphQL API for flexible queries
2. Real-time updates with WebSockets
3. Advanced search and filtering
4. Data analytics dashboard
5. Mobile app API endpoints
6. Offline support for field workers

---

## Deployment Notes

### Environment Variables
```env
# Family Service Configuration
FAMILY_SERVICE_PORT=3001
FAMILY_SERVICE_DATABASE_URL=postgresql://...
FAMILY_SERVICE_IAM_SERVICE_URL=http://localhost:3003
FAMILY_SERVICE_EMAIL_SERVICE_URL=http://localhost:3002

# JWT Configuration
FAMILY_SERVICE_JWT_SECRET=your-secret-key
FAMILY_SERVICE_JWT_ISSUER=spis-family-service
FAMILY_SERVICE_JWT_AUDIENCE=spis-api
```

### Health Checks
- `GET /healthz` - Service health status
- `GET /readyz` - Service readiness status

---

## Lessons for Presentation

### Key Points to Emphasize
1. **Comprehensive Data Model** - 60+ fields cover all family aspects
2. **Scalable Architecture** - Designed for growth
3. **Security First** - Proper authentication and authorization
4. **User Experience** - Multi-step forms, validation
5. **Integration** - Seamless communication with other services

### Demo Sequence
1. Show database schema with 60+ fields
2. Walk through registration form
3. Demonstrate family lookup after login
4. Show `/auth/me` endpoint response
5. Explain session enrichment process

### Common Questions to Prepare For
- **Q:** Why 60+ fields?  
  **A:** Comprehensive data collection for government services eligibility and family support programs

- **Q:** How do you handle privacy?  
  **A:** Access control, audit logging, secure data transmission

- **Q:** Can families update their information?  
  **A:** Yes, with proper authentication and authorization

- **Q:** How do you prevent duplicate registrations?  
  **A:** National ID uniqueness constraints and validation
