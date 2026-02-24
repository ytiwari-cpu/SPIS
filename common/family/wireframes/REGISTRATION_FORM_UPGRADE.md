# Registration Form Upgrade — Jamaica Social Assistance Application

## Overview

Comprehensive end-to-end upgrade of the Family Registration flow to align with the Government of Jamaica "Application for Social Assistance" paper form. All changes maintain the existing UI orientation and layout while adding ~60 new fields across all layers.

---

## 1. Database Migration

**File:** `database/migrations/010_registration_form_upgrade.sql`

### Family Table Extensions
| Column | Type | Purpose |
|--------|------|---------|
| `programme` | VARCHAR(50) | PATH, STEPS_TO_WORK, etc. |
| `payment_option` | VARCHAR(50) | direct_deposit, cheque, money_transfer |
| `social_worker_zone` | VARCHAR(20) | Social worker zone code |
| `social_worker_code` | VARCHAR(20) | Social worker ID code |
| `application_no` | VARCHAR(50) | Application number |
| `constituency_code` | VARCHAR(20) | Constituency code |
| `head_middle_names` | VARCHAR(100) | Head's middle names |
| `head_alias` | VARCHAR(100) | Head's alias/nickname |
| `head_mothers_maiden_name` | VARCHAR(100) | Head's mother's maiden name |
| `mailing_address_different` | BOOLEAN | Flag for separate mailing address |
| `directions_to_house` | TEXT | Directions to residence |

### Address Table Extensions
| Column | Type | Purpose |
|--------|------|---------|
| `lot_apt` | VARCHAR(50) | Lot/apartment number |
| `street_district` | VARCHAR(255) | Street or district name |
| `post_office` | VARCHAR(100) | Post office name |
| `post_code` | VARCHAR(20) | Postal code |
| `area_type` | VARCHAR(20) | URBAN, RURAL, SEMI_URBAN |

### Family Member Table Extensions (~40 columns)
- **Identity:** `middle_names`, `alias`, `trn`, `nis_no`, `id_type`, `id_number`, `birth_entry_number`, `mothers_maiden_name`, `is_twin`, `order_number`, `sex_code`
- **Employment & Contact:** `occupation`, `contact_no_1`, `contact_no_2`, `union_status`
- **Education:** `last_school_completed`, `school_name`, `school_code`, `school_grade`, `school_class`, `school_shift`
- **Health:** `pregnant`, `pregnancy_due_date`, `is_disabled`, `is_mentally_ill`, `is_chronically_ill`, `is_shut_in`, `is_nis_pensioner`, `pension_number`, `clinic_name`, `clinic_code`
- **Registration Documents:** `reg_doc_birth_certificate`, `reg_doc_id`, `reg_doc_trn_card`, `reg_doc_nis_card`, `reg_doc_passport`, `reg_doc_drivers_license`, `reg_doc_marriage_certificate`, `reg_doc_other`

### New Table: `house_services`
- **Dwelling:** `dwelling_tenure`, `number_of_rooms`, `number_of_bedrooms`
- **Services:** `utilities`, `water`, `sanitation`
- **Assets (16 booleans):** stove, fridge, bed, chair, table, radio, TV, cable, phone, computer, internet, washing machine, vehicle, bicycle, land, livestock
- **Financial:** `weekly_family_spending`, `monthly_rent`, `total_income`

### Data Integrity
- Unique index on `family_member.national_id` (WHERE NOT NULL)

---

## 2. Backend Types

**File:** `backend/family-service/src/types/schema.ts`

- Updated `DbFamily`, `DbAddress`, `DbFamilyMember` interfaces with all new columns
- New `DbHouseServices` interface
- New enum constants: `UnionStatus`, `IdType`, `LastSchoolCompleted`, `PregnantStatus`, `AreaType`, `DwellingTenure`, `Programme`, `PaymentOption`

---

## 3. Backend Validators

**File:** `backend/family-service/src/validators/schemas.ts`

- Extended all Zod schemas with new field validations
- New `AddressTypeSchema` includes `'MAILING'`
- New `CreateHouseServicesSchema` / `UpdateHouseServicesSchema`
- Country default fixed from `'Tanzania'` to `'Jamaica'`

---

## 4. Backend Routes

**File:** `backend/family-service/src/routes/registration.routes.ts`

### Updated Endpoints
| Method | Path | Changes |
|--------|------|---------|
| POST | `/family` | All new family fields in INSERT |
| POST | `/family/:uuid/address` | Extended address fields |
| POST | `/family/:uuid/members` | All ~40 new member fields |
| PUT | `/family/:familyUuid` | All new family fields in UPDATE |
| PUT | `/family/:familyUuid/address` | Extended address fields |
| PUT | `/family/:familyUuid/members/:memberUuid` | All new member fields |
| GET | `/family/:familyUuid` | Returns `mailing_address` + `house_services` |
| GET | `/family/:familyUuid/review` | Returns `mailing_address` + `house_services` |

### New Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/family/:familyUuid/mailing-address` | Create mailing address (supports `same_as_permanent`) |
| GET | `/family/:familyUuid/mailing-address` | Get mailing address |
| PUT | `/family/:familyUuid/mailing-address` | Update mailing address |
| POST | `/family/:familyUuid/house-services` | Create/upsert house services |
| GET | `/family/:familyUuid/house-services` | Get house services |
| PUT | `/family/:familyUuid/house-services` | Update house services |

---

## 5. Frontend Types

**File:** `frontend/src/types/database.ts`

- Updated `DbAddress`, `DbFamily`, `DbFamilyMember` with all new fields
- New `DbHouseServices` interface
- New type aliases: `AreaType`, `DwellingTenure`, `Programme`, `PaymentOption`, `UnionStatus`, `IdType`, `LastSchoolCompleted`, `PregnantStatus`
- Updated `AddressFormData` and `MemberFormData`

---

## 6. Frontend Pages

### RegistrationWizard.tsx
**File:** `frontend/src/pages/registration/RegistrationWizard.tsx`

- **Step 1 (Family + Address):**
  - Head middle names, alias, mother's maiden name inputs
  - Programme & payment option selects
  - Social worker zone/code inputs
  - Extended address: lot/apt, street/district, post office, post code, area type
  - Directions to house textarea
  - Mailing address section with "different from permanent" checkbox + conditional form

- **Step 2 (Members):**
  - Collapsible "Additional Details (Jamaica Form Fields)" section
  - Color-coded subsections: Identity (indigo), Employment & Contact (green), Education (yellow), Health (red), Registration Documents (purple)
  - All ~40 new member fields with proper inputs

- **Step 4 (Review):**
  - Displays programme, payment option, head extended names, alias
  - Extended address fields, mailing address
  - Member middle names and TRN
  - `handleCreateFamily` passes all new fields to API

### MyFamily.tsx
**File:** `frontend/src/pages/citizen/MyFamily.tsx`

- Updated inline types: `FamilyDB`, `MemberDB`, `AddressDB` + new `HouseServicesDB`
- Family Summary: programme badge, payment option, social worker info, alias, directions
- Member Cards: middle names in name, alias display, TRN/occupation/union_status row, education, health flag badges (disabled, chronically ill, mentally ill, shut-in)
- Address: lot/apt prefix, street/district, post office, post code, area type grid
- New Mailing Address section (conditional)
- New Housing & Services section: dwelling info, utilities grid, asset badges, income summary

### MyProfile.tsx
**File:** `frontend/src/pages/citizen/MyProfile.tsx`

- **Bug fix:** Added missing `import { authFetch }` (was crashing at runtime)
- Updated types with `middle_names`, `alias`, `trn`, `programme`, extended address fields
- Display: full name with middle names, alias field, TRN field, programme badge
- Improved address display using array join instead of template literal

### MemberProfile.tsx
**File:** `frontend/src/pages/citizen/MemberProfile.tsx`

- Updated `MemberDB` with all ~40 new fields, `AddressDB` with extended fields
- Name display includes middle names + alias
- Member dropdown shows middle names
- New fields: Contact No 1/2, TRN, NIS No, union status alongside marital status, occupation
- New Education section: last school level, school name, grade
- New Health section: disability/chronic illness/mental illness/shut-in badges, pregnancy with due date, clinic info
- New Pension section: NIS pensioner flag with pension number
- Improved address display

---

## 7. Field Mapping to Jamaica Form Sections

| Form Section | Fields Added | Location |
|---|---|---|
| **Section 1 — Head of Household** | middle_names, alias, mothers_maiden_name, programme, payment_option, social_worker_zone/code | Family table + Step 1 |
| **Section 2 — Address** | lot_apt, street_district, post_office, post_code, area_type, directions_to_house, mailing address | Address table + Step 1 |
| **Section 3 — House Services** | dwelling_tenure, utilities, water, sanitation, 16 asset booleans, rooms/bedrooms, spending/rent/income | house_services table + new routes |
| **Section 4 — Household Members** | ~40 new columns covering identity, employment, education, health, registration documents | family_member table + Step 2 |
