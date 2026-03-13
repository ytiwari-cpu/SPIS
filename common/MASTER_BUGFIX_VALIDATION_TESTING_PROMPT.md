# MASTER PROMPT — SPIS Frontend: Bug Fixes, Logical Validations, Unit Tests & Cypress E2E Automation

> **Instructions to the AI**: Read this prompt carefully in its entirety before writing any code. This prompt covers the **Family** and **IAM** modules of a Social Protection Information System (SPIS) React/TypeScript frontend. You must:
> 1. **Only create new files when they do not already exist** — always check first.
> 2. **Edit existing files in-place** — never recreate a file that already exists.
> 3. **Do not delete or rename any existing files.**
> 4. Work module-by-module, file-by-file, in the exact order specified below.

---

## TABLE OF CONTENTS

1. [Project Context & Architecture](#1-project-context--architecture)
2. [PART A — Family Module: Bug Fixes & Logical Validations](#2-part-a--family-module-bug-fixes--logical-validations)
3. [PART B — IAM Module: Bug Fixes & Logical Validations](#3-part-b--iam-module-bug-fixes--logical-validations)
4. [PART C — Shared Validation Utility Libraries (NEW FILES)](#4-part-c--shared-validation-utility-libraries)
5. [PART D — Unit Tests (Vitest + React Testing Library)](#5-part-d--unit-tests)
6. [PART E — Cypress E2E Test Automation](#6-part-e--cypress-e2e-test-automation)
7. [File Inventory & Existence Checks](#7-file-inventory--existence-checks)

---

## 1. PROJECT CONTEXT & ARCHITECTURE

### Tech Stack
- **Framework**: React 18 + TypeScript + Vite
- **State**: Zustand (`authStore.ts`, `familyStore.ts`)
- **Routing**: react-router-dom v6
- **Styling**: Tailwind CSS + Material Symbols
- **HTTP**: Axios (`services/familyApi.ts`, `services/iamApi.ts`, `services/rbacApi.ts`)
- **Testing**: Vitest (unit), Cypress (e2e — NOT yet installed)
- **Build**: Vite at port 3000, backend family-service at 3001, IAM-service at 3003

### Key Directories
```
frontend/src/
├── components/
│   ├── citizen/          # Citizen-facing component implementations
│   │   ├── MyFamily.tsx (799 lines) — read-only family view
│   │   ├── FamilyEdit.tsx (1373 lines) — family CRUD with pending changes
│   │   ├── MemberProfile.tsx (607 lines) — member detail view
│   │   ├── Dashboard.tsx (~434 lines) — citizen dashboard
│   │   ├── MyProfile.tsx (~241 lines) — head member profile
│   │   ├── Documents.tsx (658 lines) — document upload/manage
│   │   ├── Benefits.tsx (~170 lines) — MOCK DATA
│   │   ├── Grievances.tsx (~230 lines) — MOCK DATA
│   │   ├── Settings.tsx (~100 lines)
│   │   ├── SetPasswordModal.tsx (~180 lines)
│   │   └── Programmes.tsx (10 lines — wrapper)
│   ├── superadmin/       # Admin component implementations
│   │   ├── AdminFamilies.tsx (609 lines) — admin family management (REAL API)
│   │   ├── AdminRoles.tsx (527 lines) — role CRUD (REAL API)
│   │   ├── AdminRoleForm.tsx (512 lines) — role create/edit (REAL API)
│   │   ├── AdminRoleManagement.tsx (842 lines) — permission tree editor (REAL API)
│   │   ├── AdminAdmins.tsx (523 lines) — user management (REAL IAM API)
│   │   ├── AdminCaseWorkers.tsx (304 lines) — MOCK DATA
│   │   ├── AdminCaseWorkerDetail.tsx (586 lines) — MOCK DATA
│   │   ├── AdminOverview.tsx (761 lines) — mixed mock+real
│   │   ├── AdminGrievances.tsx (665 lines) — MOCK DATA
│   │   ├── AdminAppeals.tsx (680 lines) — MOCK DATA
│   │   ├── AdminAuditLogs.tsx (408 lines) — REAL API
│   │   └── AdminProgrammesTable.tsx (767 lines) — REAL API
│   ├── public/           # Login, Reset Password, Home, Notices
│   ├── common/           # Permission-driven wrappers (CommonFamily, CommonDashboard, etc.)
│   ├── admin/            # shared.tsx (1138 lines — reusable UI components), AdminUsers.tsx
│   └── rbac/             # PermissionTree.tsx
├── pages/                # Thin page wrappers (6-8 lines each, delegate to components/)
├── services/             # API clients
│   ├── familyApi.ts (326 lines) — axios client for family-service (port 3001)
│   ├── iamApi.ts (379 lines) — axios client for IAM-service (port 3003)
│   ├── rbacApi.ts (460 lines) — RBAC API calls
│   ├── authFetch.ts (132 lines) — authenticated fetch wrapper
│   └── api.ts (342 lines) — legacy/alternative API module
├── store/                # Zustand stores
│   ├── authStore.ts (218 lines) — JWT, permissions, roles, user session
│   └── familyStore.ts (88 lines) — family, members, address, documents
├── types/                # TypeScript interfaces
│   ├── database.ts (452 lines) — DB-aligned types
│   └── index.ts (434 lines) — UI-facing types with enums
├── config/               # Route, nav, feature catalogue
├── layouts/              # AppLayout (unified), PublicLayout, legacy Admin/CitizenLayout
├── lib/                  # auth.ts (permissions), moduleResolver.ts, utils.ts
├── utils/                # adminUtils.ts, caseProgress.ts, excelUtils.ts
├── mock/                 # superAdminMockData.ts (1358 lines)
└── registration/         # RegistrationWizard.tsx (2687 lines)
```

### Permission System
- Permissions follow the pattern: `MODULE.SUBMODULE.ACTION` (e.g., `CITIZEN.FAMILY.VIEW`, `ADMIN.FAMILIES.EDIT`)
- `lib/auth.ts` is the single source of truth for permission checks
- SuperAdmin role bypasses all permission checks
- `config/featureCatalogue.ts` defines the full permission tree

---

## 2. PART A — FAMILY MODULE: BUG FIXES & LOGICAL VALIDATIONS

### A1. `src/components/citizen/FamilyEdit.tsx` (1373 lines) — CRITICAL BUGS

**Bug 1 — Spouse/Marital Status Contradiction**
- **Problem**: A member can be marked as `relationship_to_head = "spouse"` even when the family head's `marital_status` is `"single"` or `"widowed"`. This is logically impossible.
- **Fix**: 
  - When head's marital_status is `"single"`, disable "spouse" in the relationship dropdown for all members.
  - When head's marital_status is `"widowed"`, disable "spouse" unless the member is explicitly flagged.
  - Show an inline warning: "Family head is not married — 'Spouse' relationship is not available."
  - If an existing member already has `relationship_to_head = "spouse"` and head changes to `"single"`, show a validation error banner at the top: "Member [name] is marked as Spouse but the family head is not married. Please update."

**Bug 2 — Multiple Spouses**
- **Problem**: More than one member can be marked as `relationship_to_head = "spouse"`. Only one spouse should be allowed.
- **Fix**: Once a spouse exists, disable "spouse" in the relationship dropdown for all other members. Show inline text: "A spouse already exists in this family."

**Bug 3 — Duplicate National IDs Within Family**
- **Problem**: Two members can have the same `national_id`. This should be unique per family.
- **Fix**: On NID field blur/change, check against all other members' NID in the current family. Show error: "This National ID is already used by another family member."

**Bug 4 — Head Member Relationship Lock**
- **Problem**: The head member's `relationship_to_head` can potentially be changed from "head".
- **Fix**: The first member (index 0 or the member matching the head) must have `relationship_to_head` locked to "head" (read-only, not editable). Also ensure exactly ONE member is "head".

**Bug 5 — Household Size vs Actual Members Mismatch**
- **Problem**: `household_size` can be set to 3 but only 1 member is added, or 5 members exist but household_size says 2. No validation enforces this.
- **Fix**: 
  - Show a warning banner when `members.length !== household_size`: "Household size is [X] but [Y] members are registered. Please reconcile."
  - On family submission (save/submit), block if mismatch exists and show error.

**Bug 6 — Date of Birth Future Date**
- **Problem**: Date of birth can be set to a future date.
- **Fix**: Set `max` attribute on date input to today's date (`new Date().toISOString().split('T')[0]`). Validate on save: "Date of birth cannot be in the future."

**Bug 7 — Head Member Age Validation**
- **Problem**: A 2-year-old can be the family head. No minimum age check.
- **Fix**: Family head must be at least 18 years old. Calculate age from `date_of_birth`. Show error: "Family head must be at least 18 years old."

**Bug 8 — Child Age vs Relationship Inconsistency**
- **Problem**: A member with `relationship_to_head = "child"` can have a date of birth older than the head.
- **Fix**: If relationship is "child", their DOB must be after the head's DOB. Warn: "A child cannot be older than the family head."

**Bug 9 — Phone Number Format**
- **Problem**: Phone accepts any text. No format validation.
- **Fix**: Phone must be 10 digits (Jamaica format). Strip non-digits, validate length. Show: "Phone number must be 10 digits."

**Bug 10 — Email Format**
- **Problem**: Email field accepts invalid emails.
- **Fix**: Validate against `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`. Show: "Please enter a valid email address."

**Bug 11 — Required Fields Not Enforced on Save**
- **Problem**: Save/submit proceeds without first_name, last_name for members.
- **Fix**: Block save if any member is missing `first_name` or `last_name`. Highlight the specific member(s) with missing fields.

**Bug 12 — Gender Not Matching Relationship Context**
- **Problem**: No cross-validation between gender and relationship (e.g., a male "mother" or female "father").
- **Fix**: When relationship is "mother", gender should default to (or warn if not) "female". When "father", default/warn "male". This is a soft warning, not a hard block.

**Bug 13 — Pending Changes Lost on Navigation**
- **Problem**: User can navigate away from FamilyEdit with unsaved changes without warning.
- **Fix**: Use `beforeunload` event and react-router's `useBlocker`/`unstable_usePrompt` to warn: "You have unsaved changes. Are you sure you want to leave?"

**Bug 14 — Alive Flag + Date of Death**
- **Problem**: If `alive_flag` is `"no"`, there's no prompt for date of death. If alive_flag is `"yes"`, existing death date isn't cleared.
- **Fix**: When alive_flag = "no", show a date_of_death field (optional). When alive_flag = "yes", hide and clear the death date field.

### A2. `src/components/citizen/MyFamily.tsx` (799 lines) — DISPLAY BUGS

**Bug 15 — Empty Data Rendering**
- **Problem**: When API returns null/undefined fields, the page shows "undefined" or blank cells instead of "N/A" or "—".
- **Fix**: For every data display point, use fallback: `value || '—'` or `value ?? 'N/A'`. Check all fields: name, NID, phone, email, address lines, parish, district.

**Bug 16 — Member Count Display**
- **Problem**: Members list doesn't show a clear count.
- **Fix**: Show "Members (X)" in the section header where X = `members.length`.

**Bug 17 — Address Display When No Address**
- **Problem**: Address section renders with empty fields instead of "No address on file."
- **Fix**: If `address` is null/empty, show an empty state card: "No address information available."

**Bug 18 — Income Calculation Display**
- **Problem**: Total family income aggregation may show NaN if individual incomes are null.
- **Fix**: Filter out null/undefined income values before summing. Show "Not provided" if all are null.

### A3. `src/components/citizen/MemberProfile.tsx` (607 lines) — DISPLAY BUGS

**Bug 19 — Profile Photo Loading**
- **Problem**: Photo fetching may silently fail, leaving a broken image icon.
- **Fix**: Show a placeholder avatar (initials-based) when photo fails to load. Use `onError` handler on `<img>`.

**Bug 20 — Extended Fields Rendering**
- **Problem**: Migration 010 extended Jamaica fields (TRN, NIS, birth_entry_number, etc.) may render as "undefined" when not set.
- **Fix**: Wrap each extended field display in a null-check with fallback.

### A4. `src/components/citizen/Dashboard.tsx` (~434 lines) — LOGIC BUGS

**Bug 21 — Draft Banner Logic**
- **Problem**: Draft banner shows "complete registration" but member count validation doesn't account for pending members.
- **Fix**: Compare `members.length` against `household_size`. Show accurate message: "You have added X of Y members."

**Bug 22 — Status Badge Colors**
- **Problem**: Status badges may not cover all possible statuses from the API.
- **Fix**: Add exhaustive status→color mapping: PENDING→yellow, APPROVED→green, REJECTED→red, UNDER_REVIEW→blue, DRAFT→gray, SUBMITTED→blue, ARCHIVED→gray. Unknown statuses → default gray.

### A5. `src/components/citizen/Documents.tsx` (658 lines)

**Bug 23 — File Size Validation**
- **Problem**: No file size limit on upload. Users can upload very large files.
- **Fix**: Add 10MB max file size check. Show: "File size must be less than 10MB."

**Bug 24 — Duplicate Document Type**
- **Problem**: Same document type can be uploaded multiple times for the same holder.
- **Fix**: Warn (soft): "A [document_type] already exists for [holder_name]. Uploading will replace it."

**Bug 25 — Document Holder Mismatch**
- **Problem**: Document holder dropdown may include deleted members.
- **Fix**: Filter holder options to only include active (non-deleted) members.

### A6. `src/pages/registration/RegistrationWizard.tsx` (2687 lines) — CRITICAL

**Bug 26 — Step 1 Validation Gaps**
- **Problem**: 
  - `household_size` accepts 0 or negative numbers.
  - Head NID uniqueness check is async but doesn't block form submission if the check hasn't completed.
  - No phone format validation (10 digits).
- **Fix**: 
  - `household_size` min=1, max=50, must be integer.
  - Disable "Next" button while NID uniqueness check is in-flight.
  - Phone: strip non-digits, must be exactly 10 digits.

**Bug 27 — Step 2 Member Validation Gaps**
- Same spouse/marital-status contradiction as Bug 1 above.
- Same duplicate NID issue as Bug 3.
- Same future DOB issue as Bug 6.
- Same head-age issue as Bug 7.
- **Fix**: Apply identical validation rules in the registration wizard member step.

**Bug 28 — Step 2 Member Navigation**
- **Problem**: When editing previous members (going back), changes may not persist correctly.
- **Fix**: Ensure member data is properly saved to wizard state before navigating to previous/next member.

**Bug 29 — Step 3 Document Upload**
- Same file size issue as Bug 23.
- **Fix**: Apply identical file size validation.

**Bug 30 — Step 4 Review Validation Display**
- **Problem**: Validation errors from the backend are displayed but there's no way to navigate to the specific step/field that has the error.
- **Fix**: Each error should link to the relevant step. Show: "Fix errors in Step [X] before submitting."

### A7. `src/components/superadmin/AdminFamilies.tsx` (609 lines) — ADMIN FAMILY MANAGEMENT

**Bug 31 — Status Change Without Confirmation**
- **Problem**: Inline status dropdown changes status immediately without confirmation.
- **Fix**: Show a confirmation dialog: "Change family status from [old] to [new]?" before making the API call.

**Bug 32 — Archive Without Validation**
- **Problem**: A family in "APPROVED" status with active programme enrollments can be archived.
- **Fix**: Warn: "This family has active programme enrollments. Archiving will affect their benefits."

**Bug 33 — Search Not Debounced**
- **Problem**: Every keystroke triggers a filter/search, causing UI lag on large datasets.
- **Fix**: Debounce search input by 300ms.

---

## 3. PART B — IAM MODULE: BUG FIXES & LOGICAL VALIDATIONS

### B1. `src/components/public/LoginPage.tsx` (312 lines) — LOGIN BUGS

**Bug 34 — National ID Auto-Formatting**
- **Problem**: `normalizeNationalId` strips non-digits, but the display still shows raw input. User can't see the cleaned value.
- **Fix**: Apply normalization to the displayed value too: `value={normalizeNationalId(nationalId)}`.

**Bug 35 — Login Error Handling Gaps**
- **Problem**: Error detection relies on `message.includes('401')` etc. which is fragile. The backend may return structured errors.
- **Fix**: Parse `err.response?.data?.error` first. Fall back to status code matching only if no structured error.

**Bug 36 — OTP Input Validation**
- **Problem**: OTP field allows paste of non-numeric content (strip on onChange but not on paste).
- **Fix**: Add `onPaste` handler that strips non-digits.

**Bug 37 — Session Persistence on Refresh**
- **Problem**: `loginInProgress` ref resets on component re-mount. If `isAuthenticated` is true from localStorage, the useEffect redirects immediately during login flow.
- **Fix**: The `loginInProgress` ref pattern is fragile. Use a `justLoggedIn` state flag set synchronously in `finalizeLogin`.

**Bug 38 — OTP Resend Cooldown**
- **Problem**: User can spam "Resend OTP" with no cooldown.
- **Fix**: Add a 60-second cooldown timer after each OTP request. Show countdown: "Resend in [X]s".

### B2. `src/components/public/ResetPasswordPage.tsx` (209 lines) — PASSWORD RESET BUGS

**Bug 39 — Password Strength Not Validated**
- **Problem**: Only checks `newPassword.length < 8`. No strength requirements.
- **Fix**: Enforce: min 8 chars, at least 1 uppercase, 1 lowercase, 1 digit, 1 special char. Show a strength meter (like SetPasswordModal has).

**Bug 40 — National ID Validation Missing**
- **Problem**: Request form allows submission with non-14-digit NID. The check is there but error UX could be improved.
- **Fix**: Show real-time character count: "X/14 digits". Disable submit until exactly 14 digits.

**Bug 41 — OTP Expiry Not Communicated**
- **Problem**: User doesn't know how long the OTP is valid.
- **Fix**: Show: "OTP expires in 10 minutes" after successful send.

### B3. `src/components/citizen/SetPasswordModal.tsx` (~180 lines)

**Bug 42 — Modal Escape Key**
- **Problem**: Forced modal (no close) but user can press Escape to close via browser behavior.
- **Fix**: Add `onKeyDown` handler to prevent Escape key from closing the modal overlay.

**Bug 43 — Password Visibility Toggle**
- **Problem**: No toggle to show/hide password text.
- **Fix**: Add eye/eye-off toggle button next to password and confirm-password fields.

### B4. `src/components/WorkerRegistrationModal.tsx` (290 lines)

**Bug 44 — Secret Key Exposure**
- **Problem**: Secret key field is type="text", visible on screen.
- **Fix**: Change to `type="password"` with visibility toggle.

**Bug 45 — Role Validation**
- **Problem**: No validation that the selected role is valid.
- **Fix**: Role must be one of: `Admin`, `CaseWorker`, `SuperAdmin`, `ProgrammeManager`. Validate before submit.

**Bug 46 — Worker NID Format**
- **Problem**: National ID isn't validated before submission.
- **Fix**: Same 14-digit validation as citizen login.

### B5. `src/store/authStore.ts` (218 lines) — STATE MANAGEMENT BUGS

**Bug 47 — Token Expiry Not Checked on Restore**
- **Problem**: On app load, `authStore` restores token from localStorage but doesn't check if the token is expired.
- **Fix**: On hydration, decode JWT and check `exp`. If expired, call `logout()` immediately.

**Bug 48 — Permissions Not Refreshed**
- **Problem**: Permissions are stored at login time. If admin changes a user's role, the old permissions persist until re-login.
- **Fix**: Add a `refreshSession()` method that calls `/iam/me` and updates permissions. Call it periodically (e.g., every 15 minutes) or on route change.

### B6. `src/services/iamApi.ts` (379 lines) & `src/services/authFetch.ts` (132 lines)

**Bug 49 — No Request Timeout**
- **Problem**: API calls have no timeout. A hung server blocks the UI forever.
- **Fix**: Set axios default timeout to 30 seconds. Show "Request timed out" error.

**Bug 50 — No Retry Logic**
- **Problem**: Transient 5xx errors immediately show error to user.
- **Fix**: Add retry logic (max 2 retries with exponential backoff) for 5xx and network errors, not for 4xx.

### B7. `src/components/superadmin/AdminAdmins.tsx` (523 lines) — USER MANAGEMENT BUGS

**Bug 51 — Disable Own Account**
- **Problem**: An admin can disable their own account through the user management table.
- **Fix**: Hide or disable the toggle for the currently logged-in user. Show: "You cannot disable your own account."

**Bug 52 — Role Assignment to Self**
- **Problem**: An admin might remove their own admin role, locking themselves out.
- **Fix**: Prevent role changes for the currently logged-in user.

### B8. `src/components/superadmin/AdminRoles.tsx` (527 lines) — ROLE MANAGEMENT BUGS

**Bug 53 — Delete System Roles**
- **Problem**: System-critical roles (SuperAdmin, Admin, Citizen) might be deletable.
- **Fix**: Mark system roles as non-deletable. Hide delete button for roles where `is_system = true`.

**Bug 54 — Empty Role Name**
- **Problem**: Role name validation happens server-side only.
- **Fix**: Client-side validation: role name required, min 2 chars, no special chars except hyphen/underscore.

### B9. `src/components/superadmin/AdminRoleForm.tsx` (512 lines)

**Bug 55 — Slug Generation Collision**
- **Problem**: Auto-generated slug from role name doesn't check for uniqueness.
- **Fix**: After auto-generating the slug, check against existing role slugs. Append a number if duplicate.

**Bug 56 — Permission Dependencies Not Enforced on Load**
- **Problem**: When loading an existing role for editing, the VIEW dependency (if non-VIEW perms are selected, VIEW must be selected) isn't re-validated.
- **Fix**: Run dependency validation on initial load data, showing warnings for inconsistent states.

### B10. `src/components/superadmin/AdminRoleManagement.tsx` (842 lines)

**Bug 57 — Unsaved Changes Warning Bypass**
- **Problem**: The unsaved changes warning only triggers on role switch in the left panel. Navigation via browser back/URL change bypasses it.
- **Fix**: Add `beforeunload` event listener when there are unsaved changes.

---

## 4. PART C — SHARED VALIDATION UTILITY LIBRARIES

> **IMPORTANT**: Only create these files if they DO NOT already exist. Check first!

### C1. Create `src/utils/familyValidations.ts` (if not exists)

```typescript
/**
 * Family Module — Shared Validation Functions
 * 
 * Pure functions (no React dependencies) for validating family data.
 * Used by both FamilyEdit.tsx and RegistrationWizard.tsx.
 */

// === Types ===
export interface ValidationError {
  field: string
  message: string
  memberId?: string
  severity: 'error' | 'warning'
}

export interface MemberData {
  member_id?: string
  first_name: string
  last_name: string
  national_id?: string
  date_of_birth?: string
  gender?: string
  relationship_to_head: string
  marital_status?: string
  alive_flag?: string
  phone?: string
  email?: string
}

export interface FamilyData {
  household_size: number
  head_marital_status?: string
  members: MemberData[]
}

// === Constants ===
export const NID_LENGTH = 14
export const PHONE_LENGTH = 10
export const MIN_HEAD_AGE = 18
export const MAX_FILE_SIZE_MB = 10
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const VALID_RELATIONSHIPS = ['head', 'spouse', 'child', 'parent', 'sibling', 'grandparent', 'grandchild', 'other'] as const
export const VALID_MARITAL_STATUSES = ['single', 'married', 'divorced', 'widowed', 'separated'] as const
export const VALID_GENDERS = ['male', 'female', 'other'] as const
export const MARITAL_STATUSES_ALLOWING_SPOUSE = ['married', 'separated'] as const

// === Validators ===

export function validateNationalId(nid: string): string | null {
  if (!nid) return null // Optional for non-head members
  const digits = nid.replace(/\D/g, '')
  if (digits.length !== NID_LENGTH) return `National ID must be exactly ${NID_LENGTH} digits`
  return null
}

export function validatePhone(phone: string): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length !== PHONE_LENGTH) return `Phone number must be exactly ${PHONE_LENGTH} digits`
  return null
}

export function validateEmail(email: string): string | null {
  if (!email) return null
  if (!EMAIL_REGEX.test(email)) return 'Please enter a valid email address'
  return null
}

export function validateDateOfBirth(dob: string): string | null {
  if (!dob) return null
  const date = new Date(dob)
  if (isNaN(date.getTime())) return 'Invalid date'
  if (date > new Date()) return 'Date of birth cannot be in the future'
  return null
}

export function calculateAge(dob: string): number | null {
  if (!dob) return null
  const date = new Date(dob)
  if (isNaN(date.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - date.getFullYear()
  const m = today.getMonth() - date.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < date.getDate())) age--
  return age
}

export function validateHeadAge(headDob: string): string | null {
  const age = calculateAge(headDob)
  if (age === null) return null
  if (age < MIN_HEAD_AGE) return `Family head must be at least ${MIN_HEAD_AGE} years old`
  return null
}

export function validateChildNotOlderThanHead(childDob: string, headDob: string): string | null {
  if (!childDob || !headDob) return null
  const childDate = new Date(childDob)
  const headDate = new Date(headDob)
  if (childDate < headDate) return 'A child cannot be older than the family head'
  return null
}

export function validateSpouseAllowed(headMaritalStatus: string | undefined): string | null {
  if (!headMaritalStatus) return null
  if (!(MARITAL_STATUSES_ALLOWING_SPOUSE as readonly string[]).includes(headMaritalStatus)) {
    return `Family head is "${headMaritalStatus}" — Spouse relationship is not available`
  }
  return null
}

export function validateSingleSpouse(members: MemberData[], currentMemberId?: string): string | null {
  const existingSpouse = members.find(
    m => m.relationship_to_head === 'spouse' && m.member_id !== currentMemberId
  )
  if (existingSpouse) {
    return `A spouse already exists: ${existingSpouse.first_name} ${existingSpouse.last_name}`
  }
  return null
}

export function validateUniqueNidInFamily(nid: string, members: MemberData[], currentMemberId?: string): string | null {
  if (!nid) return null
  const digits = nid.replace(/\D/g, '')
  const duplicate = members.find(
    m => m.member_id !== currentMemberId && m.national_id?.replace(/\D/g, '') === digits
  )
  if (duplicate) {
    return `This National ID is already used by ${duplicate.first_name} ${duplicate.last_name}`
  }
  return null
}

export function validateHouseholdSizeMatch(householdSize: number, memberCount: number): string | null {
  if (householdSize !== memberCount) {
    return `Household size is ${householdSize} but ${memberCount} members are registered`
  }
  return null
}

export function validateHouseholdSize(size: number): string | null {
  if (!Number.isInteger(size) || size < 1) return 'Household size must be at least 1'
  if (size > 50) return 'Household size cannot exceed 50'
  return null
}

export function validateGenderRelationship(gender: string | undefined, relationship: string): string | null {
  if (!gender) return null
  if (relationship === 'mother' && gender !== 'female') return 'A "mother" is typically female — please verify'
  if (relationship === 'father' && gender !== 'male') return 'A "father" is typically male — please verify'
  return null
}

export function validateFileSize(fileSize: number): string | null {
  if (fileSize > MAX_FILE_SIZE_BYTES) return `File size must be less than ${MAX_FILE_SIZE_MB}MB`
  return null
}

/** Run all member-level validations */
export function validateMember(member: MemberData, allMembers: MemberData[], headData?: { dob?: string, maritalStatus?: string }, isHead?: boolean): ValidationError[] {
  const errors: ValidationError[] = []
  const id = member.member_id || member.national_id || 'unknown'

  if (!member.first_name?.trim()) errors.push({ field: 'first_name', message: 'First name is required', memberId: id, severity: 'error' })
  if (!member.last_name?.trim()) errors.push({ field: 'last_name', message: 'Last name is required', memberId: id, severity: 'error' })

  const nidErr = validateNationalId(member.national_id || '')
  if (isHead && !member.national_id) errors.push({ field: 'national_id', message: 'National ID is required for the family head', memberId: id, severity: 'error' })
  if (nidErr && member.national_id) errors.push({ field: 'national_id', message: nidErr, memberId: id, severity: 'error' })

  const dupNid = validateUniqueNidInFamily(member.national_id || '', allMembers, member.member_id)
  if (dupNid) errors.push({ field: 'national_id', message: dupNid, memberId: id, severity: 'error' })

  const phoneErr = validatePhone(member.phone || '')
  if (phoneErr) errors.push({ field: 'phone', message: phoneErr, memberId: id, severity: 'error' })

  const emailErr = validateEmail(member.email || '')
  if (emailErr) errors.push({ field: 'email', message: emailErr, memberId: id, severity: 'error' })

  const dobErr = validateDateOfBirth(member.date_of_birth || '')
  if (dobErr) errors.push({ field: 'date_of_birth', message: dobErr, memberId: id, severity: 'error' })

  if (isHead) {
    const headAgeErr = validateHeadAge(member.date_of_birth || '')
    if (headAgeErr) errors.push({ field: 'date_of_birth', message: headAgeErr, memberId: id, severity: 'error' })
  }

  if (member.relationship_to_head === 'child' && headData?.dob) {
    const childErr = validateChildNotOlderThanHead(member.date_of_birth || '', headData.dob)
    if (childErr) errors.push({ field: 'date_of_birth', message: childErr, memberId: id, severity: 'warning' })
  }

  if (member.relationship_to_head === 'spouse') {
    const spouseAllowed = validateSpouseAllowed(headData?.maritalStatus)
    if (spouseAllowed) errors.push({ field: 'relationship_to_head', message: spouseAllowed, memberId: id, severity: 'error' })

    const singleSpouse = validateSingleSpouse(allMembers, member.member_id)
    if (singleSpouse) errors.push({ field: 'relationship_to_head', message: singleSpouse, memberId: id, severity: 'error' })
  }

  const genderWarn = validateGenderRelationship(member.gender, member.relationship_to_head)
  if (genderWarn) errors.push({ field: 'gender', message: genderWarn, memberId: id, severity: 'warning' })

  return errors
}

/** Run all family-level validations */
export function validateFamily(family: FamilyData): ValidationError[] {
  const errors: ValidationError[] = []

  const sizeErr = validateHouseholdSize(family.household_size)
  if (sizeErr) errors.push({ field: 'household_size', message: sizeErr, severity: 'error' })

  const matchErr = validateHouseholdSizeMatch(family.household_size, family.members.length)
  if (matchErr) errors.push({ field: 'household_size', message: matchErr, severity: 'warning' })

  const heads = family.members.filter(m => m.relationship_to_head === 'head')
  if (heads.length === 0) errors.push({ field: 'members', message: 'Family must have exactly one head', severity: 'error' })
  if (heads.length > 1) errors.push({ field: 'members', message: 'Family cannot have more than one head', severity: 'error' })

  const spouses = family.members.filter(m => m.relationship_to_head === 'spouse')
  if (spouses.length > 1) errors.push({ field: 'members', message: 'Family cannot have more than one spouse', severity: 'error' })

  return errors
}
```

### C2. Create `src/utils/iamValidations.ts` (if not exists)

```typescript
/**
 * IAM Module — Shared Validation Functions
 * 
 * Pure functions for validating IAM-related inputs.
 * Used by LoginPage, ResetPasswordPage, SetPasswordModal, WorkerRegistrationModal.
 */

export interface PasswordValidation {
  isValid: boolean
  hasMinLength: boolean
  hasUppercase: boolean
  hasLowercase: boolean
  hasDigit: boolean
  hasSpecialChar: boolean
  score: number // 0-5
}

export const NID_LENGTH = 14
export const OTP_LENGTH = 6
export const MIN_PASSWORD_LENGTH = 8
export const PASSWORD_REGEX_UPPER = /[A-Z]/
export const PASSWORD_REGEX_LOWER = /[a-z]/
export const PASSWORD_REGEX_DIGIT = /\d/
export const PASSWORD_REGEX_SPECIAL = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/

export function normalizeNationalId(value: string): string {
  return value.replace(/\D/g, '')
}

export function validateNationalId(nid: string): string | null {
  const digits = normalizeNationalId(nid)
  if (!digits) return 'National ID is required'
  if (digits.length !== NID_LENGTH) return `National ID must be exactly ${NID_LENGTH} digits`
  return null
}

export function validateOtp(otp: string): string | null {
  if (!otp) return 'OTP is required'
  const digits = otp.replace(/\D/g, '')
  if (digits.length !== OTP_LENGTH) return `OTP must be exactly ${OTP_LENGTH} digits`
  return null
}

export function validatePassword(password: string): PasswordValidation {
  const hasMinLength = password.length >= MIN_PASSWORD_LENGTH
  const hasUppercase = PASSWORD_REGEX_UPPER.test(password)
  const hasLowercase = PASSWORD_REGEX_LOWER.test(password)
  const hasDigit = PASSWORD_REGEX_DIGIT.test(password)
  const hasSpecialChar = PASSWORD_REGEX_SPECIAL.test(password)

  const score = [hasMinLength, hasUppercase, hasLowercase, hasDigit, hasSpecialChar].filter(Boolean).length
  const isValid = hasMinLength && hasUppercase && hasLowercase && hasDigit && hasSpecialChar

  return { isValid, hasMinLength, hasUppercase, hasLowercase, hasDigit, hasSpecialChar, score }
}

export function validatePasswordMatch(password: string, confirmPassword: string): string | null {
  if (!confirmPassword) return 'Please confirm your password'
  if (password !== confirmPassword) return 'Passwords do not match'
  return null
}

export function getPasswordStrengthLabel(score: number): { label: string, color: string } {
  if (score <= 1) return { label: 'Very Weak', color: 'red' }
  if (score === 2) return { label: 'Weak', color: 'orange' }
  if (score === 3) return { label: 'Fair', color: 'yellow' }
  if (score === 4) return { label: 'Strong', color: 'blue' }
  return { label: 'Very Strong', color: 'green' }
}

export function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp * 1000 < Date.now()
  } catch {
    return true
  }
}

export function getTokenExpiry(token: string): Date | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return new Date(payload.exp * 1000)
  } catch {
    return null
  }
}

export const VALID_WORKER_ROLES = ['Admin', 'CaseWorker', 'SuperAdmin', 'ProgrammeManager'] as const
export type WorkerRole = typeof VALID_WORKER_ROLES[number]

export function validateWorkerRole(role: string): string | null {
  if (!role) return 'Role is required'
  if (!(VALID_WORKER_ROLES as readonly string[]).includes(role)) return `Invalid role: ${role}`
  return null
}

export function validateEmail(email: string): string | null {
  if (!email) return 'Email is required'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please enter a valid email address'
  return null
}
```

---

## 5. PART D — UNIT TESTS (Vitest + React Testing Library)

> **Pre-requisites**: Vitest is already configured in `vitest.config.ts`. `@testing-library/react` and `@testing-library/jest-dom` need to be installed if not already present. Check `package.json` before installing.
> 
> If not installed, run:
> ```bash
> cd /home/yuvraj/Desktop/SPIS/frontend
> npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
> ```

### D1. Create `src/utils/familyValidations.test.ts` (if not exists)

Test EVERY exported function from `familyValidations.ts`:

```
describe('familyValidations')
  describe('validateNationalId')
    ✓ returns null for empty string (optional for non-head)
    ✓ returns null for valid 14-digit NID
    ✓ returns error for 13-digit NID
    ✓ returns error for 15-digit NID
    ✓ strips non-digit characters before validation
    
  describe('validatePhone')
    ✓ returns null for empty string
    ✓ returns null for valid 10-digit phone
    ✓ returns error for 9-digit phone
    ✓ returns error for 11-digit phone
    
  describe('validateEmail')
    ✓ returns null for empty string
    ✓ returns null for valid email
    ✓ returns error for email without @
    ✓ returns error for email without domain
    ✓ returns error for email with spaces
    
  describe('validateDateOfBirth')
    ✓ returns null for empty string
    ✓ returns null for valid past date
    ✓ returns error for future date
    ✓ returns error for invalid date string
    
  describe('calculateAge')
    ✓ returns null for empty string
    ✓ returns correct age for a known DOB
    ✓ handles birthday not yet passed this year
    ✓ handles birthday already passed this year
    
  describe('validateHeadAge')
    ✓ returns null when age >= 18
    ✓ returns error when age < 18
    ✓ returns null for empty DOB
    
  describe('validateChildNotOlderThanHead')
    ✓ returns null when child DOB is after head DOB
    ✓ returns error when child DOB is before head DOB
    ✓ returns null when either DOB is missing
    
  describe('validateSpouseAllowed')
    ✓ returns null when head is married
    ✓ returns null when head is separated
    ✓ returns error when head is single
    ✓ returns error when head is widowed
    ✓ returns error when head is divorced
    ✓ returns null when marital status is undefined
    
  describe('validateSingleSpouse')
    ✓ returns null when no spouse exists
    ✓ returns error when spouse already exists
    ✓ ignores the current member when checking for existing spouse
    
  describe('validateUniqueNidInFamily')
    ✓ returns null for empty NID
    ✓ returns null for unique NID
    ✓ returns error for duplicate NID
    ✓ ignores current member's own NID
    
  describe('validateHouseholdSizeMatch')
    ✓ returns null when size matches member count
    ✓ returns error when size doesn't match
    
  describe('validateHouseholdSize')
    ✓ returns null for valid size (1-50)
    ✓ returns error for 0
    ✓ returns error for negative number
    ✓ returns error for > 50
    ✓ returns error for non-integer
    
  describe('validateGenderRelationship')
    ✓ returns null for matching gender-relationship
    ✓ returns warning for mother with male gender
    ✓ returns warning for father with female gender
    ✓ returns null for non-gendered relationships
    ✓ returns null for undefined gender
    
  describe('validateFileSize')
    ✓ returns null for file under 10MB
    ✓ returns error for file over 10MB
    ✓ returns null for exactly 10MB

  describe('validateMember')
    ✓ returns empty array for valid member
    ✓ returns error for missing first name
    ✓ returns error for missing last name
    ✓ returns error for head without NID
    ✓ returns all applicable errors for invalid member
    ✓ returns warnings for gender-relationship mismatch
    
  describe('validateFamily')
    ✓ returns empty array for valid family
    ✓ returns error for no head
    ✓ returns error for multiple heads
    ✓ returns error for multiple spouses
    ✓ returns warning for size mismatch
    ✓ returns error for invalid household size
```

### D2. Create `src/utils/iamValidations.test.ts` (if not exists)

Test EVERY exported function from `iamValidations.ts`:

```
describe('iamValidations')
  describe('normalizeNationalId')
    ✓ removes non-digit characters
    ✓ returns empty string for empty input
    ✓ preserves digits
    
  describe('validateNationalId')
    ✓ returns null for valid 14-digit NID
    ✓ returns error for empty NID
    ✓ returns error for wrong length
    
  describe('validateOtp')
    ✓ returns null for valid 6-digit OTP
    ✓ returns error for empty OTP
    ✓ returns error for wrong length
    
  describe('validatePassword')
    ✓ returns all false for empty password
    ✓ returns isValid=true for strong password
    ✓ detects missing uppercase
    ✓ detects missing lowercase
    ✓ detects missing digit
    ✓ detects missing special char
    ✓ returns correct score
    
  describe('validatePasswordMatch')
    ✓ returns null for matching passwords
    ✓ returns error for non-matching passwords
    ✓ returns error for empty confirm password
    
  describe('getPasswordStrengthLabel')
    ✓ returns Very Weak for score 0-1
    ✓ returns Weak for score 2
    ✓ returns Fair for score 3
    ✓ returns Strong for score 4
    ✓ returns Very Strong for score 5
    
  describe('isTokenExpired')
    ✓ returns true for expired token
    ✓ returns false for valid token
    ✓ returns true for malformed token
    
  describe('validateWorkerRole')
    ✓ returns null for valid role
    ✓ returns error for invalid role
    ✓ returns error for empty role
    
  describe('validateEmail')
    ✓ returns null for valid email
    ✓ returns error for invalid email
    ✓ returns error for empty email
```

---

## 6. PART E — CYPRESS E2E TEST AUTOMATION

### E1. Install & Configure Cypress (if not already)

> **Check first**: Does `cypress.config.ts` exist? Is `cypress` in package.json devDependencies?
> If not:
> ```bash
> cd /home/yuvraj/Desktop/SPIS/frontend
> npm install -D cypress @testing-library/cypress
> ```

### E2. Create `cypress.config.ts` (if not exists)

```typescript
import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    viewportWidth: 1280,
    viewportHeight: 720,
    defaultCommandTimeout: 10000,
    requestTimeout: 15000,
    responseTimeout: 15000,
    video: false,
    screenshotOnRunFailure: true,
    chromeWebSecurity: false,
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/e2e.ts',
    setupNodeEvents(on, config) {
      return config
    },
  },
})
```

### E3. Create `cypress/support/e2e.ts` (if not exists)

```typescript
import './commands'
```

### E4. Create `cypress/support/commands.ts` (if not exists)

```typescript
/// <reference types="cypress" />

declare namespace Cypress {
  interface Chainable {
    /** Login via API and store session */
    loginAsAdmin(nationalId?: string, password?: string): Chainable<void>
    loginAsCitizen(nationalId?: string, password?: string): Chainable<void>
    loginWithOtp(nationalId: string): Chainable<void>
    
    /** Auth helpers */
    logout(): Chainable<void>
    preserveAuth(): Chainable<void>
    
    /** Navigation */
    visitDashboard(): Chainable<void>
    visitFamilyPage(): Chainable<void>
    visitFamilyEdit(): Chainable<void>
    visitAdminFamilies(): Chainable<void>
    visitAdminRoles(): Chainable<void>
    visitAdminUsers(): Chainable<void>
    visitLogin(): Chainable<void>
    visitResetPassword(): Chainable<void>
    visitRegistration(): Chainable<void>
    
    /** Form helpers */
    fillNationalId(nid: string): Chainable<void>
    fillPassword(password: string): Chainable<void>
    fillOtp(otp: string): Chainable<void>
    
    /** Assertions */
    shouldShowError(message: string): Chainable<void>
    shouldShowSuccess(message: string): Chainable<void>
    shouldBeOnPage(path: string): Chainable<void>
    shouldHavePermission(permission: string): Chainable<void>
  }
}

// ===== COMMANDS =====

Cypress.Commands.add('loginAsAdmin', (nationalId = Cypress.env('ADMIN_NID'), password = Cypress.env('ADMIN_PASSWORD')) => {
  cy.request({
    method: 'POST',
    url: 'http://localhost:3003/iam/login',
    body: { national_id: nationalId, password },
    failOnStatusCode: false,
  }).then((res) => {
    if (res.status === 200 && res.body?.data) {
      const session = res.body.data
      window.localStorage.setItem('auth-storage', JSON.stringify({
        state: {
          accessToken: session.access_token,
          user: { uuid: session.user_id, email: session.email, national_id: nationalId },
          roles: session.roles || [],
          permissions: session.permissions || [],
          isAuthenticated: true,
        },
        version: 0,
      }))
    }
  })
})

Cypress.Commands.add('loginAsCitizen', (nationalId = Cypress.env('CITIZEN_NID'), password = Cypress.env('CITIZEN_PASSWORD')) => {
  cy.request({
    method: 'POST',
    url: 'http://localhost:3003/iam/login',
    body: { national_id: nationalId, password },
    failOnStatusCode: false,
  }).then((res) => {
    if (res.status === 200 && res.body?.data) {
      const session = res.body.data
      window.localStorage.setItem('auth-storage', JSON.stringify({
        state: {
          accessToken: session.access_token,
          user: { uuid: session.user_id, email: session.email, national_id: nationalId },
          roles: session.roles || [],
          permissions: session.permissions || [],
          isAuthenticated: true,
        },
        version: 0,
      }))
    }
  })
})

Cypress.Commands.add('logout', () => {
  window.localStorage.removeItem('auth-storage')
  cy.visit('/login')
})

Cypress.Commands.add('visitDashboard', () => { cy.visit('/dashboard') })
Cypress.Commands.add('visitFamilyPage', () => { cy.visit('/family') })
Cypress.Commands.add('visitFamilyEdit', () => { cy.visit('/family/edit') })
Cypress.Commands.add('visitAdminFamilies', () => { cy.visit('/admin/families') })
Cypress.Commands.add('visitAdminRoles', () => { cy.visit('/admin/roles') })
Cypress.Commands.add('visitAdminUsers', () => { cy.visit('/admin/users') })
Cypress.Commands.add('visitLogin', () => { cy.visit('/login') })
Cypress.Commands.add('visitResetPassword', () => { cy.visit('/reset-password') })
Cypress.Commands.add('visitRegistration', () => { cy.visit('/register') })

Cypress.Commands.add('fillNationalId', (nid: string) => {
  cy.get('#nationalId, input[name="nationalId"], input[placeholder*="National ID"]').clear().type(nid)
})

Cypress.Commands.add('fillPassword', (password: string) => {
  cy.get('#password, input[type="password"]').first().clear().type(password)
})

Cypress.Commands.add('fillOtp', (otp: string) => {
  cy.get('#otp, input[placeholder*="OTP"]').clear().type(otp)
})

Cypress.Commands.add('shouldShowError', (message: string) => {
  cy.contains(message).should('be.visible')
})

Cypress.Commands.add('shouldBeOnPage', (path: string) => {
  cy.url().should('include', path)
})
```

### E5. Create `cypress/e2e/iam/login.cy.ts` (if not exists)

```
describe('IAM — Login Page', () => {
  beforeEach(() => { cy.visitLogin() })

  describe('Page Structure', () => {
    it('renders the login form with all elements')
    it('shows Password and OTP tab switchers')
    it('shows Worker Registration button')
    it('shows Forgot Password link')
    it('shows Register link')
  })

  describe('National ID Validation', () => {
    it('shows error for empty National ID submission')
    it('shows error for NID shorter than 14 digits')
    it('shows error for NID longer than 14 digits')
    it('strips non-digit characters from NID input')
    it('shows character count feedback')
  })

  describe('Password Login', () => {
    it('shows error for empty password')
    it('shows error for wrong credentials (401)')
    it('shows error for disabled account (403)')
    it('shows error for locked account (423)')
    it('shows error for unactivated account')
    it('redirects to dashboard on successful login')
    it('stores session in localStorage after login')
    it('shows proper error message for network failure')
  })

  describe('OTP Login', () => {
    it('switches to OTP tab and hides password field')
    it('sends OTP request on valid NID')
    it('shows OTP input field after OTP sent')
    it('validates OTP is exactly 6 digits')
    it('shows error for invalid OTP')
    it('shows resend OTP button')
    it('enforces resend cooldown timer')
    it('allows going back to change National ID')
    it('redirects to dashboard on successful OTP login')
  })

  describe('Session Management', () => {
    it('redirects authenticated user away from login page')
    it('shows SetPasswordModal for first-time OTP users')
    it('fetches family details for citizen users after login')
  })

  describe('Worker Registration Modal', () => {
    it('opens worker registration modal')
    it('validates National ID in worker registration')
    it('validates email format')
    it('validates role selection')
    it('masks secret key field')
    it('shows OTP verification step after registration')
    it('validates password match in verification step')
    it('validates minimum password length')
    it('closes modal on successful registration')
  })
})
```

### E6. Create `cypress/e2e/iam/reset-password.cy.ts` (if not exists)

```
describe('IAM — Reset Password Page', () => {
  beforeEach(() => { cy.visitResetPassword() })

  describe('Page Structure', () => {
    it('renders the reset password form')
    it('shows National ID input with 14-digit hint')
    it('shows Back to Login link')
  })

  describe('Request OTP Step', () => {
    it('shows error for empty National ID')
    it('shows error for NID shorter than 14 digits')
    it('shows real-time digit count')
    it('disables submit while sending')
    it('shows error for non-existent NID (404)')
    it('transitions to OTP entry form on success')
    it('shows OTP expiry timer message')
  })

  describe('Confirm Reset Step', () => {
    it('shows OTP, new password, and confirm password fields')
    it('validates OTP is 6 digits')
    it('validates password minimum length 8')
    it('validates password has uppercase')
    it('validates password has lowercase')
    it('validates password has digit')
    it('validates password has special character')
    it('shows password strength meter')
    it('validates passwords match')
    it('shows error for invalid OTP (400)')
    it('shows error for expired OTP')
    it('shows success message and redirects on completion')
    it('allows retrying with new OTP')
  })
})
```

### E7. Create `cypress/e2e/iam/roles.cy.ts` (if not exists)

```
describe('IAM — Role Management', () => {
  beforeEach(() => { cy.loginAsAdmin(); cy.visitAdminRoles() })

  describe('Roles List', () => {
    it('loads and displays roles')
    it('shows Active/Inactive tabs')
    it('searches roles by name')
    it('shows create button for users with CREATE permission')
    it('hides create button without CREATE permission')
  })

  describe('Create Role', () => {
    it('navigates to role creation form')
    it('validates role name is required')
    it('validates role name minimum length')
    it('auto-generates slug from name')
    it('allows editing description')
    it('shows permission tree')
    it('enforces VIEW dependency for write permissions')
    it('submits new role successfully')
    it('shows error for duplicate role name')
  })

  describe('Edit Role', () => {
    it('loads existing role data')
    it('locks role_name and slug fields')
    it('allows changing permissions')
    it('validates VIEW dependency on save')
    it('saves changes successfully')
  })

  describe('Delete Role', () => {
    it('shows confirmation dialog')
    it('prevents deletion of system roles')
    it('prevents deletion of roles with assigned users')
    it('soft-deletes (moves to Inactive tab)')
    it('allows permanent deletion from Inactive tab')
    it('allows restoring from Inactive tab')
  })

  describe('Role Permission Management (tree view)', () => {
    it('loads two-panel layout')
    it('selects role from left panel')
    it('displays permission tree in right panel')
    it('toggles individual permissions')
    it('auto-checks VIEW when checking a write perm')
    it('auto-unchecks write perms when unchecking VIEW')
    it('warns about unsaved changes on role switch')
    it('shows Select All / Clear All / Select All View buttons')
    it('saves permission changes')
  })
})
```

### E8. Create `cypress/e2e/iam/users.cy.ts` (if not exists)

```
describe('IAM — User Management (AdminAdmins)', () => {
  beforeEach(() => { cy.loginAsAdmin(); cy.visitAdminUsers() })

  describe('Users List', () => {
    it('loads and displays paginated users')
    it('shows search input')
    it('searches users by name or email')
    it('paginates through results')
    it('shows user status badges')
  })

  describe('User Status Toggle', () => {
    it('enables a disabled user')
    it('disables an enabled user')
    it('prevents disabling own account')
    it('shows confirmation before status change')
  })

  describe('Role Assignment', () => {
    it('opens role assignment modal')
    it('loads available roles')
    it('assigns a role to a user')
    it('prevents changing own role')
    it('shows success notification after assignment')
  })
})
```

### E9. Create `cypress/e2e/family/registration.cy.ts` (if not exists)

```
describe('Family — Registration Wizard', () => {
  beforeEach(() => { cy.visitRegistration() })

  describe('Step 1 — Family & Address', () => {
    it('renders all family head fields')
    it('validates first name required')
    it('validates last name required')
    it('validates National ID exactly 14 digits')
    it('checks NID uniqueness asynchronously')
    it('disables Next while NID check is in-flight')
    it('validates phone is 10 digits')
    it('validates email format')
    it('validates household size is 1-50')
    it('rejects household size of 0')
    it('rejects negative household size')
    it('renders address fields with autocomplete')
    it('validates permanent address line1 required')
    it('validates permanent address district required')
    it('toggles mailing address section')
    it('validates mailing address fields when enabled')
    it('saves family data to API on Next')
    it('shows loading state during save')
  })

  describe('Step 2 — Members', () => {
    it('pre-fills first member from head data')
    it('locks first member name and relationship fields')
    it('shows progress dots for members')
    it('validates member first name required')
    it('validates member last name required')
    it('validates NID format when provided')
    it('validates no duplicate NID within family')
    it('validates date of birth not in future')
    it('validates head member is at least 18')
    it('validates child is not older than head')
    it('validates spouse only when head is married')
    it('validates only one spouse allowed')
    it('shows gender-relationship consistency warning')
    it('toggles extended details section')
    it('saves member to API on Next')
    it('navigates between members (back/forward)')
    it('shows "All Members Added" when count matches household_size')
    it('shows remaining member count warning')
  })

  describe('Step 3 — Documents', () => {
    it('renders document upload controls')
    it('shows holder dropdown with family and all members')
    it('shows document type dropdown')
    it('accepts valid file types')
    it('rejects files over 10MB')
    it('uploads document successfully')
    it('lists uploaded documents')
    it('deletes a document')
    it('allows skipping documents step')
  })

  describe('Step 4 — Review', () => {
    it('loads review data from API')
    it('displays family details')
    it('displays all members')
    it('displays address information')
    it('displays uploaded documents')
    it('shows validation errors if present')
    it('disables submit if errors exist')
    it('links errors to relevant step')
    it('submits registration successfully')
    it('saves as draft')
    it('navigates to login after draft save')
    it('navigates to home after submission')
  })

  describe('Edit Mode', () => {
    it('loads existing family in edit mode')
    it('auto-advances to correct step')
    it('preserves existing data')
    it('allows modifying and re-submitting')
  })
})
```

### E10. Create `cypress/e2e/family/view.cy.ts` (if not exists)

```
describe('Family — My Family (View)', () => {
  beforeEach(() => { cy.loginAsCitizen(); cy.visitFamilyPage() })

  describe('Family Summary', () => {
    it('displays family ID')
    it('displays registration status with correct badge color')
    it('displays household size')
    it('displays registration date')
    it('shows fallback "—" for missing fields')
  })

  describe('Members List', () => {
    it('displays all family members')
    it('shows member count in section header')
    it('displays name, NID, DOB, gender, relationship for each')
    it('highlights the family head')
    it('sorts members (head first)')
    it('shows extended Jamaica fields when present')
    it('shows "—" for missing optional fields')
  })

  describe('Address Section', () => {
    it('displays permanent address')
    it('displays mailing address when different')
    it('shows "No address available" when address is null')
  })

  describe('Housing & Services', () => {
    it('displays housing info when available')
    it('shows empty state when no housing data')
  })

  describe('Navigation', () => {
    it('shows Edit button for users with EDIT permission')
    it('hides Edit button without EDIT permission')
    it('navigates to Family Edit page')
  })
})
```

### E11. Create `cypress/e2e/family/edit.cy.ts` (if not exists)

```
describe('Family — Family Edit', () => {
  beforeEach(() => { cy.loginAsCitizen(); cy.visitFamilyEdit() })

  describe('Page Load', () => {
    it('loads family data from API')
    it('displays family info in editable form')
    it('displays members in editable cards')
    it('shows pending changes tracker')
  })

  describe('Family Info Editing', () => {
    it('allows editing household size')
    it('allows editing phone number')
    it('allows editing email')
    it('validates phone is 10 digits')
    it('validates email format')
    it('tracks changes as pending')
  })

  describe('Member Editing', () => {
    it('opens member edit form')
    it('validates first name required')
    it('validates last name required')
    it('validates NID format')
    it('validates no duplicate NID in family')
    it('validates DOB not in future')
    it('validates head age >= 18')
    it('validates child not older than head')
    it('locks head relationship field')
    it('restricts spouse when head is single')
    it('allows only one spouse')
    it('validates phone format')
    it('validates email format')
    it('shows gender-relationship warning')
  })

  describe('Add Member', () => {
    it('opens add member form')
    it('validates all required fields')
    it('warns if adding beyond household size')
    it('saves new member via API')
  })

  describe('Remove Member', () => {
    it('shows confirmation dialog')
    it('prevents removing the head member')
    it('removes member via API')
    it('updates household size warning')
  })

  describe('Save & Submit', () => {
    it('saves all pending changes with reason/audit')
    it('validates all members before submit')
    it('blocks submit if validation errors exist')
    it('shows household size mismatch warning')
    it('shows success message after save')
  })

  describe('Unsaved Changes', () => {
    it('warns when navigating away with unsaved changes')
    it('warns on browser back with unsaved changes')
    it('warns on page refresh with unsaved changes')
  })
})
```

### E12. Create `cypress/e2e/family/member-profile.cy.ts` (if not exists)

```
describe('Family — Member Profile', () => {
  beforeEach(() => { cy.loginAsCitizen(); cy.visit('/family') })

  describe('Member Selection', () => {
    it('shows member selector dropdown')
    it('lists all family members')
    it('defaults to head member')
    it('switches between members')
  })

  describe('Profile Display', () => {
    it('shows member name and basic info')
    it('shows profile photo or placeholder avatar')
    it('handles photo loading failure gracefully')
    it('shows NID, DOB, gender, relationship')
    it('shows extended fields when present')
    it('shows "—" for missing optional fields')
    it('shows family summary with total income')
    it('handles null income values without NaN')
  })
})
```

### E13. Create `cypress/e2e/family/documents.cy.ts` (if not exists)

```
describe('Family — Documents', () => {
  beforeEach(() => { cy.loginAsCitizen(); cy.visit('/documents') })

  describe('Document List', () => {
    it('loads documents from API')
    it('shows document holder filter')
    it('shows document type for each')
    it('shows upload date and status badge')
    it('shows rejection reason for rejected docs')
    it('filters by holder')
  })

  describe('Upload', () => {
    it('shows holder dropdown (family + members)')
    it('excludes deleted members from dropdown')
    it('shows document type dropdown')
    it('accepts valid file types')
    it('rejects oversized files (>10MB)')
    it('warns about duplicate document type')
    it('uploads successfully')
    it('shows new document in list')
  })

  describe('Delete', () => {
    it('shows delete confirmation')
    it('deletes document via API')
    it('removes from list')
  })

  describe('Re-upload', () => {
    it('allows re-uploading rejected documents')
  })
})
```

### E14. Create `cypress/e2e/family/admin-families.cy.ts` (if not exists)

```
describe('Family — Admin Family Management', () => {
  beforeEach(() => { cy.loginAsAdmin(); cy.visitAdminFamilies() })

  describe('Families List', () => {
    it('loads families from API')
    it('shows search input with debounce')
    it('shows status filter dropdown')
    it('displays family data in table')
    it('shows Active/Archived tabs')
    it('paginates results')
  })

  describe('Family Detail Drawer', () => {
    it('opens on row click')
    it('shows family details')
    it('shows member list')
    it('shows address information')
    it('closes drawer')
  })

  describe('Status Change', () => {
    it('shows inline status dropdown')
    it('shows confirmation dialog before change')
    it('updates status via API')
    it('shows updated status')
  })

  describe('Archive', () => {
    it('shows archive button for permitted users')
    it('requires reason for archiving')
    it('warns about active programme enrollments')
    it('archives family via API')
    it('moves family to Archived tab')
  })

  describe('Export/Import', () => {
    it('exports to CSV')
    it('exports to Excel')
    it('shows import modal')
    it('validates import data format')
  })
})
```

### E15. Create `cypress/e2e/family/dashboard.cy.ts` (if not exists)

```
describe('Family — Citizen Dashboard', () => {
  beforeEach(() => { cy.loginAsCitizen(); cy.visitDashboard() })

  describe('Dashboard Load', () => {
    it('loads family data')
    it('shows family status badge with correct color')
    it('handles all possible status values')
    it('shows member count')
    it('shows quick action cards')
  })

  describe('Draft Family', () => {
    it('shows draft banner for draft status')
    it('shows accurate member progress: X of Y added')
    it('shows complete registration button')
    it('navigates to registration wizard')
  })

  describe('Approved Family', () => {
    it('shows summary cards')
    it('shows member list preview')
    it('shows address info')
    it('navigates to family detail')
  })

  describe('No Family', () => {
    it('shows empty state for new users')
    it('shows register button')
    it('navigates to registration')
  })
})
```

---

## 7. FILE INVENTORY & EXISTENCE CHECKS

Before creating any file, check if it already exists. Here is the complete list of files to be created or modified:

### Files to CREATE (only if they don't exist):
| File | Type | Module |
|------|------|--------|
| `src/utils/familyValidations.ts` | Validation Lib | Family |
| `src/utils/iamValidations.ts` | Validation Lib | IAM |
| `src/utils/familyValidations.test.ts` | Unit Test | Family |
| `src/utils/iamValidations.test.ts` | Unit Test | IAM |
| `cypress.config.ts` | Config | Testing |
| `cypress/support/e2e.ts` | Support | Testing |
| `cypress/support/commands.ts` | Support | Testing |
| `cypress/e2e/iam/login.cy.ts` | E2E Test | IAM |
| `cypress/e2e/iam/reset-password.cy.ts` | E2E Test | IAM |
| `cypress/e2e/iam/roles.cy.ts` | E2E Test | IAM |
| `cypress/e2e/iam/users.cy.ts` | E2E Test | IAM |
| `cypress/e2e/family/registration.cy.ts` | E2E Test | Family |
| `cypress/e2e/family/view.cy.ts` | E2E Test | Family |
| `cypress/e2e/family/edit.cy.ts` | E2E Test | Family |
| `cypress/e2e/family/member-profile.cy.ts` | E2E Test | Family |
| `cypress/e2e/family/documents.cy.ts` | E2E Test | Family |
| `cypress/e2e/family/admin-families.cy.ts` | E2E Test | Family |
| `cypress/e2e/family/dashboard.cy.ts` | E2E Test | Family |

### Files to MODIFY (edit in-place):
| File | Changes |
|------|---------|
| `src/components/citizen/FamilyEdit.tsx` | Apply Bugs 1-14 fixes |
| `src/components/citizen/MyFamily.tsx` | Apply Bugs 15-18 fixes |
| `src/components/citizen/MemberProfile.tsx` | Apply Bugs 19-20 fixes |
| `src/components/citizen/Dashboard.tsx` | Apply Bugs 21-22 fixes |
| `src/components/citizen/Documents.tsx` | Apply Bugs 23-25 fixes |
| `src/pages/registration/RegistrationWizard.tsx` | Apply Bugs 26-30 fixes |
| `src/components/superadmin/AdminFamilies.tsx` | Apply Bugs 31-33 fixes |
| `src/components/public/LoginPage.tsx` | Apply Bugs 34-38 fixes |
| `src/components/public/ResetPasswordPage.tsx` | Apply Bugs 39-41 fixes |
| `src/components/citizen/SetPasswordModal.tsx` | Apply Bugs 42-43 fixes |
| `src/components/WorkerRegistrationModal.tsx` | Apply Bugs 44-46 fixes |
| `src/store/authStore.ts` | Apply Bugs 47-48 fixes |
| `src/services/iamApi.ts` | Apply Bug 49-50 fixes |
| `src/services/authFetch.ts` | Apply Bug 49-50 fixes |
| `src/components/superadmin/AdminAdmins.tsx` | Apply Bugs 51-52 fixes |
| `src/components/superadmin/AdminRoles.tsx` | Apply Bug 53-54 fixes |
| `src/components/superadmin/AdminRoleForm.tsx` | Apply Bugs 55-56 fixes |
| `src/components/superadmin/AdminRoleManagement.tsx` | Apply Bug 57 fixes |
| `package.json` | Add cypress, @testing-library deps if missing |

### Dependencies to install (if not in package.json):
```bash
npm install -D cypress @testing-library/cypress @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

---

## EXECUTION ORDER

Execute in this exact order:
1. **Check all file existence** — list each file above
2. **Install dependencies** — check package.json, install missing
3. **Create validation libraries** (C1, C2) — these are pure functions, no UI deps
4. **Create unit tests** (D1, D2) — run them to verify validations
5. **Apply Family module bug fixes** (A1–A7) — import from validation library
6. **Apply IAM module bug fixes** (B1–B10) — import from validation library
7. **Setup Cypress** (E1–E4) — config, support, commands
8. **Create Cypress E2E tests** (E5–E15) — one file at a time
9. **Run unit tests** to verify: `npm run test`
10. **Run Cypress** to verify: `npx cypress run`

---

## CRITICAL REMINDERS

1. **NEVER create a file that already exists** — always check first with file listing.
2. **All validation functions must be pure** — no React imports, no side effects.
3. **Use the shared validation libraries** in both FamilyEdit.tsx AND RegistrationWizard.tsx — DRY.
4. **Cypress tests should be runnable** against a live dev server (localhost:3000 + 3001 + 3003).
5. **Cypress env variables** for test credentials should be configured in `cypress.config.ts` or `cypress.env.json`.
6. **All bug fixes must not break existing functionality** — they ADD validation, they don't remove features.
7. **Every form field mentioned in this prompt exists in the current codebase** — the prompt was generated from reading every line of every file.
8. **Status badges must handle ALL possible values**: PENDING, APPROVED, REJECTED, UNDER_REVIEW, DRAFT, SUBMITTED, ARCHIVED, ACTIVE, INACTIVE, DISABLED, LOCKED — with fallback for unknown values.
