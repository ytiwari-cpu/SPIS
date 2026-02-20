# Super Admin User Creation Guide

## User Details
- **National ID:** 00000000000000
- **Email:** ytiwari@argusoft.com
- **Password:** Argus@1213141

## Option 1: Using Supabase SQL Editor (Recommended)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/wrxrstmncezssrscrkxs
2. Navigate to: **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy and paste the SQL below:

```sql
-- Create Super Admin User
DO $$
DECLARE
  v_user_id UUID;
  v_password_hash TEXT := '$2b$10$MADxE4LpwGUIfIxWwhdAre901nB.NufibcAky2vPlYAMbk9kNSkEC';
  v_national_id_hash TEXT := '2e6e15a38c6fe8b624fca13be00a737947a8096fd5620795696b5b63cd7feea4';
  v_email TEXT := 'ytiwari@argusoft.com';
BEGIN
  -- Check if user exists
  SELECT user_id INTO v_user_id
  FROM users
  WHERE email = v_email OR national_id_hash = v_national_id_hash;

  IF v_user_id IS NOT NULL THEN
    -- Update existing user
    UPDATE users
    SET password_hash = v_password_hash,
        status = 'active',
        national_id_hash = v_national_id_hash,
        updated_at = NOW()
    WHERE user_id = v_user_id;
    
    RAISE NOTICE 'Updated existing user: %', v_user_id;
  ELSE
    -- Create new user
    INSERT INTO users (email, password_hash, national_id_hash, status)
    VALUES (v_email, v_password_hash, v_national_id_hash, 'active')
    RETURNING user_id INTO v_user_id;
    
    RAISE NOTICE 'Created new user: %', v_user_id;
  END IF;

  -- Ensure SuperAdmin role is assigned
  INSERT INTO user_roles (user_id, role_name)
  VALUES (v_user_id, 'SuperAdmin')
  ON CONFLICT (user_id, role_name) DO NOTHING;

  RAISE NOTICE 'SuperAdmin role assigned';
END $$;

-- Verify the user was created
SELECT 
  u.user_id,
  u.email,
  u.status,
  ur.role_name,
  u.created_at
FROM users u
LEFT JOIN user_roles ur ON u.user_id = ur.user_id
WHERE u.email = 'ytiwari@argusoft.com';
```

5. Click **Run** (or press Ctrl+Enter)
6. You should see the user details in the results

## Option 2: Manual Creation via Supabase Table Editor

### Step 1: Create User
1. Go to **Table Editor** → **users** table
2. Click **Insert** → **Insert row**
3. Fill in:
   - email: `ytiwari@argusoft.com`
   - password_hash: `$2b$10$MADxE4LpwGUIfIxWwhdAre901nB.NufibcAky2vPlYAMbk9kNSkEC`
   - national_id_hash: `2e6e15a38c6fe8b624fca13be00a737947a8096fd5620795696b5b63cd7feea4`
   - status: `active`
4. Click **Save**
5. Note the generated `user_id` (UUID)

### Step 2: Assign SuperAdmin Role
1. Go to **Table Editor** → **user_roles** table
2. Click **Insert** → **Insert row**
3. Fill in:
   - user_id: [paste the UUID from step 1]
   - role_name: `SuperAdmin`
4. Click **Save**

## Login Instructions

After creating the user, you can login at your SPIS portal:

1. Navigate to the login page
2. Enter credentials:
   - **National ID:** `00000000000000`
   - **Password:** `Argus@1213141`
3. Click **Login**

You should now have full SuperAdmin access including:
- Access to `/admin` dashboard
- Ability to manage all role permissions
- Full system access

## Verify Permissions

After logging in, check that you have all permissions:
```bash
# In browser console after login:
const session = JSON.parse(localStorage.getItem('spis-auth-storage'))
console.log('Roles:', session.state.session.roles)
console.log('Permissions:', session.state.session.permissions)
```

You should see:
- Roles: `["SuperAdmin"]`
- Permissions: [all 19 permissions listed]

## Troubleshooting

If login fails:
1. Verify user exists: Check Supabase **users** table
2. Verify role assigned: Check Supabase **user_roles** table
3. Verify permissions seeded: Check Supabase **permissions** and **role_permissions** tables
4. Check backend logs: `backend/iam-service/logs/iam-service.log`

## Password Hash Details

The password hash was generated using:
```javascript
bcrypt.hash('Argus@1213141', 10)
// Result: $2b$10$MADxE4LpwGUIfIxWwhdAre901nB.NufibcAky2vPlYAMbk9kNSkEC
```

The national_id hash was generated using:
```javascript
crypto.createHash('sha256').update('00000000000000').digest('hex')
// Result: 2e6e15a38c6fe8b624fca13be00a737947a8096fd5620795696b5b63cd7feea4
```
