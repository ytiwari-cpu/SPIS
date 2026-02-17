# SPIS Database Setup — Separate Databases Per Service

## 📦 What You Have

I've created **3 separate SQL schema files** for each microservice:

1. **[email-service-schema.sql](email-service-schema.sql)** → Project `qlehzgxxhbbiniouwgta`
2. **[iam-service-schema.sql](iam-service-schema.sql)** → Project `wrxrstmncezssrscrkxs`
3. **[family-service-schema.sql](family-service-schema.sql)** → Project `xdupcfxxcbltjmdgzzhf` (placeholder - you may already have this)

Each schema includes:
- `exec_sql()` and `exec_ddl()` RPC functions (used by the Supabase REST adapter)
- All service-specific tables, indexes, and seed data

---

## 🚀 Setup Instructions

### Step 1: Run Email Service Schema

1. Go to: **https://supabase.com/dashboard/project/qlehzgxxhbbiniouwgta/sql/new**
2. Copy the entire contents of **[email-service-schema.sql](email-service-schema.sql)**
3. Paste into the SQL Editor
4. Click **"Run"**
5. Get the **Service Role Key** from Project Settings → API
6. Update `backend/email-service/.env`:
   ```bash
   SUPABASE_URL=https://qlehzgxxhbbiniouwgta.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<your_email_service_role_key>
   ```

### Step 2: Run IAM Service Schema

1. Go to: **https://supabase.com/dashboard/project/wrxrstmncezssrscrkxs/sql/new**
2. Copy the entire contents of **[iam-service-schema.sql](iam-service-schema.sql)**
3. Paste into the SQL Editor
4. Click **"Run"**
5. Get the **Service Role Key** from Project Settings → API
6. Update `backend/iam-service/.env`:
   ```bash
   SUPABASE_URL=https://wrxrstmncezssrscrkxs.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<your_iam_service_role_key>
   ```

### Step 3: Family Service (Already Configured)

The family service (project `xdupcfxxcbltjmdgzzhf`) should already be set up. If you need to run migrations, check your existing family-service migration files.

---

## 📋 What I Need From You

After running the SQL files in each dashboard, provide:

### For Email Service (`qlehzgxxhbbiniouwgta`):
```
SUPABASE_URL=https://qlehzgxxhbbiniouwgta.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### For IAM Service (`wrxrstmncezssrscrkxs`):
```
SUPABASE_URL=https://wrxrstmncezssrscrkxs.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

You can find the Service Role Keys in each project:
- Dashboard → Project Settings → API → `service_role` key (secret)

---

## 🎯 Why This Approach?

✅ **Isolated databases** - Each service has its own database (proper microservice architecture)  
✅ **IPv6 workaround** - Uses Supabase REST API instead of direct PostgreSQL  
✅ **No pooler issues** - Bypasses Supavisor tenant routing problems  
✅ **Easy to manage** - Each project has its own dashboard, backups, and access control

---

## ⚡ What Happens Next

Once you provide the Service Role Keys, I'll:
1. Update the `.env` files with the correct credentials
2. Start all 4 services (family, email, IAM, frontend)
3. Verify end-to-end connectivity

---

## 🔍 Verification

After running each schema, you can verify it worked:

```sql
-- Run this in the SQL Editor of each project
SELECT * FROM public.exec_sql('SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = ''public''');
```

This should show multiple tables created.
