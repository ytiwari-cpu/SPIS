# Protobuf Migration Prompt — SPIS Backend

> **Status:** Supplementary prompt. Read this alongside `claude_backend_prompt_with_infra_and_central_services.md`.
> This file answers the design questions first, then gives the implementation instructions.

---

## Design Decision — Should SPIS use Protobuf?

### Short answer

| Traffic path | Recommended serialization | Reason |
|---|---|---|
| Frontend → Service (REST API) | **JSON + Zod** (no change) | Browser native, no generated stubs needed, JSON transcoding complexity not worth it for this scale |
| Service → Service (internal calls) | **Protobuf over HTTP/1.1** | 2–10× smaller payloads, schema-enforced, contract versioning |
| Service → Redis (cache) | **JSON** (no change) | Redis strings, TTL-based, easy inspect |
| Audit log → DB | **JSON** (no change) | SQL JSONB column, queryable |

**Decision: Adopt protobuf for internal service-to-service communication only.** The 4 services (iam, family, email, programme) call each other over the Docker network — this is the highest-value migration target.

---

## Why protobuf for internal calls?

1. **Binary encoding** — ~3–10× smaller than JSON for repeated record payloads (e.g., fetching 100 family members)
2. **Schema contract** — `.proto` file is the API contract. Both client and server generate typed stubs from the same file. Any field rename or type change breaks the build — discovered at compile time not in production
3. **Versioning** — fields are numbered (`field_name = 3`). Adding a new optional field with a new number is backwards-compatible. Clients that don't know the field ignore it
4. **No JSON.parse bottleneck** — for high-throughput internal paths (e.g., IAM verifying a token for every request, email queue publishing events) protobuf decoding is significantly faster
5. **gRPC ready** — if horizontal scaling reveals that HTTP/1.1 keeps-alive are not enough, switching to gRPC (HTTP/2 + multiplexed streams) requires only a transport change — the `.proto` files stay the same

### What you lose

- Human-readable wire format (use protobuf decode in dev tools or a REST transcoding layer)
- Simpler debugging (add a JSON fallback endpoint for dev mode)
- No built-in browser support without grpc-web or a transcoding proxy

---

## Do you still need Zod after adopting protobuf?

**YES — Zod stays. They solve different problems.**

| Layer | Tool | Purpose |
|---|---|---|
| External request body validation | **Zod** | Enforce business rules: min/max length, enum whitelist, string patterns, required fields for this operation |
| Internal service-to-service message encoding | **Protobuf** | Compact binary encoding with schema enforcement at the field type level |
| DB query parameter validation | **Zod** (inside ApiSchema) | Already in place via endpoint schema |

Protobuf enforces `string | int32 | bool | repeated` — it does NOT enforce `max length 100`, `must be a valid Nigerian phone number`, or `at least one document must be provided`. Zod handles those rules. They compose cleanly: **Zod validates inbound external request → service logic → Protobuf encodes internal message → target service decodes → target service Zod-validates if needed**.

---

## Do you need to change the frontend?

**No — if you only migrate internal service-to-service calls.**

The frontend talks to each service over REST/JSON. The service REST layer stays JSON. Only the service-to-service transport changes to protobuf. From the frontend's perspective, nothing changes.

**If you later want the frontend to talk protobuf directly** (e.g., for a mobile app with binary transport), you would need:
- `protobuf.js` or `google-protobuf` npm package in the frontend
- Generated JS stubs from your `.proto` files
- Either a gRPC-Web proxy (Envoy) or HTTP/1.1 + binary body with `Content-Type: application/protobuf`

That is out of scope for now. Defer it.

---

## Architecture — Service-to-Service Protobuf

```
┌─────────────────────────────────────────────────────────────┐
│ browser/mobile                                               │
│   JSON (unchanged)                                           │
└────────────────┬─────────────────────────────────────────────┘
                 ↓  REST/JSON (unchanged)
┌────────────────┴────────────────┐
│        Nginx / API Gateway      │
└────────────────┬────────────────┘
                 ↓  REST/JSON (unchanged — public API)
┌────────────────┴────────────────┐
│  family-service                 │
│  programme-service              │ ← JSON for public routes
│  iam-service                    │
│  email-service                  │
└────────┬──────────────┬─────────┘
         ↓ Protobuf/HTTP ↓ Protobuf/HTTP (internal only)
    IAM-service    email-service
    (token verify, (send email events,
     user lookup)   queue publish)
```

Internal calls travel over Docker's `spis-network` bridge — never leave the host. Protobuf payloads are POSTed to internal HTTP endpoints (e.g., `http://iam-service:3003/internal/v1/verify`).

---

## File layout

```
base/
  proto/
    common.proto         ← shared message types (Pagination, Error, AuditEntry)
    iam.proto            ← IAM service messages (VerifyTokenRequest/Response, UserRecord)
    family.proto         ← Family service messages (MemberRecord, FamilyRecord)
    programme.proto      ← Programme service messages (ProgrammeRecord, RegistrationRecord)
    email.proto          ← Email service messages (SendEmailRequest, EmailJobRecord)
  protobuf/
    encode.js            ← encodeMessage(schema, data) → Buffer
    decode.js            ← decodeMessage(schema, buffer) → object
    client.js            ← internalPost(serviceUrl, protoSchema, requestData) → responseData
    middleware.js        ← protobufBody() Express middleware — reads binary body, decodes to req.body
scripts/
  compile-proto.sh       ← runs protoc to compile .proto → JS stubs
```

---

## `.proto` file conventions

```proto
// base/proto/common.proto
syntax = "proto3";
package spis.common;

message Pagination {
  int32 page      = 1;
  int32 page_size = 2;
  int32 total     = 3;
}

message ApiError {
  string code    = 1;
  string message = 2;
  string field   = 3;  // optional — for field-level validation errors
}
```

```proto
// base/proto/iam.proto
syntax = "proto3";
package spis.iam;

import "common.proto";

message VerifyTokenRequest {
  string token = 1;
}

message VerifyTokenResponse {
  string            user_id     = 1;
  string            email       = 2;
  string            national_id = 3;
  repeated string   roles       = 4;
  repeated string   permissions = 5;
  string            registry_id = 6;
}

message UserRecord {
  string user_id     = 1;
  string email       = 2;
  string national_id = 3;
  string full_name   = 4;
  string status      = 5;
  repeated string roles = 6;
}
```

**Naming conventions:**
- Package: `spis.<service>` (all lowercase)
- Messages: PascalCase
- Fields: snake_case (protobuf convention, maps to camelCase in generated JS)
- Field numbers: Never reuse a deleted number — comment out and document: `// string old_field = 3; REMOVED v2`
- Required vs optional: In proto3 all fields are optional (zero values are defaults). Use `oneof` for true mutual exclusivity

---

## Internal protobuf client

```js
// base/protobuf/client.js
import protobuf from 'protobufjs'
import fetch    from 'node-fetch'
import path     from 'path'

const PROTO_DIR = path.resolve(import.meta.dirname, '../proto')

const rootCache = {}

async function loadRoot(protoFile) {
  if (rootCache[protoFile]) return rootCache[protoFile]
  const root = await protobuf.load(path.join(PROTO_DIR, protoFile))
  rootCache[protoFile] = root
  return root
}

/**
 * Send a protobuf-encoded POST to an internal service.
 *
 * @param {string} url                    - full URL e.g. 'http://iam-service:3003/internal/v1/verify'
 * @param {string} protoFile              - e.g. 'iam.proto'
 * @param {string} requestTypeName        - fully-qualified e.g. 'spis.iam.VerifyTokenRequest'
 * @param {string} responseTypeName       - fully-qualified e.g. 'spis.iam.VerifyTokenResponse'
 * @param {object} payload                - plain JS object matching the request message shape
 * @param {{ timeoutMs?: number }} opts
 * @returns {Promise<object>}             - decoded response as plain JS object
 */
export async function internalPost(url, protoFile, requestTypeName, responseTypeName, payload, opts = {}) {
  const root          = await loadRoot(protoFile)
  const RequestType   = root.lookupType(requestTypeName)
  const ResponseType  = root.lookupType(responseTypeName)

  // Validate + encode
  const errMsg = RequestType.verify(payload)
  if (errMsg) throw new Error(`[protobuf] invalid ${requestTypeName}: ${errMsg}`)
  const encoded = RequestType.encode(RequestType.create(payload)).finish()

  const controller = new AbortController()
  const timeout    = setTimeout(() => controller.abort(), opts.timeoutMs ?? 5000)

  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/protobuf', 'Accept': 'application/protobuf' },
      body:    encoded,
      signal:  controller.signal,
    })

    if (!res.ok) throw new Error(`[protobuf] ${url} responded ${res.status}`)

    const buffer = Buffer.from(await res.arrayBuffer())
    return ResponseType.decode(buffer).toJSON()
  } finally {
    clearTimeout(timeout)
  }
}
```

---

## Internal protobuf server middleware

```js
// base/protobuf/middleware.js
import protobuf from 'protobufjs'
import path     from 'path'

const PROTO_DIR = path.resolve(import.meta.dirname, '../proto')

/**
 * Express middleware that decodes a protobuf request body.
 * Attach before your route handler on internal endpoints.
 *
 * Usage:
 *   router.post('/internal/v1/verify',
 *     protobufBody('iam.proto', 'spis.iam.VerifyTokenRequest'),
 *     handler
 *   )
 *
 * Sets req.body to the decoded plain JS object.
 * Sets req.protoResponseType to the string for the caller to use when encoding the response.
 */
export function protobufBody(protoFile, typeName) {
  return async (req, res, next) => {
    if (!req.headers['content-type']?.includes('application/protobuf')) {
      return res.status(415).json({ error: 'Expected Content-Type: application/protobuf' })
    }

    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', async () => {
      try {
        const root    = await protobuf.load(path.join(PROTO_DIR, protoFile))
        const MsgType = root.lookupType(typeName)
        const decoded = MsgType.decode(Buffer.concat(chunks))
        const errMsg  = MsgType.verify(decoded)
        if (errMsg) return res.status(400).json({ error: errMsg })
        req.body = decoded.toJSON()
        next()
      } catch (err) {
        next(err)
      }
    })
  }
}

/**
 * Encode and send a protobuf response.
 *
 * @param {Response} res          - Express response object
 * @param {string} protoFile      - e.g. 'iam.proto'
 * @param {string} typeName       - fully-qualified message name e.g. 'spis.iam.VerifyTokenResponse'
 * @param {object} payload        - plain JS object to encode
 */
export async function sendProtobuf(res, protoFile, typeName, payload) {
  const root    = await protobuf.load(path.join(PROTO_DIR, protoFile))
  const MsgType = root.lookupType(typeName)
  const errMsg  = MsgType.verify(payload)
  if (errMsg) throw new Error(`[protobuf] invalid ${typeName}: ${errMsg}`)
  const encoded = MsgType.encode(MsgType.create(payload)).finish()
  res.set('Content-Type', 'application/protobuf')
  res.send(encoded)
}
```

---

## Internal endpoint example — IAM token verification

```js
// iam-service/src/features/internal/internalController.js
import { protobufBody, sendProtobuf } from '../../../../base/protobuf/middleware.js'
import { verifyJwt }                  from '../../services/verifyJwt.js'

/**
 * POST /internal/v1/verify
 * Internal-only endpoint (blocked at Nginx for external traffic)
 * Accepts: application/protobuf (spis.iam.VerifyTokenRequest)
 * Returns: application/protobuf (spis.iam.VerifyTokenResponse)
 */
export function mountInternalRoutes(router) {
  router.post(
    '/internal/v1/verify',
    protobufBody('iam.proto', 'spis.iam.VerifyTokenRequest'),
    async (req, res, next) => {
      try {
        const { token } = req.body
        const claims    = await verifyJwt(token)   // existing JWT verify logic
        await sendProtobuf(res, 'iam.proto', 'spis.iam.VerifyTokenResponse', {
          userId:      claims.sub,
          email:       claims.email,
          nationalId:  claims.national_id,
          roles:       claims.roles       || [],
          permissions: claims.permissions || [],
          registryId:  claims.registry_id || '',
        })
      } catch (err) {
        next(err)
      }
    }
  )
}
```

---

## Calling an internal endpoint from another service

```js
// family-service/src/features/member/memberService.js
import { internalPost } from '../../../../base/protobuf/client.js'

const IAM_INTERNAL_URL = process.env.IAM_INTERNAL_URL ?? 'http://iam-service:3003'

export async function verifyUserToken(token) {
  return internalPost(
    `${IAM_INTERNAL_URL}/internal/v1/verify`,
    'iam.proto',
    'spis.iam.VerifyTokenRequest',
    'spis.iam.VerifyTokenResponse',
    { token },
    { timeoutMs: 3000 }
  )
}
```

---

## Circuit breaker on internal protobuf calls

Wrap `internalPost` with the `base/circuitBreaker.js` factory — same pattern used by `BaseRepository`:

```js
// family-service/src/features/member/memberService.js
import { createCircuitBreaker } from '../../../../base/circuitBreaker.js'
import { internalPost }         from '../../../../base/protobuf/client.js'

const IAM_INTERNAL_URL = process.env.IAM_INTERNAL_URL ?? 'http://iam-service:3003'

const iamVerifyBreaker = createCircuitBreaker(
  (token) => internalPost(
    `${IAM_INTERNAL_URL}/internal/v1/verify`,
    'iam.proto',
    'spis.iam.VerifyTokenRequest',
    'spis.iam.VerifyTokenResponse',
    { token },
    { timeoutMs: 3000 }
  ),
  { name: 'iam-verify', timeout: 3000, errorThresholdPercentage: 50, resetTimeout: 30000 }
)

export async function verifyUserToken(token) {
  return iamVerifyBreaker.fire(token)
}
```

---

## Nginx — block internal routes from external traffic

Add to `nginx/nginx.conf` (and `nginx/nginx.scale.conf`):

```nginx
# Block all /internal/** routes from reaching upstream — internal-only paths
location ~ ^/(iam|family|programme|email)-service/internal/ {
    return 403;
}
```

Since internal service-to-service calls travel over Docker's `spis-network` directly (bypassing Nginx), this block is a safety net in case a misconfigured route exposes an internal endpoint.

---

## Proto compilation script

```bash
#!/bin/bash
# scripts/compile-proto.sh
# Requires: npm install -g protobufjs-cli

set -e

PROTO_DIR="$(dirname "$0")/../base/proto"
OUT_DIR="$(dirname "$0")/../base/proto/generated"

mkdir -p "$OUT_DIR"

for proto in "$PROTO_DIR"/*.proto; do
  echo "Compiling $proto..."
  pbjs -t static-module -w es6 --es6 -o "$OUT_DIR/$(basename "$proto" .proto).js" "$proto"
  pbts -o "$OUT_DIR/$(basename "$proto" .proto).d.ts" "$OUT_DIR/$(basename "$proto" .proto).js"
done

echo "Done. Generated files in $OUT_DIR"
```

Run after any `.proto` change:
```bash
chmod +x scripts/compile-proto.sh && ./scripts/compile-proto.sh
```

---

## Migration phases

### Phase 1 — Foundation (no service changes yet)
- [ ] Install `protobufjs` in `base/package.json`
- [ ] Write `base/proto/common.proto`, `iam.proto`, `family.proto`, `programme.proto`, `email.proto`
- [ ] Write `base/protobuf/client.js`, `base/protobuf/middleware.js`
- [ ] Write `scripts/compile-proto.sh`
- [ ] Add Nginx block for `/internal/` routes
- [ ] Run compile script — confirm generated stubs with no errors

### Phase 2 — IAM internal verify endpoint
- [ ] Add `/internal/v1/verify` route to IAM service (protobuf body, protobuf response)
- [ ] Add `/internal/v1/user/:id` route (fetch user by ID for family-service use)
- [ ] Test with `curl --data-binary @token.bin -H 'Content-Type: application/protobuf' http://localhost:3003/internal/v1/verify`

### Phase 3 — Family service calls IAM via protobuf
- [ ] Replace family-service's Axios/fetch JSON call to IAM with `internalPost()` call
- [ ] Add circuit breaker wrapper
- [ ] Load test: confirm family-service handles IAM being down (breaker opens, returns 503 gracefully)

### Phase 4 — Email event publishing via protobuf
- [ ] Replace email-service queue publish calls with protobuf-encoded messages
- [ ] Confirm email-service worker decodes and processes correctly
- [ ] Verify email still sends end-to-end

### Phase 5 — All internal calls migrated
- [ ] Grep for any remaining JSON `fetch()` calls between services — migrate to `internalPost()`
- [ ] Add integration tests for each internal endpoint
- [ ] Document all internal endpoints in `backend/docs/INTERNAL_API.md`

---

## Dependencies to add

```json
// base/package.json (or each service's package.json)
{
  "dependencies": {
    "protobufjs": "^7.4.0"
  },
  "devDependencies": {
    "protobufjs-cli": "^1.1.3"
  }
}
```

---

## Verification output required

After completing all phases, provide:
1. Proto files for all 4 services — all messages defined, no unresolved imports
2. `scripts/compile-proto.sh` output — zero errors
3. `curl` test of `/internal/v1/verify` — raw bytes received, decoded, fields match
4. Circuit breaker test — kill IAM service, verify family-service returns 503 not 500
5. Nginx 403 test — `curl http://localhost/iam-service/internal/v1/verify` returns `403 Forbidden`
6. Grep proof — no JSON `fetch()` calls remain between services in the final codebase
