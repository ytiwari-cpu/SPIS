# Role-Based Permission System - Implementation Summary

## Overview
Successfully implemented a comprehensive role-based permission system for SPIS with granular access control.

## Database Schema (IAM Service)

### Tables Created
1. **permissions** - Defines all available system permissions
   - permission_key (unique): e.g., 'view_grievances', 'manage_users'
   - permission_name: Display name
   - module: Grouping (citizen, admin, caseworker, grievances)
   
2. **role_permissions** - Links roles to permissions (many-to-many)
   - role_name: References user_roles.role_name
   - permission_key: References permissions.permission_key
   - granted_by: Audit trail

### Default Permissions Seeded (19 total)
**Citizen Portal:**
- view_dashboard, view_family, edit_family
- view_profile, edit_profile
- view_documents, upload_documents
- view_programmes, apply_programmes
- view_benefits
- ~~view_grievances~~ (EXCLUDED by default)
- ~~submit_grievances~~ (EXCLUDED by default)

**Admin:**
- manage_roles, manage_permissions
- manage_users, view_audit_logs

**Case Worker:**
- verify_documents, review_applications, manage_cases

### Default Role Configurations
- **Citizen**: All citizen permissions EXCEPT grievances (disabled as requested)
- **Admin/SuperAdmin**: All permissions
- **CaseWorker**: Citizen + verification permissions

## Backend Implementation

### IAM Service (`backend/iam-service/`)

**New Files:**
- `src/db/007_permissions.sql` - Migration script
- `src/routes/admin.routes.ts` - Admin API endpoints

**Modified Files:**
- `src/db/repository.ts` - Added permission query functions:
  - `getAllPermissions()`, `getRolePermissions()`, `getUserPermissions()`
  - `grantPermissionToRole()`, `revokePermissionFromRole()`
  - `userHasPermission()`
  
- `src/services/login.ts` - Updated to include permissions in JWT:
  ```typescript
  {
    sub, email, roles,
    permissions: ['view_dashboard', 'view_family', ...],
    registry_id
  }
  ```

- `src/middleware/auth.ts` - Added `requirePermissions()` middleware

- `src/index.ts` - Mounted admin router at `/iam/admin/*`

**New API Endpoints:**
```
GET    /iam/admin/permissions                    - Get all permissions
GET    /iam/admin/roles/:roleName/permissions    - Get role's permissions
POST   /iam/admin/roles/:roleName/permissions    - Grant permission
DELETE /iam/admin/roles/:roleName/permissions/:key - Revoke permission
GET    /iam/admin/users/:userId/permissions      - Get user's permissions
```

### Family Service (`backend/family-service/`)

**Modified Files:**
- `src/routes/auth.routes.ts` - Updated login response to include `permissions` array

## Frontend Implementation

### New Pages
- `src/pages/admin/AdminDashboard.tsx` - Super Admin dashboard:
  - Role selector dropdown
  - Permissions grouped by module
  - Toggle buttons to grant/revoke permissions
  - Real-time updates

### Modified Files

**Auth Store (`src/store/authStore.ts`):**
```typescript
interface AuthState {
  hasPermission: (permission: string) => boolean
  hasRole: (role: string) => boolean
}
```

**Types (`src/types/database.ts`):**
```typescript
interface AuthSession {
  permissions?: string[]  // Added
}
```

**Layout (`src/layouts/CitizenLayout.tsx`):**
- Navigation items filtered based on `hasPermission()`
- Grievances link hidden if user lacks `view_grievances` permission
- Admin link shown only to SuperAdmin/Admin roles

**Routing (`src/App.tsx`):**
- Added `/admin` route for AdminDashboard

## How It Works

### 1. Login Flow
```
User logs in
  ↓
IAM service validates credentials
  ↓
Queries user_roles table → ['Citizen']
  ↓
Joins role_permissions → ['view_dashboard', 'view_family', ...]
  ↓
Generates JWT with roles + permissions
  ↓
Returns token to frontend
  ↓
Frontend stores in authStore
```

### 2. Permission Check (Frontend)
```typescript
// In components
const { hasPermission } = useAuthStore()

if (hasPermission('view_grievances')) {
  // Show grievances link
}
```

### 3. Permission Management (Admin)
```
Super Admin logs in
  ↓
Navigates to /admin
  ↓
Selects role (e.g., 'Citizen')
  ↓
Sees all permissions grouped by module
  ↓
Toggles permission (e.g., enable 'view_grievances')
  ↓
POST /iam/admin/roles/Citizen/permissions
  { permission_key: 'view_grievances' }
  ↓
Permission granted in database
  ↓
Next citizen login includes updated permissions
```

## Current State

### ✅ Completed
1. Database schema with permissions and role_permissions tables
2. 19 default permissions seeded
3. Citizen role configured WITHOUT grievances access
4. Backend API for permission management
5. JWT includes permissions array
6. Frontend admin dashboard functional
7. Dynamic navigation based on permissions
8. Permission checks in authStore

### Testing Steps

**Test 1: Citizen without grievances permission**
```bash
# Login as citizen
# Check navigation - should NOT see Grievances link
# Check token - should NOT include 'view_grievances'
```

**Test 2: Super Admin configures permissions**
```bash
# Login as admin user with SuperAdmin role
# Navigate to /admin
# Select Citizen role
# Toggle "View Grievances" to Granted
# Verify success message
```

**Test 3: Citizen with grievances enabled**
```bash
# Login as citizen (after admin grants permission)
# Check navigation - SHOULD see Grievances link
# Check token - SHOULD include 'view_grievances'
```

## Admin Access

To create a Super Admin user:
```sql
-- 1. Create user in IAM database
INSERT INTO users (email, password_hash, status) 
VALUES ('admin@spis.gov', '[bcrypt_hash]', 'active');

-- 2. Grant SuperAdmin role
INSERT INTO user_roles (user_id, role_name) 
VALUES ('[user_id]', 'SuperAdmin');
```

Or use existing citizen with SuperAdmin role assigned.

## Configuration

### Environment Variables (No changes needed)
```env
# IAM Service (.env)
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
```

### Feature Flags
To disable a feature for all citizens:
1. Login as SuperAdmin
2. Go to `/admin`
3. Select "Citizen" role
4. Find the permission (e.g., "View Grievances")
5. Click "Revoke"

## Architecture Benefits

1. **Granular Control**: Permissions at feature level
2. **Dynamic**: No code changes needed to enable/disable features
3. **Auditable**: All changes logged with granted_by
4. **Scalable**: Easy to add new permissions
5. **Type-Safe**: TypeScript interfaces for permissions
6. **Real-time**: Changes affect new logins immediately

## Future Enhancements

1. Add permissions for:
   - Document verification approval
   - Programme application management
   - User management
   - System configuration

2. Add permission groups/presets
3. Add time-based permissions (temporary access)
4. Add permission inheritance
5. Add audit log viewing for permission changes

## Files Modified/Created

### Backend
```
backend/iam-service/
  src/db/007_permissions.sql          [NEW]
  src/routes/admin.routes.ts          [NEW]
  src/db/repository.ts                [MODIFIED]
  src/services/login.ts               [MODIFIED]
  src/middleware/auth.ts              [MODIFIED]
  src/index.ts                        [MODIFIED]

backend/family-service/
  src/routes/auth.routes.ts           [MODIFIED]
```

### Frontend
```
frontend/src/
  pages/admin/
    AdminDashboard.tsx                [NEW]
    index.ts                          [NEW]
  store/authStore.ts                  [MODIFIED]
  types/database.ts                   [MODIFIED]
  layouts/CitizenLayout.tsx           [MODIFIED]
  App.tsx                             [MODIFIED]
```

## Notes

- Grievances feature is **disabled** for citizens by default (as requested)
- SuperAdmin can toggle it on/off via the dashboard
- All existing citizens will need to re-login to get updated permissions
- Permissions are validated on both frontend (UX) and backend (security)
