# Dashboard Prompt

Prompt for building the Super Admin Dashboard experience inside the existing React application.

---

## Context

You are working inside an existing React application that already has a global layout and sidebar.
Follow the existing project patterns and styling exactly.

---

## Primary Goal

Create a Super Admin Dashboard experience by adding the following sections as new items in the existing sidebar, and implement the corresponding pages using the same layout and design system as the existing pages.

---

## Hard Requirements

- Use the existing sidebar component/navigation structure. **Do NOT create a new sidebar.**
- Add these sidebar sections (routes/pages) under the same layout:
  - Overview
  - Families
  - Programmes
  - Grievances
  - Appeals
  - Admins & Access
  - Archived
  - Audit Logs
- All pages must use the current layout wrapper and match the existing page design (same header spacing, typography, table style, buttons, filters, etc.).
- **Families page must use the existing Families API** already present in the codebase. Do not mock families. Use the current API service/client and existing hooks/patterns.
- For new features (Programmes, Grievances, Appeals, Admins, Archived, Audit Logs), use mock data.
- Create **ONE single mock data file** (e.g., `src/mock/superAdminMockData.ts`). Store all mock arrays and helper functions there. Do NOT define mock data inside individual components.
- Implement Edit and Archive access controls (RBAC) at UI level — hide/disable buttons when permissions are missing.
- Use pagination, sorting, and filtering UI consistent with the existing table pages.

---

## Feature Details

### 1) Families (Real API)

Fetches family dataset using the existing API. Table columns:

- Family ID, Head of Family, Members Count, Region/District, Phone, Primary Programme, Status, Last Updated

Row actions:
- **View** — details drawer consistent with current UX
- **Edit** — permission-based
- **Archive** — permission-based + confirmation modal requiring reason

Provide search + filters consistent with current UI.

---

### 2) Programmes (Mock Data)

#### A. Programmes Master Table

Columns: Programme ID, Name, Programme Type, Status, Enrolled Count, Eligible Count, Benefits Disbursed, Last Updated

- Allow sorting/grouping by Programme Type (dropdown or chips)
- Default view groups by type then sorts by name
- Row action: View Programme (opens details view or drawer)

#### B. Programme Details View

When a programme is selected, show a table of associated families with tabs/segmented control:

- **Enrolled**
- **Benefits Received** (sortable by amount / count / date)
- **Eligible**

Each segment supports search + region filter + date filter (client-side). Include export button (permission-based, CSV).

---

### 3) Grievances (Mock Data)

Columns: Grievance ID, Family ID, Category, Priority, Status, Assigned Admin, Created Date, SLA Due

Actions: View, Edit, Archive (permission-based)

Status update UI (dropdown) consistent with existing patterns.

---

### 4) Appeals (Mock Data)

Columns: Appeal ID, Grievance ID, Family ID, Reason, Status, Reviewer, Submitted Date

Review UI in a details drawer: Approve / Deny / Request Info

Actions: View, Edit, Archive (permission-based)

---

### 5) Admins & Access Control (Mock Data)

Table: Admin ID, Name, Email, Role, Status, Last Login

Actions: Add Admin, Edit Admin, Suspend/Activate

Permission matrix editor (modal) with modules:
- Families, Programmes, Grievances, Appeals, Archived, Audit Logs, Export

Permissions: View, Create, Edit, Archive, Manage Admins, Export

---

### 6) Archived (Mock Data)

Unified table filterable by record type: Families / Programmes / Grievances / Appeals

- Restore action (Super Admin only)
- Show: archived reason, archived by, archived date

---

### 7) Audit Logs (Mock Data)

Immutable log table columns: Timestamp, Actor, Action, Module, Record ID, Summary

Filters: user, module, date range

---

## Mock Data Model (`superAdminMockData.ts`)

Arrays to include:

```ts
programmes[]               // with programmeType field
programmeFamilyMap[]       // programmeId, familyId, enrollmentStatus, benefitsReceivedCount, benefitsReceivedAmount, lastBenefitDate
grievances[]
appeals[]
admins[]                   // with permissions object
archivedRecords[]
auditLogs[]
```

Helper functions:

```ts
getProgrammeFamilies(programmeId)
getProgrammeFamiliesBySegment(programmeId, segment)
hasPermission(user, permissionKey)
```

---

## Implementation Instructions

- Create the necessary routes/pages and connect them to the existing sidebar navigation.
- Reuse existing shared components (Table, Badge, Modal, Drawer, Button, Filters) wherever available.
- Keep styling identical to existing pages.
- No duplication of layout wrappers — all pages must render within the existing layout.
- Do not invent a new UI library. Use what the project already uses.

---

## Deliverables

- New/updated routes
- Sidebar updated with the new sections
- Pages created for each section
- Central mock data file created and imported by relevant pages
- Families page connected to the real API
