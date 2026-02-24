# Backend Services - Shared Environment Configuration

All backend services now read from a single `.env` file located in the `/backend` directory.

## Setup

1. Copy the example file:
   ```bash
   cd backend
   cp .env.example .env
   ```

2. Update the `.env` file with your actual credentials

3. All services will automatically load configuration from this shared file

## Configuration Structure

### Shared Services
- **RabbitMQ**: Message bus for inter-service communication
- **Keycloak**: Authentication and authorization
- **Redis**: Caching and session management
- **CORS**: Frontend origin configuration

### Service-Specific Configuration

Each service has its own prefixed environment variables:

#### Family Service (Port 3001)
- `FAMILY_SERVICE_PORT`
- `FAMILY_SUPABASE_URL`
- `FAMILY_SUPABASE_ANON_KEY`
- `FAMILY_SUPABASE_SERVICE_ROLE_KEY`
- `FAMILY_OUTBOX_POLL_MS`
- `FAMILY_OUTBOX_BATCH_SIZE`

#### IAM Service (Port 3003)
- `IAM_SERVICE_PORT`
- `IAM_DATABASE_URL`
- `IAM_DB_POOL_MIN`
- `IAM_DB_POOL_MAX`

#### Email Service (Port 3002)
- `EMAIL_SERVICE_PORT`
- `EMAIL_DATABASE_URL`
- `EMAIL_DB_POOL_MIN`
- `EMAIL_DB_POOL_MAX`
- `SENDGRID_API_KEY`
- `SENDGRID_FROM_EMAIL`
- `SENDGRID_FROM_NAME`
- SMTP fallback settings

## How It Works

Each service's `index.ts` loads the shared `.env` file from the parent directory:

```typescript
import { config } from 'dotenv'
import { resolve } from 'node:path'

// Load shared .env from backend root directory
config({ path: resolve(__dirname, '../../.env') })
```

The config files use fallback patterns to support both prefixed and unprefixed variables:

```typescript
// Tries EMAIL_SERVICE_PORT first, then PORT, then default
port: envInt('EMAIL_SERVICE_PORT', envInt('PORT', 3002))
```

## Benefits

✅ **Single Source of Truth**: One file to manage all backend configuration  
✅ **No Duplication**: Shared services (RabbitMQ, Keycloak, Redis) configured once  
✅ **Service Isolation**: Each service can override with prefixed variables  
✅ **Easy Development**: Copy one file and all services are configured  
✅ **Backward Compatible**: Services still support old variable names  

## Migration from Old Setup

If you have existing `.env` files in each service:

1. Merge them into the shared `/backend/.env` file
2. Add service prefixes where needed:
   - `PORT` → `FAMILY_SERVICE_PORT`, `IAM_SERVICE_PORT`, etc.
   - `DATABASE_URL` → `IAM_DATABASE_URL`, `EMAIL_DATABASE_URL`
   - `SUPABASE_URL` → `FAMILY_SUPABASE_URL`
3. Remove individual service `.env` files (keep `.env.example` for reference)

## Security Notes

⚠️ **Never commit the `.env` file to version control**  
⚠️ Keep `.env` in `.gitignore`  
✅ Update `.env.example` when adding new variables  
✅ Use different credentials for dev/staging/production  
