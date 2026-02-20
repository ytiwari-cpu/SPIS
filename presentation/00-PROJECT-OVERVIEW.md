# SPIS (Social Protection Information System) - Project Overview

## Project Introduction

**SPIS** is a comprehensive Social Protection Information System designed to manage family registries, citizen data, and government services delivery in a secure and efficient manner.

---

## Architecture Overview

### Microservices Architecture

The system follows a microservices architecture with three main backend services:

1. **Family Service (Port 3001)** - Manages family registries, members, and family-related operations
2. **IAM Service (Port 3003)** - Handles authentication, authorization, user management, and OTP operations
3. **Email Service (Port 3002)** - Manages email communications and notifications

### Technology Stack

**Backend:**
- Node.js with TypeScript
- Express.js for REST APIs
- PostgreSQL (Supabase) for database
- JWT for authentication
- RabbitMQ for inter-service communication
- Redis for caching (optional)

**Frontend:**
- React with TypeScript
- Zustand for state management
- React Router for navigation
- Tailwind CSS for styling
- Axios for API communication

**Infrastructure:**
- Docker for containerization
- Supabase for managed PostgreSQL
- Environment-based configuration

---

## Key Features Implemented

### 1. Registration System
- **60+ field comprehensive registration form** with validation
- Multi-step form flow with progress tracking
- Family head and member registration
- Document upload capability
- Form state persistence

### 2. Authentication System
- **Dual Login System:**
  - Password-based login (traditional)
  - OTP-based login (passwordless)
- Password reset functionality
- JWT-based session management
- Multi-factor authentication (MFA) support

### 3. User Management
- Auto-user creation from family member data
- Role-based access control (RBAC)
- Permission management
- User status management (active, pending, disabled, locked)

### 4. Email Communication
- OTP delivery via email
- Password reset emails
- Invitation emails
- Worker registration emails

---

## Development Journey Timeline

### Phase 1: Registration Form Upgrade
- Expanded from basic form to 60+ fields
- Created database migration 010
- Implemented comprehensive validation
- Added document upload support

### Phase 2: Environment Configuration Consolidation
- Unified all environment variables into `/backend/.env`
- Implemented proper environment loading with `dotenv-config.ts`
- Fixed service startup issues

### Phase 3: OTP Login Implementation
- Designed and implemented OTP-based authentication
- Created OTP service in IAM
- Added email OTP delivery
- Integrated frontend UI for OTP login

### Phase 4: Database Schema Updates
- Created migration 011 for OTP purposes enum
- Updated IAM schema with new enum values
- Fixed database constraint issues

### Phase 5: Session Management Fix
- Fixed JWT payload to include national_id
- Resolved session persistence issues
- Ensured proper authentication flow

---

## Current System State

✅ **Completed:**
- Registration form with 60+ fields
- Dual authentication (password + OTP)
- Email service integration
- Database migrations and schema updates
- Environment configuration
- Frontend UI for all features

⚠️ **Redis Warnings:**
- Redis connection errors (non-blocking)
- System works without Redis
- Can be resolved by starting Redis service

---

## Security Features

1. **Password Security:**
   - Bcrypt hashing for passwords
   - Failed login attempt tracking
   - Account lockout after multiple failures

2. **National ID Protection:**
   - National IDs stored as SHA-256 hashes
   - Plaintext national_id only in JWT payload
   - No plaintext storage in database

3. **OTP Security:**
   - 6-digit random OTP generation
   - 10-minute expiration
   - Single-use tokens
   - Purpose-specific OTPs

4. **Session Security:**
   - JWT with HS256 signing
   - 24-hour token expiration
   - Issuer and audience validation
   - IP and user agent logging

---

## API Documentation

### IAM Service Endpoints
- `POST /iam/login` - Password-based login
- `POST /iam/otp-login/request` - Request OTP for login
- `POST /iam/otp-login/verify` - Verify OTP and login
- `POST /iam/password-reset/request` - Request password reset
- `POST /iam/password-reset/confirm` - Confirm password reset
- `POST /iam/mfa/totp/enroll` - Enroll TOTP MFA
- `POST /iam/mfa/totp/verify` - Verify TOTP
- `POST /iam/mfa/email/send` - Send email MFA code
- `POST /iam/mfa/email/verify` - Verify email MFA code
- `POST /iam/invite` - Send user invitation

### Family Service Endpoints
- `POST /api/v1/auth/login` - Family service login (enriched)
- `GET /api/v1/auth/me` - Get current user session
- `POST /api/v1/families` - Create family registration
- `GET /api/v1/families/:id` - Get family details
- More family management endpoints...

### Email Service Endpoints
- `POST /api/email/send` - Send email
- `POST /api/email/otp` - Send OTP email
- `POST /api/email/password-reset` - Send password reset email

---

## Database Schema Highlights

### Key Tables

**IAM Service:**
- `users` - User accounts with hashed national IDs
- `user_roles` - Role assignments
- `user_permissions` - Permission assignments
- `roles` - Available roles
- `permissions` - Available permissions
- `otp_tokens` - OTP storage and tracking
- `login_events` - Login audit trail

**Family Service:**
- `family` - Family registry records
- `family_member` - Individual family members
- `registry` - Registry metadata
- Document and relationship tables

---

## Inter-Service Communication

### Authentication Flow
```
Frontend → Family Service → IAM Service → JWT Generation
                ↓                            ↓
         Family Lookup              Token with Claims
                ↓                            ↓
         Enriched Response ← ← ← ← ← ← Return Token
```

### OTP Login Flow
```
1. User enters national ID
2. IAM searches users table
3. If not found, searches family_member table
4. If found in family_member, creates user account
5. Generates and sends OTP via email service
6. User enters OTP
7. IAM verifies OTP
8. Generates JWT with national_id claim
9. Returns token to frontend
10. Frontend calls /auth/me with token
11. Family service validates and returns user/family data
```

---

## Lessons Learned

### What Worked Well
1. Microservices architecture provided clear separation of concerns
2. TypeScript helped catch errors early
3. Environment consolidation simplified configuration
4. JWT approach worked well for stateless authentication

### Challenges Overcome
1. Environment variable loading across services
2. TypeScript compilation errors with enums and types
3. Database enum constraint violations
4. Session persistence with JWT claims
5. Inter-service authentication flow coordination

### Best Practices Established
1. Early environment variable loading with dotenv-config
2. Consistent error handling across services
3. Comprehensive logging for debugging
4. Database migrations for schema changes
5. Security-first approach with hashing and encryption

---

## Future Enhancements

### Recommended Improvements
1. **Redis Implementation** - Start Redis service to eliminate warnings
2. **API Gateway** - Add API gateway for unified entry point
3. **Rate Limiting** - Enhanced rate limiting on all endpoints
4. **Monitoring** - Add application performance monitoring
5. **Testing** - Unit and integration tests
6. **Documentation** - OpenAPI/Swagger documentation
7. **Deployment** - Docker compose for easy deployment
8. **Logging** - Centralized logging with ELK stack

### Feature Roadmap
1. Document verification system
2. Family member relationship management
3. Benefit distribution tracking
4. Reporting and analytics dashboard
5. Mobile application
6. SMS OTP as backup to email
7. Biometric authentication integration
8. Multi-language support

---

## Presentation Tips

### What to Highlight
1. **Problem Statement** - Why SPIS was needed
2. **Architecture Decision** - Why microservices
3. **Security Approach** - How data is protected
4. **Development Process** - Iterative improvements
5. **Challenges & Solutions** - Real problems solved
6. **Live Demo** - Show working OTP login
7. **Code Quality** - TypeScript, clean architecture
8. **Scalability** - How system can grow

### Demo Flow
1. Show registration form (60+ fields)
2. Demonstrate password login
3. Demonstrate OTP login (most impressive)
4. Show dashboard with family data
5. Explain JWT token structure
6. Show database schema
7. Walk through code architecture

---

## Contact & Resources

- **Project Repository:** SPIS
- **Database:** Supabase PostgreSQL
- **Development Environment:** Node.js 18+, TypeScript 5+
- **Architecture:** Microservices with REST APIs
