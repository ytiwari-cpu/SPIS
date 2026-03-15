# SPIS Pending Fixes — Executor Prompt

> **Date:** 2026-03-15
> **Scope:** 5 independent fix areas — each can be tackled in isolation.
> **Rule:** Read every referenced file BEFORE editing. Verify column names against the live DB.

---

## Fix 1 — Zod Response Validation Fails on Error Responses

### Problem
`validateResponse()` in `backend/base/middleware/validate.js` runs on EVERY response —
including error responses shaped `{ success: false, error: { code, message } }`.
The Zod schemas in `*Api.js` files only describe the success shape
(e.g. `z.object({ success: z.boolean(), data: z.array(z.any()) })`),
so any controller that calls `respondBadRequest()` / `respondNotFound()` / `respondError()`
triggers a Zod failure → the error handler fires a 500 RESPONSE_VALIDATION_ERROR instead of
the intended 400/404/500.

### Root Cause
`baseController.js` → `respondJson()` calls `validateResponse(req, result)` unconditionally.
Error responses have `{ success: false, error: {...} }` which doesn't match the success-only schema.

### Fix (1-line change, backend only, zero frontend changes)

**File:** `backend/base/middleware/validate.js` — `validateResponse()` function (line ~70)

Add an early return when the response indicates failure:

```js
export function validateResponse(req, result) {
  const schema = req.responseSchema
  if (!schema) return null
  if (result?.success === false) return null   // ← ADD THIS LINE — errors are shaped by errorHandler, not by route schemas
  // ... rest unchanged
}
```

**Why this is safe:** All error responses are already centrally shaped by `errorHandler.js`
(`{ success: false, error: { code, message, details? } }`). There is no value in
Zod-validating them against per-route success schemas.

### Verification
- Call any endpoint with invalid data → should get a clean 400/422, NOT a 500 RESPONSE_VALIDATION_ERROR.
- Call any endpoint normally → success response still validated by the route's Zod schema.

---

## Fix 2 — Toast Not Showing on Family Update

### Problem
`frontend/src/components/citizen/MyProfile.tsx` uses inline state (`saveSuccess` / `error`)
rendered as green/red banners. The app has a proper toast system
(`frontend/src/contexts/ToastContext.tsx`) that other pages already use
(e.g. `AdminFamilies.tsx` uses `toast.success(...)` / `toast.error(...)`).

### Root Cause
`MyProfile.tsx` was written before the toast context existed, or simply wasn't wired up.

### Fix (frontend only)

**File:** `frontend/src/components/citizen/MyProfile.tsx`

1. Import the toast hook:
   ```tsx
   import { useToast } from '@/contexts/ToastContext'
   ```
2. Inside the component, destructure:
   ```tsx
   const toast = useToast()
   ```
3. In `handleSaveAll` success branch, replace `setSaveSuccess(...)` with:
   ```tsx
   toast.success(result.message || 'All changes saved!')
   ```
4. In catch / error branches, replace `setError(...)` with:
   ```tsx
   toast.error('Failed to save changes. Please try again.')
   ```
5. Remove the `saveSuccess` / `error` state variables and their inline banner JSX
   (`<div className="mb-4 p-4 bg-green-50 ...">`) if they are no longer used elsewhere.

### Verification
- Edit family details → Save → should see a floating toast notification, not an inline banner.
- Trigger an error (e.g. disconnect network) → should see a red toast.

---

## Fix 3 — `family_history` Column Name Mismatch (`family_uuid` doesn't exist)

### Problem
When updating a family (`PATCH /families/:id`), the backend tries to insert into
`family_history` using column `family_uuid` — but the actual DB column is likely `family_id`.

### Root Cause — Conflicting Column Names Across Files
There are 3–4 different naming conventions for the same table:

| File | Column Used | action column | values columns | reason column |
|------|-------------|---------------|----------------|---------------|
| `familyRepository.js` (JS, main) | `family_uuid` | `action_type` | `old_values`, `new_values` | `reason` |
| `familyRepository.js` `getHistory()` | queries by `family_uuid` | — | — | — |
| `historyService.ts` (TS, V2) | `family_id` | `action_type` | `old_values`, `new_values` | `change_reason` |
| `familyHistory.types.ts` | (no family FK col) | `change_type` | `old_value` (singular), `new_value` (singular) | — |
| `family.types.ts` | `family_id` | `action_type` | `old_values`, `new_values` | `change_reason` |

### Fix

**Step 1 — Verify the actual DB schema:**
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'family' AND table_name = 'family_history'
ORDER BY ordinal_position;
```

**Step 2 — Align the JS repository to match the real DB columns.**

The most likely correct column name is `family_id` (matching the TS types and historyService).
Update every `logHistory()` call in `backend/family-service/src/features/family/familyRepository.js`
and the `getHistory()` query to use the actual column names from Step 1.

**Step 3 — Align or deprecate conflicting type files:**
- `backend/family-service/src/types/familyHistory.types.ts` — update to match real columns
- `backend/family-service/src/types/family.types.ts` `FamilyHistory` interface — verify match
- `backend/family-service/src/services/historyService.ts` — verify its INSERT matches real columns

**Step 4 — If no migration exists for `family_history`, create one:**
- Check if `family_history` table already exists in Supabase `family` schema.
- If not, create migration `database/migrations/011_create_family_history.sql` with the
  canonical column names and add it to the migration runner.

### Verification
- `PATCH /api/v1/families/:uuid` with valid update data → should succeed without column errors.
- `GET /api/v1/families/:uuid/history` → should return history entries.

---

## Fix 4 — Grievance System Is Frontend-Only (No Backend)

### Problem
- **Citizen side:** `frontend/src/components/citizen/Grievances.tsx` uses `console.log` on submit.
  No API call is made.
- **Admin side:** `frontend/src/components/superadmin/AdminGrievances.tsx` uses mock data from
  `@/mock/superAdminMockData`. Archive/restore only manipulates local React state — nothing is
  persisted.
- **No backend grievance service exists at all.**

### Scope Assessment
This is a **full feature build**, not a bug fix. It requires:

1. **Database:** Create `grievances` table in a suitable schema (likely `family` or a new `grievance` schema).
   Columns: `grievance_id` (UUID PK), `family_id`, `submitted_by`, `type` (COMPLAINT/REQUEST/FEEDBACK/OTHER),
   `subject`, `description`, `status` (OPEN/IN_PROGRESS/RESOLVED/CLOSED/ARCHIVED), `priority`,
   `assigned_to`, `resolution`, `archived_at`, `archived_by`, `archive_reason`,
   `created_at`, `updated_at`.

2. **Backend (family-service or new grievance-service):**
   - `grievanceRepository.js` — CRUD + archive/restore queries
   - `grievanceService.js` — business logic, status transitions
   - `grievanceController.js` — HTTP handlers
   - `grievanceApi.js` — route definitions with Zod schemas and permissions

   Endpoints:
   | Verb | Path | Permission | Description |
   |------|------|------------|-------------|
   | POST | `/api/v1/grievances` | `GRIEVANCE.CREATE` | Submit grievance |
   | GET | `/api/v1/grievances` | `GRIEVANCE.VIEW` | List (with filters) |
   | GET | `/api/v1/grievances/:id` | `GRIEVANCE.VIEW` | Get detail |
   | PATCH | `/api/v1/grievances/:id` | `GRIEVANCE.UPDATE` | Update status/assignment |
   | PATCH | `/api/v1/grievances/:id/archive` | `ADMIN.GRIEVANCES.ARCHIVE` | Archive with reason |
   | PATCH | `/api/v1/grievances/:id/restore` | `ADMIN.GRIEVANCES.ARCHIVE` | Restore from archive |

3. **Frontend:**
   - Create `frontend/src/services/grievanceApi.ts` with typed API functions.
   - Update `Grievances.tsx` (citizen) to call the real submit endpoint.
   - Update `AdminGrievances.tsx` to fetch from API, archive/restore via API.
   - Remove mock grievance data from `superAdminMockData.ts` once real API is connected.

### Verification
- Citizen submits grievance → persisted in DB → visible in admin panel.
- Admin archives grievance → DB `archived_at` set → grievance hidden from active list.
- Admin restores grievance → DB `archived_at` cleared → grievance visible again.
- Page refresh preserves state (no more local-state-only).

---

## Fix 5 — Caseworker & Case Management Is Frontend-Only (No Backend)

### Problem
- `frontend/src/components/superadmin/AdminCaseWorkers.tsx` and `AdminCaseWorkerDetail.tsx`
  display data from `frontend/src/mock/superAdminMockData.ts` (6 hardcoded workers, 8+ cases).
- No backend service, no database tables, no API endpoints exist for case management.
- "CaseWorker" is currently just an IAM role name — there's no case assignment system.

### Scope Assessment
This is also a **full feature build**. It requires:

1. **Database:** Create tables in `family` schema (or new `cases` schema):
   - `caseworkers` — extends IAM users with caseworker-specific fields: `user_id` (FK to IAM),
     `region`, `status` (ACTIVE/INACTIVE/ON_LEAVE), `max_caseload`, `created_at`, `updated_at`.
   - `cases` — `case_id` (UUID PK), `case_number` (unique, human-readable), `title`, `type`
     (ENROLLMENT/GRIEVANCE/VERIFICATION/UPDATE/ASSESSMENT), `status` (OPEN/IN_PROGRESS/etc.),
     `priority` (LOW/MEDIUM/HIGH/URGENT), `family_id`, `assigned_worker_id` (FK to caseworkers),
     `assigned_by`, `assigned_at`, `due_date`, `completed_at`, `created_at`, `updated_at`.

2. **Backend (family-service or new case-service):**
   - Caseworker endpoints: list, get detail, update status, get workload stats
   - Case endpoints: create, list (with filters), get detail, assign, update status, close

3. **Frontend:**
   - Create `frontend/src/services/caseworkerApi.ts` with typed API functions.
   - Rewrite `AdminCaseWorkers.tsx` and `AdminCaseWorkerDetail.tsx` to use real API.
   - Remove mock caseworker/case data from `superAdminMockData.ts`.

4. **IAM Integration:**
   - When a user is assigned the CaseWorker role, auto-create a `caseworkers` record.
   - Caseworker list endpoint should join with IAM user data for name/email.

---

## Fix 6 — Appeals System Is Frontend-Only (No Backend)

### Problem
- `frontend/src/components/superadmin/AdminAppeals.tsx` uses mock data (5 hardcoded appeals).
- All review/approve/deny/archive/restore operations only update local React state.
- No backend appeal endpoints exist.

### Scope Assessment
Another **full feature build**, closely tied to the Grievance system (appeals reference grievances).

1. **Database:** Create `appeals` table:
   - `appeal_id` (UUID PK), `grievance_id` (FK to grievances), `family_id`, `reason`,
     `status` (PENDING/UNDER_REVIEW/APPROVED/DENIED/INFO_REQUESTED),
     `reviewer_id`, `reviewed_at`, `resolution`, `admin_notes`,
     `archived_at`, `archived_by`, `archive_reason`, `created_at`, `updated_at`.

2. **Backend:** Similar 4-layer pattern as grievances:
   - `appealRepository.js`, `appealService.js`, `appealController.js`, `appealApi.js`
   - Endpoints: create, list, get detail, review (approve/deny/request-info), archive, restore

3. **Frontend:**
   - Create `frontend/src/services/appealApi.ts`.
   - Rewrite `AdminAppeals.tsx` to use real API.
   - Remove mock appeal data from `superAdminMockData.ts`.

4. **Dependency:** Build the Grievance system (Fix 4) FIRST, since appeals reference grievances.

---

## Implementation Order (Recommended)

```
Fix 1 — Zod validation bypass for errors     (5 min,  1 file,  backend only)
Fix 2 — Toast on family update               (15 min, 1 file,  frontend only)
Fix 3 — family_history column alignment       (30 min, 3-5 files, backend only, needs DB verification)
Fix 4 — Grievance backend + frontend wiring   (4-6 hrs, new feature, backend + frontend)
Fix 5 — Caseworker/Case management backend    (6-8 hrs, new feature, backend + frontend + IAM)
Fix 6 — Appeals backend + frontend wiring     (3-4 hrs, new feature, depends on Fix 4)
```

Fixes 1–3 are **bug fixes** — quick, isolated, no new features.
Fixes 4–6 are **feature builds** — require new DB tables, full 4-layer backend, frontend rewrites.
Fix 6 depends on Fix 4 (appeals reference grievances).

---

## Standards Reminder

- **4-layer pattern:** ApiSchema → Controller → Service → Repository
- **BaseRepository:** use `runQuery(sql, params, handleResult)` — `true` = return rows, `false` = return rowCount
- **QueryHelper** for SQL building — import from `base/queryHelper.js`
- **Response envelope:** `{ success: true, data: ... }` for success, `{ success: false, error: { code, message } }` for errors
- **Permissions:** declare in `permission:` key on endpoint definition, use existing RBAC system
- **Zod schemas:** define request/response schemas on every endpoint in the Api.js file
- **Error handling:** throw `ApplicationError.badRequest(...)` etc. — caught by centralized `errorHandler()`
- **No console.log:** use `this.log.info(...)` / `this.log.error(...)` from BaseController, or `createLogger()` in services
