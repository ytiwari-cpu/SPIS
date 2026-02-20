You are Opus 4.6 acting as a PRINCIPAL SOFTWARE ARCHITECT.

Your task is to REFACTOR the Family Registration Wizard and the
Citizen Portal Documents page in the existing SPIS codebase.

This is NOT a greenfield build. The codebase already exists.
You are modifying EXISTING files in place.

══════════════════════════════════════
0. PRE-WORK — READ LIVE SCHEMA FROM DATABASE
══════════════════════════════════════

BEFORE writing any code, discover the authoritative schema
from the LIVE Supabase database. DO NOT rely on any local
schema.sql or migration files.

Run the following SQL against the Supabase project
(via the backend supabase client or Supabase SQL editor):

```sql
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'family'
ORDER BY table_name, ordinal_position;
```

Use the returned column list as the SINGLE SOURCE OF TRUTH
for every table reference, insert, select, or type definition
you generate. If a column does not exist in the live DB,
DO NOT reference it. If an extra column exists that the current
code does not use, note it but do not break anything.

══════════════════════════════════════
1. EXISTING CODEBASE LAYOUT
══════════════════════════════════════

Paths you will be editing (all paths relative to project root):

frontend/
  src/
    pages/
      registration/RegistrationWizard.tsx   ← wizard (4 steps today)
      citizen/Documents.tsx                 ← citizen portal doc page
    services/familyApi.ts                   ← API helper
    types/index.ts                          ← shared TS types

backend/family-service/
  src/
    routes/
      upload.routes.ts        ← multer file upload endpoints
      registration.routes.ts  ← 9-step registration API
      document.routes.ts      ← document CRUD + verification

Technology stack:
  Frontend : React 18 + TypeScript + Vite + Tailwind CSS
  Backend  : Express + TypeScript + Supabase JS client
  Storage  : Supabase Storage (buckets)
  DB       : Supabase PostgreSQL, schema = "family"
  Uploads  : multipart/form-data via multer → Supabase Storage

══════════════════════════════════════
2. CURRENT WIZARD STEP ORDER (BEFORE)
══════════════════════════════════════

  Step 1 → Family Details + Address
  Step 2 → Family Documents (upload)
  Step 3 → Family Members (each member has an embedded doc-upload sub-phase)
  Step 4 → Review & Submit

══════════════════════════════════════
3. NEW WIZARD STEP ORDER (AFTER)
══════════════════════════════════════

  Step 1 → Family Details + Address          (UNCHANGED)
  Step 2 → Family Members                    (NO doc upload per member)
  Step 3 → Document Uploads                  (UNIFIED — moved to end)
  Step 4 → Review & Submit

RULES:
  • Step 2 (Members) must COMPLETELY REMOVE
    the embedded "docs phase" sub-flow that currently
    fires after each member is created.
    After a member is saved, the wizard must immediately
    loop to the next member form (or advance to Step 3
    when all members are added).

  • Step 3 (Document Uploads) is a SINGLE unified step with:
      ─ A dropdown to select DOCUMENT TYPE
        (populated from the document_type values the DB accepts,
         e.g. proof_of_address, income_statement, birth_certificate,
         profile_photo, passport, utility_bill, national_id, other).
      ─ A dropdown to select DOCUMENT HOLDER
        (dynamically built from the entities created so far):
          • "Family — <family_id>"
          • "Member — <first_name> <last_name> (Head)"
          • "Member — <first_name> <last_name>"
          • … one entry per saved member
      ─ A file input (drag-and-drop zone + click-to-browse)
      ─ An "Upload" button that POSTs to the correct endpoint:
          If holder is Family  → POST /api/v1/upload/family/:familyUuid/documents
          If holder is Member  → POST /api/v1/upload/member/:memberUuid/documents
      ─ A list of ALREADY UPLOADED documents with:
          • file name, document type, holder name
          • a REMOVE button per row that calls
            DELETE /api/v1/upload/:ownerType/:ownerId/documents/:documentId
      ─ The step is OPTIONAL — the user can skip straight to Review.

══════════════════════════════════════
4. BACKEND CHANGES
══════════════════════════════════════

4.1 upload.routes.ts
  • ADD a DELETE endpoint if it does not already exist:
      DELETE /api/v1/upload/:ownerType/:ownerId/documents/:documentId
    Behavior:
      1. Delete the file from Supabase Storage.
      2. Delete the row from family.documents where
         document_id = :documentId
         AND owner_type = UPPER(:ownerType)
         AND owner_id   = :ownerId.
      3. Write a family_history entry (delete action).
      4. Return { success: true }.

4.2 registration.routes.ts
  • Remove any per-member document creation logic that is
    tightly coupled to the member-creation step (Step 7 in the
    9-step backend). Document upload remains available via the
    upload.routes.ts endpoints and is invoked only from the
    new unified Step 3 on the frontend.

4.3 document.routes.ts
  • ADD a DELETE endpoint if missing:
      DELETE /api/v1/documents/:documentId
    Behavior:
      1. Fetch the document row to get file_path.
      2. Delete from Supabase Storage.
      3. Delete the DB row.
      4. Return { success: true }.

══════════════════════════════════════
5. CITIZEN PORTAL — DOCUMENTS PAGE
══════════════════════════════════════

File: frontend/src/pages/citizen/Documents.tsx

This page currently shows mock data.
Replace it with a LIVE, functional page:

5.1 UPLOAD SECTION (top of page)
  ─ Dropdown: Document Type
  ─ Dropdown: Document Holder
      (Family, or any member — fetched from
       GET /api/v1/registration/family/:familyUuid
       which returns family + members)
  ─ File input (drag-and-drop + click)
  ─ "Upload" button → POST to the correct upload endpoint
  ─ Show inline success / error feedback

5.2 DOCUMENT LIST (below upload)
  ─ Fetch from:
      GET /api/v1/documents/family/:familyUuid   (family docs)
      GET /api/v1/documents/member/:memberUuid    (per member)
    Merge results into one list.
  ─ Each row shows:
      • Document type label
      • Holder name (Family or Member name)
      • File name
      • Status badge (PENDING / VERIFIED / REJECTED)
      • Uploaded date
      • Action buttons:
          ─ "View"   → opens signed URL in new tab
          ─ "Download" (if VERIFIED)
          ─ "Remove" → calls DELETE endpoint, removes row from list
          ─ "Re-upload" (if REJECTED) → opens file picker, replaces file

5.3 REMOVE FLOW
  ─ On "Remove" click → show a confirmation dialog
    ("Are you sure you want to remove <file_name>?")
  ─ On confirm → DELETE /api/v1/upload/:ownerType/:ownerId/documents/:documentId
  ─ On success → remove card from UI, show toast "Document removed"
  ─ On error → show toast with error message

══════════════════════════════════════
6. SHARED RULES
══════════════════════════════════════

• Frontend NEVER talks directly to Supabase.
  All data flows through the Express backend.

• Every destructive action (delete) MUST write to family_history
  via historyService.

• All owner_type values are UPPERCASE: 'FAMILY' | 'MEMBER'.

• Use the existing isUuid() helper that already exists in
  upload.routes.ts, registration.routes.ts, document.routes.ts.

• Reuse the existing DocumentUpload component's styling where
  possible, but refactor its props to accept the new holder
  dropdown data.

• Keep existing Tailwind class conventions and dark-mode support.

• Do NOT modify the database schema. Work with the columns
  returned by the live schema query in Step 0.

• Do NOT remove future placeholder pages (Programmes, Benefits,
  Grievances).

══════════════════════════════════════
7. DELIVERABLES — EXACT FILE CHANGES
══════════════════════════════════════

Generate the COMPLETE updated code for each file below.
Do not generate partial snippets — output the FULL file contents.

1. frontend/src/pages/registration/RegistrationWizard.tsx
   — New 4-step flow: Family+Address → Members (no docs) →
     Unified Docs → Review

2. frontend/src/pages/citizen/Documents.tsx
   — Live upload, list, remove, re-upload (no mock data)

3. backend/family-service/src/routes/upload.routes.ts
   — Add DELETE endpoint for removing uploaded documents

4. backend/family-service/src/routes/document.routes.ts
   — Add DELETE endpoint if missing

5. backend/family-service/src/routes/registration.routes.ts
   — Remove per-member doc logic from member creation step

══════════════════════════════════════
8. STRICT RULES
══════════════════════════════════════

• Do NOT modify database schema
• Do NOT remove future placeholder pages
• Do NOT hardcode environment URLs (use existing API_BASE constants)
• Do NOT skip audit history writes
• Read the LIVE schema first (Step 0) — it is the source of truth
• Treat this as a government-scale production system

══════════════════════════════════════
END OF PROMPT
══════════════════════════════════════
