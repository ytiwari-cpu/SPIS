You are Opus 4.5 acting as a PRINCIPAL SOFTWARE ARCHITECT.

Your task is to generate the COMPLETE FAMILY MODULE
for a national-scale social protection platform.

This includes:
- Public-facing website (landing + notices)
- Citizen-facing frontend
- Family backend service
- Database usage (existing Supabase schema)
- APIs, workflows, placeholders for future modules

This is NOT a demo.
This is a REAL production system.

══════════════════════════════════════
1. OVERALL PLATFORM STRUCTURE
══════════════════════════════════════

The platform consists of:

1️⃣ PUBLIC AREA (No login required)
2️⃣ AUTHENTICATED AREA (Role-based dashboards)

For now, ONLY the CITIZEN role is active,
but the system must be designed to support:
- Citizens
- Case workers
- Programme managers
- Administrators (future)

══════════════════════════════════════
2. PUBLIC HOME PAGE (GLOBAL ENTRY POINT)
══════════════════════════════════════

There is ONE public home page for the entire project.

This page is accessible without login and must include:

──────────
2.1 Home Page Sections
──────────

- Project overview
  - Purpose of the platform
  - Who it is for
  - What services are offered

- Public notices
  - Government announcements
  - Programme notices
  - Disaster / emergency notices
  - Downloadable attachments (if any)

- Call-to-action buttons
  - “Register a Family”
  - “Login”

- Top-right navigation
  - Login button
  - Language selector (placeholder)

──────────
2.2 Public Notices Behavior
──────────

- Notices are readable without login
- Notices may later come from backend
- For now, support static or mocked notices
- UI must be ready for backend integration

══════════════════════════════════════
3. AUTHENTICATION & ROLE ROUTING
══════════════════════════════════════

Authentication is handled externally.

After login:
- System receives user context:
  - user_id
  - member_id
  - family_id (if exists)
  - role (CITIZEN for now)

Routing behavior:
- CITIZEN → Citizen Dashboard
- Other roles → Placeholder dashboards (future)

DO NOT implement authentication logic.
ONLY consume auth context.

══════════════════════════════════════
4. FAMILY REGISTRATION ENTRY FLOW
══════════════════════════════════════

From the PUBLIC HOME PAGE:

- “Register a Family” button starts the FAMILY REGISTRATION FLOW
- User may register before or after login (configurable)

Registration flow stages:
1. Family draft creation
2. Head member details
3. Address details
4. Household members
5. Document uploads
6. Review & submit

After first submission:
- Registration status becomes SUBMITTED
- Background processes will run (eligibility later)
- Fields become partially read-only

══════════════════════════════════════
5. DATABASE CONTEXT (AUTHORITATIVE)
══════════════════════════════════════

Database:
- Supabase (PostgreSQL)
- Schema: family
- Tables already EXIST

STRICT RULE:
DO NOT redesign database.
DO NOT rename tables or columns.
DO NOT add or remove fields.

The database is the SOURCE OF TRUTH.

Tables available under schema `family`:
- family
- family_member
- biometric_metadata
- address
- account_details
- identity_match
- family_history
- family_event_outbox
- documents
- document_verification

Score-related tables are NOT included yet.

══════════════════════════════════════
6. FAMILY BACKEND SERVICE
══════════════════════════════════════

Service name:
- family-service

Responsibilities:
- Family registration lifecycle
- Member management
- Address management
- Document handling
- Biometric enrollment metadata
- Identity deduplication support
- Audit history
- Event publishing (outbox pattern)

──────────
6.1 Backend APIs
──────────

Family:
- Create family (draft)
- Submit family registration
- Update editable fields
- Fetch family profile
- Fetch registration status

Members:
- Add / update member
- Mark member deceased
- Fetch member profile

Documents:
- Upload document (family/member)
- Replace rejected documents
- Fetch documents & verification status

Biometrics:
- Store enrollment metadata
- Fetch biometric enrollment status

Audit & Events:
- Write to family_history on every change
- Publish events to family_event_outbox

──────────
6.2 Backend Rules
──────────

- REST APIs
- UUID identifiers
- Explicit SQL (no ORM auto-migrations)
- Stateless service
- Pagination where required
- Centralized error handling

══════════════════════════════════════
7. CITIZEN DASHBOARD (AFTER LOGIN)
══════════════════════════════════════

After login, CITIZEN users see:

──────────
7.1 Dashboard (Home)
──────────
- Family summary
- Registration status badge
- Quick navigation tiles

──────────
7.2 My Profile
──────────
- Personal details
- Editable fields (rule-based)
- Biometric enrollment indicator
- Member documents

──────────
7.3 My Family
──────────
- Household overview
- Members list
- Head-of-family indicator
- Family address
- Family documents

──────────
7.4 Programmes (PLACEHOLDER)
──────────
Tabs:
- Eligible
- Approved
- In Progress
- Rejected / Withdrawn

UI must exist even if backend not live.

──────────
7.5 Benefits (PLACEHOLDER)
──────────
- Overall benefits
- Per-programme view
- Empty state handling

──────────
7.6 Grievances (PLACEHOLDER)
──────────
- Raise grievance (UI ready)
- Track grievance status

──────────
7.7 Public Notices
──────────
- Same notices as public view
- Available post-login as well

══════════════════════════════════════
8. FRONTEND TECH REQUIREMENTS
══════════════════════════════════════

- React + TypeScript (or equivalent modern stack)
- Theme-driven styling
- Responsive & accessible
- Skeleton loaders & empty states
- Autosave drafts
- Timeline components for history

Frontend MUST be service-oriented:
- familyApi (live)
- programmeApi (future)
- grievanceApi (future)
- paymentApi (future)

Frontend NEVER talks directly to Supabase.

══════════════════════════════════════
9. DELIVERABLES
══════════════════════════════════════

Generate output in this order:

1. Public + authenticated architecture
2. Frontend routing structure
3. Backend architecture
4. API contracts
5. Database access layer
6. Event publishing logic
7. UI layouts
8. Screen components
9. Reusable components
10. Placeholder strategy
11. Environment configuration
12. Extension points & assumptions

══════════════════════════════════════
10. STRICT RULES
══════════════════════════════════════

- Do NOT modify database schema
- Do NOT remove future placeholders
- Do NOT hardcode environments
- Do NOT skip audit or events
- Treat this as a government-scale system

══════════════════════════════════════
END OF PROMPT
══════════════════════════════════════
