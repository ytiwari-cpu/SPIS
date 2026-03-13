# Password Reset Flow - Testing Guide

## Overview
Complete password reset flow that allows users to reset their password using their National ID and OTP verification via email.

## Flow Diagram

```
1. User clicks "Forgot password?" on login page
   ↓
2. User enters 14-digit National ID
   ↓
3. System looks up National ID in Registry
   ↓
4. If found → Generate OTP → Send to registered email
   ↓
5. User enters OTP + New Password + Confirm Password
   ↓
6. System verifies OTP → Updates password in IAM
   ↓
7. Redirect to login page → User can login with new password
```

## API Endpoints

### 1. Request Password Reset
**POST** `http://localhost:3003/iam/password-reset/request`

**Request Body:**
```json
{
  "national_id": "12345678901234"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "OTP sent to your registered email address",
  "otp_id": "uuid-here"
}
```

**Possible Errors:**
- `404`: National ID not found in registry
- `409`: No email is registered for this national ID
- `503`: Email Service unavailable

---

### 2. Confirm Password Reset
**POST** `http://localhost:3003/iam/password-reset/confirm`

**Request Body:**
```json
{
  "national_id": "12345678901234",
  "otp": "123456",
  "new_password": "myNewPassword123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password reset successfully",
  "user_id": "uuid-here"
}
```

**Possible Errors:**
- `400`: Password too short (< 8 characters)
- `400`: Invalid OTP
- `404`: No password reset in progress
- `410`: OTP expired (TTL: 10 minutes)
- `429`: Too many incorrect attempts (max 5)

## Frontend Flow

### Step 1: Navigate to Reset Password
- Go to login page: `http://localhost:3000/login`
- Click **"Forgot password?"** link below password field
- Redirects to: `http://localhost:3000/reset-password`

### Step 2: Request OTP
1. Enter your 14-digit National ID
2. Click **"Send OTP"**
3. Wait for success confirmation
4. Check your registered email for OTP code

### Step 3: Set New Password
1. Enter the 6-digit OTP from your email
2. Enter your new password (minimum 8 characters)
3. Confirm your new password
4. Click **"Reset Password"**
5. Success! Automatically redirected to login page

## Testing Scenarios

### ✅ Happy Path
```bash
# 1. Request OTP for valid National ID
curl -X POST http://localhost:3003/iam/password-reset/request \
  -H "Content-Type: application/json" \
  -d '{"national_id":"12345678901234"}'

# Expected: OTP sent to email

# 2. Confirm with valid OTP
curl -X POST http://localhost:3003/iam/password-reset/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "national_id":"12345678901234",
    "otp":"123456",
    "new_password":"MyNewSecurePassword123"
  }'

# Expected: Password reset success
```

### ❌ Error Cases

**Invalid National ID:**
```bash
curl -X POST http://localhost:3003/iam/password-reset/request \
  -H "Content-Type: application/json" \
  -d '{"national_id":"99999999999999"}'

# Expected: 404 - National ID not found
```

**Password Too Short:**
```bash
curl -X POST http://localhost:3003/iam/password-reset/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "national_id":"12345678901234",
    "otp":"123456",
    "new_password":"short"
  }'

# Expected: 400 - Password must be at least 8 characters
```

**Wrong OTP:**
```bash
curl -X POST http://localhost:3003/iam/password-reset/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "national_id":"12345678901234",
    "otp":"000000",
    "new_password":"MyNewSecurePassword123"
  }'

# Expected: 400 - Invalid OTP
```

**Expired OTP (after 10 minutes):**
```bash
# Wait 10+ minutes, then try to confirm
# Expected: 410 - OTP expired
```

## Database Verification

### Check OTP Token Created
```sql
-- IAM Database (wrxrstmncezssrscrkxs)
SELECT 
  id,
  user_id,
  purpose,
  expires_at,
  attempts_count,
  is_used,
  created_at
FROM password_reset_tokens
WHERE purpose = 'password_reset'
ORDER BY created_at DESC
LIMIT 5;
```

### Check Email Request Created
```sql
-- Email Database (qlehzgxxhbbiniouwgta)
SELECT 
  request_id,
  to_email,
  template_code,
  status,
  provider_used,
  sent_at,
  created_at
FROM email_requests
WHERE template_code = 'iam_otp'
ORDER BY created_at DESC
LIMIT 5;
```

### Check User Status Updated
```sql
-- IAM Database
SELECT 
  user_id,
  email,
  status,
  updated_at
FROM users
WHERE national_id_hash = hash_national_id('12345678901234');
```

## Configuration

### OTP Settings (IAM Service)
Located in `backend/iam-service/.env`:
```env
OTP_TTL_MINUTES=10          # OTP expires after 10 minutes
OTP_MAX_ATTEMPTS=5          # Max 5 wrong attempts
PASSWORD_MIN_LENGTH=8       # Minimum password length
```

### Email Templates
The OTP email uses template code `iam_otp` with these variables:
- `otp_code`: The 6-digit OTP
- `expires_at`: Expiration timestamp
- `purpose`: "password_reset"

## Security Features

✅ **OTP Security:**
- Hashed in database (not stored in plaintext)
- 10-minute expiration
- Maximum 5 attempts before invalidation
- Single-use only

✅ **Rate Limiting:**
- Password reset request: 3 requests per 15 minutes per IP
- Password reset confirm: 10 requests per 15 minutes per IP

✅ **National ID Protection:**
- National ID hashed before database storage
- Never exposed in API responses
- Validated against Registry service

✅ **Email Verification:**
- OTP sent to registered email only
- Email cannot be changed via this flow
- Prevents unauthorized access

## Troubleshooting

### OTP Not Received
1. Check Email Service logs: `backend/email-service` terminal
2. Verify SendGrid credentials in `.env`
3. Check email spam folder
4. Verify email address in Registry database

### Password Not Updating
1. Check IAM Service logs: `backend/iam-service` terminal
2. Verify password meets minimum length requirement (8 chars)
3. Check OTP hasn't expired (10 min TTL)
4. Ensure OTP hasn't been used already

### Frontend Not Loading
1. Check frontend dev server: `cd frontend && npm run dev`
2. Verify URL: `http://localhost:3000/reset-password`
3. Check browser console for errors

## Services Status

Verify all services are running:

```bash
# IAM Service (Port 3003)
curl http://localhost:3003/healthz

# Email Service (Port 3002)
curl http://localhost:3002/healthz

# Email Worker (Background)
ps aux | grep "worker:dev"

# Frontend (Port 3000)
curl http://localhost:3000
```

## Success Criteria

✅ User can request OTP with National ID
✅ OTP email delivered to registered address
✅ User can set new password with valid OTP
✅ Password updated in IAM database
✅ User can login with new password
✅ Old password no longer works
✅ OTP becomes invalid after use
✅ Proper error messages for all failure cases
