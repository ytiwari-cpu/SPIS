# Common Backend Module

Shared services and utilities for all SPIS backend microservices.

## Installation

From any backend service directory:

```bash
cd ../common && npm install && npm run build
```

Then link it in your service:

```bash
npm link ../common
```

Or add it as a local dependency in your service's package.json:

```json
{
  "dependencies": {
    "@spis/common": "file:../common"
  }
}
```

## Usage

### Audit Service

The audit service provides standardized audit logging with custom messages.

```typescript
import { auditService } from '@spis/common'

// Configure (if not using env vars)
auditService.configure(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

// Log a custom action
await auditService.log({
  action: 'CUSTOM_ACTION',
  resourceType: 'entity_type',
  resourceId: 'entity-uuid',
  actorId: req.user.sub,
  actorEmail: req.user.email,
  actorRoles: req.user.roles,
  details: { custom: 'data' },
  message: 'Human-readable audit message'
})

// Convenience methods
await auditService.logRoleChange('ROLE_ASSIGNED', userId, 'Admin', actorId, actorEmail, actorRoles)
await auditService.logPermissionChange('PERMISSION_GRANTED', 'Admin', 'ADMIN.USERS.VIEW', actorId, actorEmail, actorRoles)
await auditService.logDataExport('families', 150, actorId, actorEmail, actorRoles, { status: 'active' })
await auditService.logDataImport('users', 100, 95, 5, actorId, actorEmail, actorRoles, 'job-uuid')
await auditService.logSystemAction('SCHEDULED_CLEANUP', 'expired_tokens', null, { deleted: 50 })
await auditService.logSecurityEvent('FAILED_LOGIN', '192.168.1.1', 'Mozilla/5.0...', { email: 'test@example.com' })
```

## Available Methods

| Method | Description |
|--------|-------------|
| `log(entry)` | Generic audit log entry |
| `logUserAction(action, userId, email, message?, details?)` | User actions (login, logout, etc.) |
| `logRoleChange(action, userId, role, actorId, email, roles)` | Role assignment/revocation |
| `logPermissionChange(action, role, permission, actorId, email, roles)` | Permission grant/revoke |
| `logDataExport(type, count, actorId, email, roles, filters?)` | Data exports |
| `logDataImport(type, total, success, errors, actorId, email, roles, jobId?)` | Data imports |
| `logSystemAction(action, type, id?, details?, message?)` | System/background actions |
| `logSecurityEvent(action, ip, userAgent, details?, message?)` | Security events |

## Environment Variables

- `SUPABASE_URL` - Supabase REST API URL
- `SUPABASE_SERVICE_KEY` - Supabase service role key (for bypass RLS)
