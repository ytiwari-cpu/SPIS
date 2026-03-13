# SPIS Infrastructure Setup Guide

## 1. Start Redis (Docker)

```bash
docker run -d \
  --name spis-redis \
  --restart unless-stopped \
  -p 6379:6379 \
  redis:7-alpine \
  redis-server --appendonly yes

# Verify
docker logs spis-redis
redis-cli ping  # Should return PONG
```

## 2. Start Keycloak with PostgreSQL Persistence (Docker)

```bash
# Create network
docker network create spis-network

# Start Keycloak with embedded H2 (local storage) + mount volume for persistence
docker run -d \
  --name spis-keycloak \
  --restart unless-stopped \
  --network spis-network \
  -p 8080:8080 \
  -e KEYCLOAK_ADMIN=admin \
  -e KEYCLOAK_ADMIN_PASSWORD=admin \
  -e KC_HTTP_RELATIVE_PATH=/auth \
  -e KC_HEALTH_ENABLED=true \
  -v keycloak-data:/opt/keycloak/data \
  quay.io/keycloak/keycloak:23.0 \
  start-dev

# Wait 30 seconds for Keycloak to start, then verify
curl http://localhost:8080/auth/health/ready
```

**Keycloak will persist:**
- Realm configuration
- Clients (frontend, backend, admin-cli)
- Identity providers (Google)
- User sessions
- MFA configurations (TOTP secrets)

All data stored in Docker volume `keycloak-data`.

## 3. CloudAMQP (Already Configured)

✅ RabbitMQ is ready at `lionfish.rmq.cloudamqp.com`
- Check dashboard: https://customer.cloudamqp.com/instance

## 4. Supabase Databases (Already Configured)

✅ **IAM DB**: `db.wrxrstmncezssrscrkxs.supabase.co`
✅ **Email DB**: `db.qlehzgxxhbbiniouwgta.supabase.co`
✅ **Family DB**: Your existing Supabase project

---

## 5. Configure Keycloak Realm

### Access Keycloak Admin Console
1. Go to http://localhost:8080/auth
2. Click "Administration Console"
3. Login: `admin` / `admin`

### Step 1: Create Realm
1. Hover top-left dropdown → "Create Realm"
2. Realm name: `spis-dev`
3. Click **Create**

### Step 2: Configure User Federation (External Supabase Users)

Since Keycloak doesn't directly support custom SQL user federation in dev mode, we'll use a **hybrid approach**:

**Option A: Sync users via IAM Service (Recommended)**
- IAM service listens to RabbitMQ events (`CREATE_AUTH_ACCOUNT`)
- When family-service creates a user, IAM creates matching Keycloak user
- Password reset flow validates national_id against family-service DB
- MFA data stored in IAM Supabase DB → persists across Keycloak restarts

**Option B: Custom Keycloak User Storage SPI (Advanced)**
- Requires Java extension development
- Not needed for your current architecture

### Step 3: Create Clients

#### Frontend Client (Public - PKCE Flow)
1. Go to **Clients** → **Create client**
2. Settings:
   - Client ID: `frontend`
   - Client type: `OpenID Connect`
   - Click **Next**
3. Capability config:
   - ✅ Standard flow
   - ✅ Direct access grants
   - ❌ Implicit flow
   - ❌ Service accounts roles
   - Click **Next**
4. Login settings:
   - Valid redirect URIs: 
     - `http://localhost:3000/*`
     - `http://localhost:5173/*` (Vite dev)
   - Valid post logout redirect URIs:
     - `http://localhost:3000`
     - `http://localhost:5173`
   - Web origins: `http://localhost:3000`, `http://localhost:5173`
   - Click **Save**
5. Advanced settings:
   - Proof Key for Code Exchange Code Challenge Method: `S256`
   - Click **Save**

#### Backend Client (Confidential)
1. Go to **Clients** → **Create client**
2. Settings:
   - Client ID: `backend`
   - Client type: `OpenID Connect`
   - Click **Next**
3. Capability config:
   - ❌ Standard flow
   - ✅ Direct access grants
   - ✅ Service accounts roles
   - Click **Next**
4. Login settings:
   - Root URL: `http://localhost:3001`
   - Click **Save**
5. Go to **Credentials** tab:
   - Copy the **Client secret**
   - Update in `/backend/iam-service/.env`:
     ```
     KEYCLOAK_BACKEND_CLIENT_SECRET=<paste-secret-here>
     ```

#### Admin CLI Client (Already exists)
1. Go to **Clients** → Find `admin-cli`
2. Click on it → **Settings** tab
3. Capability config:
   - ✅ Service accounts roles
   - Click **Save**
4. Go to **Service account roles** tab
5. Click **Assign role** → Filter by clients → Select:
   - `realm-admin` (from realm-management)
   - Click **Assign**

### Step 4: Configure Google Social Login

1. Go to **Identity Providers** → **Add provider** → Select **Google**

2. Get Google OAuth Credentials:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create project or select existing
   - Enable "Google+ API"
   - Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
   - Application type: Web application
   - Authorized redirect URIs:
     ```
     http://localhost:8080/auth/realms/spis-dev/broker/google/endpoint
     ```
   - Copy **Client ID** and **Client Secret**

3. In Keycloak Google IdP settings:
   - **Client ID**: Paste Google Client ID
   - **Client Secret**: Paste Google Client Secret
   - **Default Scopes**: `openid profile email`
   - **Trust Email**: ✅ ON
   - **First Login Flow**: `first broker login`
   - Click **Save**

4. **Restrict to existing users only:**
   - Go to **Authentication** → **Flows** tab
   - Select **First Broker Login** flow
   - Click **Duplicate** → Name it `Restricted First Broker Login`
   - Edit the flow:
     - Find **Create User If Unique** step → Click **Actions** → **Delete**
     - Find **Automatically Set Existing User** step → Set to **ALTERNATIVE**
   - Add custom step (requires authenticator SPI):
     - Create Java authenticator that checks if email exists in Supabase users table
     - If not found → deny with error "Account not found. Please register first."
   
5. **Simpler approach without custom SPI:**
   - Let Google login create user in Keycloak
   - In IAM service, add middleware to check:
     ```typescript
     // After JWT validation
     const email = jwt.email;
     const existsInRegistry = await registryService.checkEmailExists(email);
     if (!existsInRegistry) {
       await keycloakAdmin.deleteUser(jwt.sub);
       throw new Error('Account not registered');
     }
     ```

### Step 5: Configure Client Mappers (Add registry_id to tokens)

**For Frontend Client:**
1. Go to **Clients** → **frontend** → **Client scopes** tab
2. Click on `frontend-dedicated` scope
3. Go to **Mappers** tab → **Add mapper** → **By configuration**
4. Select **User Attribute**
5. Settings:
   - Name: `registry-id-mapper`
   - User Attribute: `registry_id`
   - Token Claim Name: `registry_id`
   - Claim JSON Type: `String`
   - Add to ID token: ✅
   - Add to access token: ✅
   - Add to userinfo: ✅
   - Click **Save**

**Repeat for Backend Client.**

### Step 6: Password Policy
1. Go to **Realm settings** → **Security defenses** → **Password policy** tab
2. Add policies:
   - Minimum Length: `12`
   - Not Recently Used: `3`
   - Password Blacklist: (upload common passwords file)
   - Hashing Algorithm: `pbkdf2-sha256` or `argon2`
3. Click **Save**

### Step 7: Session Settings
1. Go to **Realm settings** → **Sessions** tab
2. Settings:
   - SSO Session Idle: `30 minutes`
   - SSO Session Max: `10 hours`
   - Offline Session Idle: `30 days`
3. Click **Save**

---

## 6. Run Database Migrations

### Email Service
```bash
cd /home/yuvraj/Desktop/SPIS/backend/email-service
npm run migrate
```

### IAM Service
```bash
cd /home/yuvraj/Desktop/SPIS/backend/iam-service
npm run migrate
```

---

## 7. Start Services

Open 6 terminals:

**Terminal 1: Email API**
```bash
cd /home/yuvraj/Desktop/SPIS/backend/email-service
npm run dev
```

**Terminal 2: Email Worker**
```bash
cd /home/yuvraj/Desktop/SPIS/backend/email-service
npm run worker
```

**Terminal 3: IAM API**
```bash
cd /home/yuvraj/Desktop/SPIS/backend/iam-service
npm run dev
```

**Terminal 4: IAM Worker**
```bash
cd /home/yuvraj/Desktop/SPIS/backend/iam-service
npm run worker
```

**Terminal 5: Family Service**
```bash
cd /home/yuvraj/Desktop/SPIS/backend/family-service
npm run dev
```

**Terminal 6: Frontend**
```bash
cd /home/yuvraj/Desktop/SPIS/frontend
npm run dev
```

---

## 8. Health Checks

```bash
# Redis
redis-cli ping

# Keycloak
curl http://localhost:8080/auth/health/ready

# RabbitMQ (CloudAMQP)
# Check https://customer.cloudamqp.com/instance dashboard

# Email Service
curl http://localhost:3002/healthz

# IAM Service
curl http://localhost:3003/healthz

# Family Service
curl http://localhost:3001/health
```

---

## 9. MFA Persistence Configuration

MFA data (TOTP secrets) are stored in **TWO places**:

1. **Keycloak Database** (Docker volume `keycloak-data`)
   - User MFA credentials
   - TOTP secrets
   - Backup codes
   - **Persists across container restarts**

2. **IAM Service Supabase DB** (`mfa_factors` table)
   - Tracks MFA enrollment status
   - Email OTP fallback
   - Factor verification history
   - **Always persisted**

### To verify MFA persistence:
```bash
# Check Keycloak volume
docker volume inspect keycloak-data

# Restart Keycloak
docker restart spis-keycloak

# MFA should still work after restart
```

---

## 10. Google Login Flow with User Validation

1. **User clicks "Sign in with Google"**
2. **Keycloak redirects to Google OAuth**
3. **Google returns user info (email)**
4. **Keycloak checks if user exists:**
   - If user exists in Keycloak → Login success
   - If new user → Check if email exists in family-service users table
5. **IAM Service validates on first request:**
   ```typescript
   // In auth middleware
   if (jwt.idp === 'google') {
     const registryUser = await registryClient.getUserByEmail(jwt.email);
     if (!registryUser) {
       await keycloakAdmin.deleteUser(jwt.sub);
       throw new UnauthorizedError('Account not found. Please register first.');
     }
     // Cache mapping
     await redis.set(`spis:iam:user:kc:${jwt.sub}`, registryUser.id);
   }
   ```

---

## Quick Start Script

Create `start-infra.sh`:
```bash
#!/bin/bash

echo "🚀 Starting SPIS Infrastructure..."

# Redis
docker start spis-redis 2>/dev/null || docker run -d \
  --name spis-redis \
  --restart unless-stopped \
  -p 6379:6379 \
  redis:7-alpine \
  redis-server --appendonly yes

# Keycloak
docker start spis-keycloak 2>/dev/null || docker run -d \
  --name spis-keycloak \
  --restart unless-stopped \
  -p 8080:8080 \
  -e KEYCLOAK_ADMIN=admin \
  -e KEYCLOAK_ADMIN_PASSWORD=admin \
  -e KC_HEALTH_ENABLED=true \
  -v keycloak-data:/opt/keycloak/data \
  quay.io/keycloak/keycloak:23.0 \
  start-dev

echo "⏳ Waiting for services to be ready..."
sleep 15

echo "✅ Redis: $(redis-cli ping)"
echo "✅ Keycloak: http://localhost:8080/auth"
echo "✅ RabbitMQ: CloudAMQP (check dashboard)"
echo ""
echo "Next steps:"
echo "1. Configure Keycloak realm (see INFRA_SETUP_GUIDE.md)"
echo "2. Run migrations: npm run migrate"
echo "3. Start services: npm run dev"
```

Make executable:
```bash
chmod +x start-infra.sh
./start-infra.sh
```

---

## Troubleshooting

### Keycloak won't start
```bash
docker logs spis-keycloak
# If port 8080 in use:
sudo lsof -i :8080
# Kill conflicting process or change port
```

### Redis connection refused
```bash
docker logs spis-redis
docker restart spis-redis
```

### RabbitMQ connection issues
- Check CloudAMQP dashboard for quota limits
- Verify URL in .env files
- Test with: `curl https://lionfish.rmq.cloudamqp.com`

### MFA not persisting
- Check Keycloak volume: `docker volume inspect keycloak-data`
- Check IAM DB: `SELECT * FROM mfa_factors;`
