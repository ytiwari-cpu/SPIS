# Redis · Double Requests · Import / Export Prompt

Prompt for fixing Redis caching, duplicate API requests, and implementing Excel import/export with validation.

> **Auth-related items** (multi-tab login, permission-tree VIEW bug, sidebar archive) have been moved to [auth.md](auth.md).

---

## Context

You are a senior full-stack engineer. Audit the entire codebase and fix the issues below. For each item provide: root cause + exact file/function references + changes + verification steps.

---

## Issue 1 — Redis Caching Not Working

Repeated calls to cached endpoints have the same (slow) response time.

**Tasks:**
- Locate caching middleware/service usage for APIs
- Verify Redis connection init, config (host / port / db index), and error handling
- Verify cache key strategy — keys must not vary per call when the request is logically identical
- Ensure cache HIT returns cached payload without hitting DB/service
- Ensure TTL is correct and `SET` is actually executing
- Add dev-only debug: response header `X-Cache: HIT|MISS` and logs of cache keys + hit/miss
- Confirm caching is NOT disabled by auth token or headers unless intentional
- Reproducible test: call endpoint 5 times and show hit/miss results and improved latency

**Deliverable:**
- "Cache Working Report" including:
  - Which endpoints are cached
  - Cache key format
  - TTLs
  - Invalidation rules
  - Evidence (logs / headers)

---

## Issue 2 — Every API Request Sent Twice

Each API call appears twice in the network tab.

**Tasks:**
- Identify root cause:
  - React StrictMode double-invoking effects?
  - Two different fetching mechanisms running in parallel?
  - Axios interceptor replaying requests?
  - Immediate retry logic?
- Fix so only one request is sent per user action
- If StrictMode is the cause: fix effects to be idempotent OR adjust dev behaviour — do **NOT** break production

**Deliverable:**
- Before/after proof: network logs with unique request IDs showing duplicates are gone

---

## Issue 3 — Excel Export

**Current state:** CSV export exists on Families, Programmes, Grievances, Appeals, and Audit Logs pages.

**Requirement:**
- Add **Export as `.xlsx`** option alongside the existing CSV export
- Use `SheetJS (xlsx)` library
- Column headers must match the existing CSV export columns
- Auto-size columns based on content
- Export button is permission-based (`*.EXPORT` permission key)

**Schema for each module:**

| Module | Exported columns |
|---|---|
| Families | Family ID, Head Name, National ID, Phone, Email, Household Size, Programme, Status, Created |
| Programmes | Programme ID, Name, Type, Status, Enrolled Count, Eligible Count, Benefits Disbursed, Last Updated |
| Grievances | Grievance ID, Family ID, Category, Priority, Status, Assigned Admin, Created Date, SLA Due |
| Appeals | Appeal ID, Grievance ID, Family ID, Reason, Status, Reviewer, Submitted Date |
| Audit Logs | Timestamp, Actor, Action, Module, Record ID, Summary, IP Address |

---

## Issue 4 — Excel Import with Validation

**Requirement:**
- Add **Import from `.xlsx`** option on Families, Programmes, Grievances, and Appeals pages
- Strict per-column validation with row-level error reporting

### Step-Form Wizard (2 steps)

**Step 1 — Upload**
- Download template button (generates a blank `.xlsx` with correct headers + hint row showing rules)
- Column reference legend showing field names, required markers, and allowed values
- Drag-and-drop or click-to-browse file upload (`.xlsx` / `.xls` only)

**Step 2 — Verify**
- Summary banner: N valid / N with errors / total rows / filename
- **Error table** — shows ALL columns; each cell displays the value + inline error message underneath for failed fields
- **Valid preview** — shown only when zero errors exist (first 5 rows)
- **Import button** — disabled when any errors exist; label reads "Resolve N errors to import"
- **"Import X valid only"** escape-hatch link — appears when there are both valid and invalid rows
- Download error report button (exports invalid rows + error messages as `.xlsx`)

### Validation Rules per Column Type

| Type | Rule |
|---|---|
| `string` | Optional min/max length |
| `number` | Must parse as number; optional min/max value |
| `email` | Must match `^[^\s@]+@[^\s@]+\.[^\s@]+$` |
| `phone` | Must match `^[\d\s\-+()]{7,15}$` |
| `enum` | Must be one of a static `options[]` list |
| `date` | Must parse to a valid date (e.g. `YYYY-MM-DD`) |
| `lookup` | Must match a value in `lookupValues[]` (runtime reference data, e.g. admin names, programme names); if `lookupValues` is empty, skip validation gracefully |

### Import Column Schemas

**Families**
```
First Name*    string  min:2  max:50
Last Name*     string  min:2  max:50
National ID*   string  min:5  max:20
Phone*         phone
Email          email
Household Size* number  min:1  max:20
Programme      lookup  → programme names from programmes[]
```

**Programmes**
```
Programme Name*  string  min:3  max:100
Programme Type*  enum    CASH_TRANSFER | FOOD_SECURITY | HEALTH | EDUCATION | HOUSING | EMPLOYMENT
Status*          enum    ACTIVE | INACTIVE | SUSPENDED | COMPLETED
Description      string  max:500
```

**Grievances**
```
Family ID*    string
Family Name*  string  min:2  max:100
Category*     enum    PAYMENT_ISSUE | ELIGIBILITY_DISPUTE | SERVICE_COMPLAINT | STAFF_CONDUCT | DATA_CORRECTION | OTHER
Priority*     enum    CRITICAL | HIGH | MEDIUM | LOW
Summary*      string  min:10  max:500
Assigned To   lookup  → active admin names from admins[]
```

**Appeals**
```
Family ID*     string
Family Name*   string   min:2  max:100
Grievance ID*  lookup   → grievance IDs from grievances[]
Reason*        string   min:10  max:1000
Reviewer       lookup   → active admin names from admins[]
```

### After Successful Import

- Rows are appended to local state optimistically
- In production: call the relevant API (`familyApi.create()` etc.) per row
- Imported records show `intake_channel: 'BULK_IMPORT'`

**Deliverable:**
- Validation spec (above)
- Proof import rejects invalid columns/types and accepts valid file
- Error report download works for all modules
