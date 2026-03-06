## Database provider migration guide

This section documents exactly what changes when migrating from Supabase to any other PostgreSQL-compatible provider (Azure Database for PostgreSQL, AWS RDS, Google Cloud SQL, Neon, Railway, self-hosted Postgres, etc.).

### Why the migration is small

The architecture deliberately isolates all provider knowledge into two places:

```
All repositories, services, controllers, ApiSchema, ApiContext, BaseRepository, QueryHelper
  → know nothing about Supabase
  → only call connection.query(sql, params) → { rows, rowCount }

base/db/createConnection.js          ← ONLY file that uses Supabase RPC
Each service's api.js (top 5 lines)  ← ONLY files that hold provider credentials
```

Everything above `createConnection.js` is standard parameterized SQL that runs identically on any PostgreSQL-compatible engine.

> **Why Supabase RPC exists at all**: The Supabase-hosted DB is on an IPv6-only host and this machine has no IPv6 routing. A direct TCP `pg` connection is impossible. `exec_sql / exec_dml / exec_ddl` RPCs are a workaround. On any provider with a standard TCP Postgres endpoint this wrapper is not needed — `pg.Pool` already implements the exact same `{ query(sql, params) → { rows, rowCount } }` interface natively.

---

### Files to change (complete list)

#### 1. `base/db/createConnection.js` — swap the adapter body

```js
// REMOVE (Supabase RPC wrapper — only needed for IPv6 workaround):
import { createClient } from '@supabase/supabase-js'
export function createConnection(supabaseClient) {
  // ... inlineParams, isSelect, hasReturning, supabase.rpc(...)
}

// REPLACE WITH (real pg.Pool — direct TCP connection):
import pg from 'pg'
/**
 * @param {string | object} config  — connection string or pg.Pool config object
 * @returns {{ query(sql, params?): Promise<{ rows, rowCount }>, end(): Promise<void> }}
 */
export function createConnection(config) {
  const pool = new pg.Pool(
    typeof config === 'string' ? { connectionString: config } : config
  )
  pool.on('error', (err) => console.error('[pg pool] idle client error', err))
  return pool   // pg.Pool already has .query() and .end() — interface is identical
}
```

No other file in `base/` changes.

#### 2. Each service's `api.js` — swap credential source

```js
// REMOVE:
import { createClient } from '@supabase/supabase-js'
const supabase   = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const connection = createConnection(supabase)

// REPLACE WITH:
const connection = createConnection(process.env.DATABASE_URL)
// or with individual params:
const connection = createConnection({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl:      { rejectUnauthorized: false },  // required for Azure / RDS
  max:      20,                             // pool size
})
```

Apply to: `family-service/api.js`, `iam-service/api.js`, `programme-service/api.js`, `email-service/api.js`.

#### 3. Per-service Supabase client files — update or delete

| File | Action |
|---|---|
| `family-service/src/lib/supabase.ts` | Keep only `testConnection()` — rewrite it to use `connection.query('SELECT 1')` instead of Supabase client. Remove Supabase import. |
| `programme-service/src/lib/supabase.ts` | Same as above. |
| `iam-service/src/db/pool.ts` | Delete — fully replaced by `createConnection` in `base/`. |
| `email-service/src/db/pool.ts` | Delete — same. |

#### 4. `package.json` in each service — swap dependencies

```jsonc
// REMOVE:
"@supabase/supabase-js": "^2.x.x"

// ADD:
"pg": "^8.x.x"

// For TypeScript services, also add:
"@types/pg": "^8.x.x"
```

Run `npm install` in each service directory after updating.

#### 5. Environment variables — swap in `.env` and `docker-compose.yml`

```bash
# REMOVE per service:
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
IAM_SUPABASE_URL=...
IAM_SUPABASE_SERVICE_ROLE_KEY=...

# ADD (one DATABASE_URL per service, or shared if on same instance):
FAMILY_DATABASE_URL=postgresql://user:pass@host:5432/spis_family?sslmode=require
IAM_DATABASE_URL=postgresql://user:pass@host:5432/spis_iam?sslmode=require
PROGRAMME_DATABASE_URL=postgresql://user:pass@host:5432/spis_programme?sslmode=require
EMAIL_DATABASE_URL=postgresql://user:pass@host:5432/spis_email?sslmode=require
```

#### 6. Transaction helper in `BaseRepository` — small update for real `pg.Pool`

The current `transaction()` sends `BEGIN/COMMIT/ROLLBACK` as independent calls through `connection.query()`. With the Supabase RPC adapter each call is a stateless HTTP request so this works fine. With a real `pg.Pool` all three SQL statements must share the **same TCP client** or they land on different connections and the transaction has no effect. Use `pool.connect()` to get a dedicated client:

```js
// Update base/baseRepository.js transaction():
async transaction(callback) {
  // pg.Pool exposes .connect() for a dedicated client; the Supabase adapter does not
  if (typeof this.connection.connect === 'function') {
    const client = await this.connection.connect()
    try {
      await client.query('BEGIN')
      const txRepo = Object.create(this)
      txRepo.connection = client          // rebind so all queries in callback use same client
      const result = await callback(txRepo)
      await client.query('COMMIT')
      return result
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }
  // Fallback for adapters without .connect() (Supabase RPC):
  await this.connection.query('BEGIN')
  try {
    const result = await callback(this)
    await this.connection.query('COMMIT')
    return result
  } catch (err) {
    await this.connection.query('ROLLBACK')
    throw err
  }
}
```

No repository call sites change — `this.transaction(async (repo) => { ... })` stays identical.

---

### Files that do NOT change

Everything else stays identical — no edits needed:

- `base/queryHelper.js` — builds standard SQL, provider-agnostic
- `base/baseRepository.js` — reads `context.connection`, provider-agnostic
- `base/apiContext.js` — holds the connection opaquely
- `base/apiSchema.js` — forwards connection from options
- `base/baseController.js`, `base/baseService.js` — no DB awareness
- All feature repositories (`*Repository.js`) — use `this.qh()` / `this.query()` / `this.queryOne()` / `this.execute()` only
- All feature services and controllers — no DB awareness
- All SQL in QueryHelper calls — standard PostgreSQL, identical on all providers
- All schema files in `database/` — standard SQL DDL (PostgreSQL JSON operators work on all listed providers)

---

### Migration checklist

```
[ ] 1.  Provision new DB instance and note the connection string
[ ] 2.  Run all schema migrations from database/migrations/ against new DB
[ ] 3.  Migrate data (pg_dump from Supabase → pg_restore to new host)
[ ] 4.  Update base/db/createConnection.js — swap RPC adapter for pg.Pool
[ ] 5.  Update base/baseRepository.js — update transaction() helper (add .connect() branch)
[ ] 6.  Update each service's api.js — swap createConnection() argument
[ ] 7.  Update family-service and programme-service lib/supabase.ts — rewrite testConnection()
[ ] 8.  Delete iam-service/src/db/pool.ts and email-service/src/db/pool.ts
[ ] 9.  Update package.json in all services — add pg, remove @supabase/supabase-js
[ ] 10. Update .env and docker-compose.yml — swap env vars
[ ] 11. Start all 4 services — confirm no import errors
[ ] 12. Run smoke tests — verify reads and writes on all major endpoints
[ ] 13. Verify /health on all 4 services returns { status: 'ok' }
[ ] 14. Remove @supabase/supabase-js from all package.json files once confirmed stable
```
