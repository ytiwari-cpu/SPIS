# Prompt: Keycloak → Supabase PostgreSQL Migration + IAM Cleanup
**Target Model:** Claude Opus 4.6  
**Role:** Senior Platform Engineer & IAM Architect  
**Project:** SPIS Jamaica — Social Protection Information System

---

## Context You Must Understand First

### Current Architecture (BROKEN state)
```
Developer A's PC                 Developer B's PC
┌─────────────────────┐         ┌─────────────────────┐
│  Keycloak (Docker)  │         │  Keycloak (Docker)  │
│  + LOCAL H2 volume  │         │  + LOCAL H2 volume  │
│  (private data)     │         │  (private data)     │
└─────────────────────┘         └─────────────────────┘
        ↕ manual sync                    ↕ manual sync
┌────────────────────────────────────────────────────────┐
│           Supabase IAM DB (shared)                     │
│  project: wrxrstmncezssrscrkxs                         │
│  users, user_roles, password_reset_tokens, etc.        │
└────────────────────────────────────────────────────────┘
```
**Problem:** Every developer has a SEPARATE Keycloak instance with its own private user store. 
When teammate A adds a user or someone resets a password, Developer B's Keycloak knows nothing about it.

### Target Architecture (What you must build)
```
Developer A's PC                 Developer B's PC
┌─────────────────────┐         ┌─────────────────────┐
│  Keycloak (Docker)  │         │  Keycloak (Docker)  │
│  --network=host     │         │  --network=host     │
│  socat IPv4→IPv6    │         │  socat IPv4→IPv6    │
└──────────┬──────────┘         └──────────┬──────────┘
           │  JDBC                          │  JDBC
           └──────────────┬─────────────────┘
                          ↓
          ┌───────────────────────────────────┐
          │     Supabase IAM PostgreSQL        │
          │  project: wrxrstmncezssrscrkxs     │
          │  schema: public  → app tables      │
          │  schema: keycloak → KC tables      │
          └───────────────────────────────────┘
```
**Result:** Every developer's local Keycloak reads/writes the SAME database. Users, passwords, 
roles — everything is instantly shared. No sync script ever needed.

---

## Critical Technical Constraint

The Supabase IAM DB hostname `db.wrxrstmncezssrscrkxs.supabase.co` resolves to **IPv6 only**:
```
2406:da14:271:990a:390c:6d0d:f781:66a9
```
Keycloak's JVM defaults to IPv4 (`-Djava.net.preferIPv4Stack=true`) and cannot connect.  
**The solution:** Run `socat` on the HOST as an IPv4→IPv6 bridge:
```bash
socat TCP4-LISTEN:5433,reuseaddr,fork TCP6:[2406:da14:271:990a:390c:6d0d:f781:66a9]:5432 &
```
Then Keycloak (with `--network=host`) connects to `127.0.0.1:5433` via IPv4, 
and socat forwards it to Supabase over IPv6.

---

## Environment Variables (from `/home/yuvraj/Desktop/SPIS/backend/.env`)
```
IAM_SUPABASE_URL=https://wrxrstmncezssrscrkxs.supabase.co
IAM_DATABASE_URL=postgresql://postgres:Argus@12131@db.wrxrstmncezssrscrkxs.supabase.co:5432/postgres
IAM_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
KEYCLOAK_BASE_URL=http://localhost:8080
KEYCLOAK_REALM=spis-dev
KEYCLOAK_ADMIN_USERNAME=admin
KEYCLOAK_ADMIN_PASSWORD=admin
```

---

## Step-by-Step Implementation

### STEP 1 — Install socat
```bash
sudo apt-get install -y socat
```
If sudo is unavailable, check: `which socat`. If missing AND no sudo, use the `nc` pipe 
approach as fallback (see Fallback section at end).

---

### STEP 2 — Update `/home/yuvraj/Desktop/SPIS/start-infra.sh`

Replace the entire Keycloak section with:

```bash
# ── IPv4→IPv6 bridge for Supabase (Keycloak's JVM can't route IPv6) ─────────
SUPABASE_IPV6="2406:da14:271:990a:390c:6d0d:f781:66a9"
SOCAT_PORT=5433

echo "🌉 Starting IPv4→IPv6 bridge for Supabase..."
# Kill any stale socat on this port
pkill -f "socat.*${SOCAT_PORT}" 2>/dev/null || true
socat TCP4-LISTEN:${SOCAT_PORT},reuseaddr,fork \
  "TCP6:[${SUPABASE_IPV6}]:5432" &
SOCAT_PID=$!
echo "  ✅ socat bridge running (PID $SOCAT_PID) → localhost:${SOCAT_PORT} → Supabase"

# Give bridge a moment to bind
sleep 1

# ── Keycloak (uses SHARED Supabase PostgreSQL — no local H2, no manual sync) ─
echo "🔐 Starting Keycloak (shared Supabase backend)..."
docker start spis-keycloak 2>/dev/null || docker run -d \
  --name spis-keycloak \
  --restart unless-stopped \
  --network=host \
  -e KEYCLOAK_ADMIN=admin \
  -e KEYCLOAK_ADMIN_PASSWORD=admin \
  -e KC_HTTP_ENABLED=true \
  -e KC_HTTP_PORT=8080 \
  -e KC_HOSTNAME_STRICT=false \
  -e KC_HOSTNAME_STRICT_HTTPS=false \
  -e KC_HEALTH_ENABLED=true \
  -e KC_DB=postgres \
  -e KC_DB_URL="jdbc:postgresql://127.0.0.1:${SOCAT_PORT}/postgres?sslmode=disable" \
  -e KC_DB_USERNAME=postgres \
  -e KC_DB_PASSWORD='Argus@12131' \
  -e KC_DB_SCHEMA=keycloak \
  quay.io/keycloak/keycloak:24.0 \
  start-dev

echo ""
echo "⏳ Waiting for Keycloak (first boot creates ~100 DB tables, takes ~60s)..."
for i in $(seq 1 36); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health/ready 2>/dev/null)
  if [ "$STATUS" = "200" ]; then
    echo "  ✅ Keycloak ready (${i}×5s)"
    break
  fi
  printf "  ⏳ %d/180s\r" $((i * 5))
  sleep 5
done

echo ""
echo "⚙️  Initializing Keycloak realm & clients (idempotent)..."
set -a; source "$(dirname "$0")/backend/.env" 2>/dev/null; set +a
cd "$(dirname "$0")/backend/iam-service"
node setup-keycloak.mjs 2>&1 | grep -E "✅|ℹ️|❌|COMPLETE|realm|client|role"
cd - > /dev/null
echo "  ✅ Realm ready — all developers share the same Keycloak data automatically"
```

**Also remove** the old sync-users block entirely (no longer needed).

**Also add** socat to the stop-all.sh:
```bash
pkill -f "socat.*5433" 2>/dev/null || true
```

---

### STEP 3 — Remove the Workaround Code

The `password_hash` / `keycloak_username` approach was a temporary workaround. Now that 
Keycloak uses the shared Supabase DB, ALL password data lives in Keycloak's tables. Remove 
the workaround completely:

#### 3a — Drop the columns from Supabase
Run this SQL in the Supabase IAM project SQL editor 
(`https://supabase.com/dashboard/project/wrxrstmncezssrscrkxs/sql/new`):
```sql
ALTER TABLE users DROP COLUMN IF EXISTS password_hash;
ALTER TABLE users DROP COLUMN IF EXISTS keycloak_username;
DROP INDEX IF EXISTS idx_users_keycloak_username;
```

#### 3b — Revert `src/types.ts`
Remove these two lines from `UserRow`:
```typescript
password_hash: string | null
keycloak_username: string | null
```

#### 3c — Revert `src/lib/crypto.ts`
Remove the entire bcrypt section:
```typescript
// REMOVE these lines:
import bcrypt from 'bcrypt'
const BCRYPT_ROUNDS = 10
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}
```
Keep the file starting with `import { randomBytes, createHash } from 'node:crypto'`

#### 3d — Revert `src/db/repository.ts`
Remove the `savePasswordHash` function entirely:
```typescript
// REMOVE this entire function:
export async function savePasswordHash(
  userId: string,
  passwordHash: string,
  keycloakUsername: string,
): Promise<void> { ... }
```

#### 3e — Revert `src/services/passwordReset.ts`
Remove the `savePasswordHash` and `hashPassword` imports, and remove the call after 
Keycloak password update. The comment block and 3 lines to remove:
```typescript
// REMOVE from imports:
import { generateOtp, hashOtp, verifyOtp, hashNationalId, hashPassword } from '../lib/crypto.js'
// REVERT to:
import { generateOtp, hashOtp, verifyOtp, hashNationalId } from '../lib/crypto.js'

// REMOVE from imports:
savePasswordHash,
// (remove from the db/repository.ts import list)

// REMOVE these 4 lines after "logger.info('User created in Keycloak with password'...)":
    // Save bcrypt hash + keycloak username to the shared IAM DB.
    // When any developer runs start-infra.sh (sync), their local Keycloak
    // gets the same password hash — no password reset needed.
    const bcryptHash = await hashPassword(newPassword)
    await savePasswordHash(user.user_id, bcryptHash, nationalId)
    logger.info('Password hash saved to IAM DB for cross-developer sync', { user_id: user.user_id })
```

---

### STEP 4 — Remove `sync-users-to-keycloak.mjs` from workflows

The script `backend/iam-service/sync-users-to-keycloak.mjs` is **no longer needed for daily use** 
since all Keycloak data is in the shared Supabase DB. 

Do NOT delete the file — it may be useful for one-time migration if a developer has 
local-only users. But:

1. Remove all references to it from `start-infra.sh`
2. Add a comment at the top of the file:
```javascript
/**
 * @deprecated This script is NO LONGER NEEDED for normal operation.
 * Keycloak now uses the shared Supabase PostgreSQL database directly.
 * All user data is automatically shared across all developers.
 *
 * This script is kept ONLY for one-time emergency migration from a
 * developer's isolated local Keycloak to the shared Supabase backend.
 */
```

---

### STEP 5 — Handle the `stop-all.sh` and Docker Container Reset

Since the new Keycloak uses `--network=host` (no `-p` port mapping), 
the existing `spis-keycloak` container (with the old config) must be replaced:

```bash
docker stop spis-keycloak 2>/dev/null
docker rm spis-keycloak 2>/dev/null
# (start-infra.sh will create the new one with correct config)
```

**Add this to `stop-all.sh`:**
```bash
pkill -f "socat.*5433" 2>/dev/null && echo "  ✅ socat bridge stopped" || true
```

---

### STEP 6 — Rebuild and Verify

```bash
# 1. Rebuild IAM service (TypeScript)
cd /home/yuvraj/Desktop/SPIS/backend/iam-service && npm run build

# 2. Run full infra startup
cd /home/yuvraj/Desktop/SPIS && bash start-infra.sh

# 3. Verify Keycloak is using Supabase (check a table exists in keycloak schema)
psql "postgresql://postgres:Argus%4012131@db.wrxrstmncezssrscrkxs.supabase.co:5432/postgres" \
  -c "SELECT count(*) as keycloak_tables FROM information_schema.tables WHERE table_schema='keycloak';"
# Should show ~90+ tables

# 4. Test password reset end-to-end
curl -s -X POST http://localhost:3003/iam/password-reset/request \
  -H "Content-Type: application/json" \
  -d '{"national_id": "TEST001"}' | python3 -m json.tool
```

---

### STEP 7 — Update `setup-keycloak.mjs` to be Truly Idempotent

The script already handles 409 (already exists), but add a top-level check so teammates 
who already have the realm set up see a clean one-liner:

```javascript
// Add before createRealm() call:
const realmCheck = await fetch(`${KEYCLOAK_BASE}/admin/realms/${REALM_NAME}`, {
  headers: { 'Authorization': `Bearer ${token}` }
})
if (realmCheck.ok) {
  console.log(`ℹ️  Realm '${REALM_NAME}' already configured — skipping full setup`)
  await printJWKSInfo(token)
  return
}
```

---

## Fallback: If socat is Unavailable and Cannot Be Installed

Use Node.js as the TCP proxy (no sudo required):

Create `/home/yuvraj/Desktop/SPIS/backend/iam-service/ipv4-proxy.mjs`:
```javascript
import net from 'net'
const SUPABASE_IPV6 = '2406:da14:271:990a:390c:6d0d:f781:66a9'
const LOCAL_PORT = 5433

const server = net.createServer(client => {
  const remote = net.connect({ host: SUPABASE_IPV6, port: 5432, family: 6 })
  client.pipe(remote)
  remote.pipe(client)
  remote.on('error', () => client.destroy())
  client.on('error', () => remote.destroy())
})

server.listen(LOCAL_PORT, '127.0.0.1', () => {
  console.log(`IPv4→IPv6 proxy: 127.0.0.1:${LOCAL_PORT} → [${SUPABASE_IPV6}]:5432`)
})
```

Then in `start-infra.sh`, replace the socat line with:
```bash
node /home/yuvraj/Desktop/SPIS/backend/iam-service/ipv4-proxy.mjs &
```

---

## Verification Checklist

After completing all steps, verify:
- [ ] `psql` to Supabase confirms `keycloak` schema has 90+ tables
- [ ] Keycloak Admin UI at `http://localhost:8080/admin` shows `spis-dev` realm
- [ ] A user who resets password on Developer A's machine can log in on Developer B's machine WITHOUT any sync
- [ ] `start-infra.sh` runs end-to-end without manual intervention
- [ ] TypeScript builds cleanly: `npx tsc --noEmit` shows 0 errors related to our changes
- [ ] No `password_hash` or `keycloak_username` columns in the `users` table
- [ ] The `sync-users-to-keycloak.mjs` is marked deprecated and not called by `start-infra.sh`

---

## What NOT to Change
- Do NOT modify the `users`, `user_roles`, `password_reset_tokens`, or any other app tables — those stay in the `public` schema exactly as they are
- Do NOT change any frontend code
- Do NOT change the family-service, email-service, or programme-service
- Do NOT change the JWT signing/verification logic — Keycloak still signs with RS256, services verify the same way
- Do NOT change the OTP flow — it still uses `password_reset_tokens` in the IAM DB

---
*Generated: February 24, 2026 | SPIS Jamaica IAM Migration*
