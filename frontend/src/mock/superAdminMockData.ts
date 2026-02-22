/**
 * SUPER ADMIN MOCK DATA
 * 
 * Central mock data file for all Super Admin dashboard pages.
 * Contains mock arrays and helper functions for:
 * - Programmes
 * - Programme-Family mappings
 * - Grievances
 * - Appeals
 * - Admins
 * - Archived Records
 * - Audit Logs
 */

// ════════════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════════════

export type ProgrammeType = 'CASH_TRANSFER' | 'FOOD_SECURITY' | 'HEALTH' | 'EDUCATION' | 'HOUSING' | 'EMPLOYMENT'
export type ProgrammeStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'COMPLETED'
export type EnrollmentStatus = 'ENROLLED' | 'ELIGIBLE' | 'PENDING' | 'REJECTED'
export type GrievanceCategory = 'PAYMENT_ISSUE' | 'ELIGIBILITY_DISPUTE' | 'SERVICE_COMPLAINT' | 'STAFF_CONDUCT' | 'DATA_CORRECTION' | 'OTHER'
export type GrievancePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type GrievanceStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'ESCALATED'
export type AppealStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'DENIED' | 'INFO_REQUESTED'
export type AdminRole = 'SuperAdmin' | 'Admin' | 'CaseWorker' | 'ProgrammeManager' | 'Auditor'
export type AdminStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
export type RecordType = 'FAMILY' | 'PROGRAMME' | 'GRIEVANCE' | 'APPEAL'
export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'ARCHIVE' | 'RESTORE' | 'LOGIN' | 'LOGOUT' | 'EXPORT' | 'PERMISSION_CHANGE'
export type AuditModule = 'FAMILIES' | 'PROGRAMMES' | 'GRIEVANCES' | 'APPEALS' | 'ADMINS' | 'ARCHIVED' | 'AUDIT_LOGS' | 'AUTH'
export type CaseStatus = 'OPEN' | 'IN_PROGRESS' | 'PENDING_REVIEW' | 'COMPLETED' | 'CLOSED' | 'ON_HOLD'
export type CaseWorkerStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE'

export interface Programme {
  id: string
  name: string
  programmeType: ProgrammeType
  status: ProgrammeStatus
  description: string
  enrolledCount: number
  eligibleCount: number
  benefitsDisbursed: number
  createdAt: string
  lastUpdated: string
}

export interface ProgrammeFamilyMapping {
  id: string
  programmeId: string
  familyId: string
  familyName: string
  enrollmentStatus: EnrollmentStatus
  benefitsReceivedCount: number
  benefitsReceivedAmount: number
  lastBenefitDate: string | null
  region: string
  enrolledAt: string
}

export interface AdminGrievance {
  id: string
  familyId: string
  familyName: string
  category: GrievanceCategory
  priority: GrievancePriority
  status: GrievanceStatus
  summary: string
  assignedAdmin: string | null
  assignedAdminId: string | null
  createdAt: string
  slaDue: string
  resolvedAt: string | null
}

export interface Appeal {
  id: string
  grievanceId: string
  familyId: string
  familyName: string
  reason: string
  status: AppealStatus
  reviewer: string | null
  reviewerId: string | null
  submittedAt: string
  reviewedAt: string | null
  resolution: string | null
}

export interface AdminPermissions {
  families: { view: boolean; create: boolean; edit: boolean; archive: boolean }
  programmes: { view: boolean; create: boolean; edit: boolean; archive: boolean }
  grievances: { view: boolean; create: boolean; edit: boolean; archive: boolean }
  appeals: { view: boolean; create: boolean; edit: boolean; archive: boolean }
  archived: { view: boolean; restore: boolean }
  auditLogs: { view: boolean }
  admins: { view: boolean; create: boolean; edit: boolean; managePermissions: boolean }
  export: { enabled: boolean }
}

export interface Admin {
  id: string
  name: string
  email: string
  role: AdminRole
  status: AdminStatus
  lastLogin: string | null
  createdAt: string
  permissions: AdminPermissions
}

export interface ArchivedRecord {
  id: string
  recordType: RecordType
  originalId: string
  originalName: string
  archivedReason: string
  archivedBy: string
  archivedById: string
  archivedAt: string
  metadata: Record<string, unknown>
}

export interface AuditLog {
  id: string
  timestamp: string
  actor: string
  actorId: string
  action: AuditAction
  module: AuditModule
  recordId: string | null
  summary: string
  ipAddress: string
  metadata: Record<string, unknown>
}

// ════════════════════════════════════════════════════════════════════════════
// CASE WORKER TYPES
// ════════════════════════════════════════════════════════════════════════════

export interface CaseWorker {
  id: string
  name: string
  email: string
  phone: string
  status: CaseWorkerStatus
  region: string
  assignedCasesCount: number
  completedCasesCount: number
  pendingCasesCount: number
  overdueCasesCount: number
  lastLogin: string | null
  createdAt: string
  updatedAt: string
}

export interface Case {
  id: string
  caseNumber: string
  title: string
  type: 'ENROLLMENT' | 'GRIEVANCE' | 'VERIFICATION' | 'UPDATE' | 'ASSESSMENT'
  status: CaseStatus
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  familyId: string
  familyName: string
  assignedWorkerId: string | null
  assignedWorkerName: string | null
  assignedById: string | null
  assignedByName: string | null
  assignedAt: string | null
  dueDate: string | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

export interface CaseAssignment {
  id: string
  caseId: string
  workerId: string
  workerName: string
  assignedById: string
  assignedByName: string
  assignedAt: string
  unassignedAt: string | null
  status: 'ACTIVE' | 'COMPLETED' | 'REASSIGNED'
}

export interface CaseWorkerStats {
  totalAssigned: number
  completed: number
  pending: number
  overdue: number
  assignedByBreakdown: { assignerId: string; assignerName: string; count: number }[]
}

// ════════════════════════════════════════════════════════════════════════════
// MOCK DATA
// ════════════════════════════════════════════════════════════════════════════

export const programmes: Programme[] = [
  {
    id: 'prog_001',
    name: 'PATH Cash Transfer',
    programmeType: 'CASH_TRANSFER',
    status: 'ACTIVE',
    description: 'Programme of Advancement Through Health and Education',
    enrolledCount: 2450,
    eligibleCount: 3200,
    benefitsDisbursed: 45000000,
    createdAt: '2023-01-15T00:00:00Z',
    lastUpdated: '2026-02-15T10:30:00Z',
  },
  {
    id: 'prog_002',
    name: 'School Feeding Programme',
    programmeType: 'FOOD_SECURITY',
    status: 'ACTIVE',
    description: 'Provides nutritious meals to students in need',
    enrolledCount: 1850,
    eligibleCount: 2100,
    benefitsDisbursed: 28000000,
    createdAt: '2023-03-01T00:00:00Z',
    lastUpdated: '2026-02-14T15:45:00Z',
  },
  {
    id: 'prog_003',
    name: 'NHF Health Coverage',
    programmeType: 'HEALTH',
    status: 'ACTIVE',
    description: 'National Health Fund coverage for vulnerable families',
    enrolledCount: 3100,
    eligibleCount: 4500,
    benefitsDisbursed: 62000000,
    createdAt: '2022-06-01T00:00:00Z',
    lastUpdated: '2026-02-10T09:00:00Z',
  },
  {
    id: 'prog_004',
    name: 'STEP Employment Training',
    programmeType: 'EMPLOYMENT',
    status: 'ACTIVE',
    description: 'Skills Training for Employment Programme',
    enrolledCount: 890,
    eligibleCount: 1200,
    benefitsDisbursed: 15000000,
    createdAt: '2024-01-10T00:00:00Z',
    lastUpdated: '2026-02-12T11:20:00Z',
  },
  {
    id: 'prog_005',
    name: 'Education Grant',
    programmeType: 'EDUCATION',
    status: 'ACTIVE',
    description: 'Educational assistance for school supplies and fees',
    enrolledCount: 1650,
    eligibleCount: 2000,
    benefitsDisbursed: 22000000,
    createdAt: '2023-08-15T00:00:00Z',
    lastUpdated: '2026-02-08T14:00:00Z',
  },
  {
    id: 'prog_006',
    name: 'Housing Assistance',
    programmeType: 'HOUSING',
    status: 'SUSPENDED',
    description: 'Emergency housing repairs and support',
    enrolledCount: 320,
    eligibleCount: 500,
    benefitsDisbursed: 8500000,
    createdAt: '2024-06-01T00:00:00Z',
    lastUpdated: '2026-01-20T16:30:00Z',
  },
  {
    id: 'prog_007',
    name: 'Emergency Food Relief',
    programmeType: 'FOOD_SECURITY',
    status: 'COMPLETED',
    description: 'Hurricane relief food distribution programme',
    enrolledCount: 0,
    eligibleCount: 0,
    benefitsDisbursed: 12000000,
    createdAt: '2025-09-01T00:00:00Z',
    lastUpdated: '2025-12-31T23:59:59Z',
  },
]

export const programmeFamilyMappings: ProgrammeFamilyMapping[] = [
  // PATH Cash Transfer families
  { id: 'pfm_001', programmeId: 'prog_001', familyId: 'F001', familyName: 'Johnson Family', enrollmentStatus: 'ENROLLED', benefitsReceivedCount: 24, benefitsReceivedAmount: 480000, lastBenefitDate: '2026-02-01T00:00:00Z', region: 'Kingston', enrolledAt: '2023-02-01T00:00:00Z' },
  { id: 'pfm_002', programmeId: 'prog_001', familyId: 'F002', familyName: 'Williams Family', enrollmentStatus: 'ENROLLED', benefitsReceivedCount: 18, benefitsReceivedAmount: 360000, lastBenefitDate: '2026-02-01T00:00:00Z', region: 'St. Andrew', enrolledAt: '2023-06-15T00:00:00Z' },
  { id: 'pfm_003', programmeId: 'prog_001', familyId: 'F003', familyName: 'Brown Family', enrollmentStatus: 'ELIGIBLE', benefitsReceivedCount: 0, benefitsReceivedAmount: 0, lastBenefitDate: null, region: 'St. Catherine', enrolledAt: '2026-01-10T00:00:00Z' },
  { id: 'pfm_004', programmeId: 'prog_001', familyId: 'F004', familyName: 'Davis Family', enrollmentStatus: 'ENROLLED', benefitsReceivedCount: 12, benefitsReceivedAmount: 240000, lastBenefitDate: '2026-01-15T00:00:00Z', region: 'Clarendon', enrolledAt: '2024-02-20T00:00:00Z' },
  { id: 'pfm_005', programmeId: 'prog_001', familyId: 'F005', familyName: 'Miller Family', enrollmentStatus: 'ELIGIBLE', benefitsReceivedCount: 0, benefitsReceivedAmount: 0, lastBenefitDate: null, region: 'Manchester', enrolledAt: '2026-02-05T00:00:00Z' },
  
  // School Feeding Programme families
  { id: 'pfm_006', programmeId: 'prog_002', familyId: 'F001', familyName: 'Johnson Family', enrollmentStatus: 'ENROLLED', benefitsReceivedCount: 180, benefitsReceivedAmount: 90000, lastBenefitDate: '2026-02-14T00:00:00Z', region: 'Kingston', enrolledAt: '2023-09-01T00:00:00Z' },
  { id: 'pfm_007', programmeId: 'prog_002', familyId: 'F006', familyName: 'Garcia Family', enrollmentStatus: 'ENROLLED', benefitsReceivedCount: 120, benefitsReceivedAmount: 60000, lastBenefitDate: '2026-02-14T00:00:00Z', region: 'Portland', enrolledAt: '2024-01-15T00:00:00Z' },
  { id: 'pfm_008', programmeId: 'prog_002', familyId: 'F007', familyName: 'Martinez Family', enrollmentStatus: 'PENDING', benefitsReceivedCount: 0, benefitsReceivedAmount: 0, lastBenefitDate: null, region: 'St. James', enrolledAt: '2026-02-01T00:00:00Z' },
  
  // NHF Health Coverage families
  { id: 'pfm_009', programmeId: 'prog_003', familyId: 'F002', familyName: 'Williams Family', enrollmentStatus: 'ENROLLED', benefitsReceivedCount: 8, benefitsReceivedAmount: 45000, lastBenefitDate: '2026-01-20T00:00:00Z', region: 'St. Andrew', enrolledAt: '2022-08-01T00:00:00Z' },
  { id: 'pfm_010', programmeId: 'prog_003', familyId: 'F008', familyName: 'Thompson Family', enrollmentStatus: 'ENROLLED', benefitsReceivedCount: 15, benefitsReceivedAmount: 120000, lastBenefitDate: '2026-02-10T00:00:00Z', region: 'Westmoreland', enrolledAt: '2023-03-15T00:00:00Z' },
  { id: 'pfm_011', programmeId: 'prog_003', familyId: 'F009', familyName: 'Robinson Family', enrollmentStatus: 'ELIGIBLE', benefitsReceivedCount: 0, benefitsReceivedAmount: 0, lastBenefitDate: null, region: 'Trelawny', enrolledAt: '2026-01-25T00:00:00Z' },
  
  // STEP Employment Training families
  { id: 'pfm_012', programmeId: 'prog_004', familyId: 'F010', familyName: 'Clark Family', enrollmentStatus: 'ENROLLED', benefitsReceivedCount: 6, benefitsReceivedAmount: 180000, lastBenefitDate: '2026-02-05T00:00:00Z', region: 'St. Ann', enrolledAt: '2024-03-01T00:00:00Z' },
  { id: 'pfm_013', programmeId: 'prog_004', familyId: 'F011', familyName: 'Lewis Family', enrollmentStatus: 'PENDING', benefitsReceivedCount: 0, benefitsReceivedAmount: 0, lastBenefitDate: null, region: 'Hanover', enrolledAt: '2026-02-10T00:00:00Z' },
  
  // Education Grant families
  { id: 'pfm_014', programmeId: 'prog_005', familyId: 'F001', familyName: 'Johnson Family', enrollmentStatus: 'ENROLLED', benefitsReceivedCount: 4, benefitsReceivedAmount: 80000, lastBenefitDate: '2026-01-05T00:00:00Z', region: 'Kingston', enrolledAt: '2023-09-01T00:00:00Z' },
  { id: 'pfm_015', programmeId: 'prog_005', familyId: 'F012', familyName: 'Walker Family', enrollmentStatus: 'ENROLLED', benefitsReceivedCount: 3, benefitsReceivedAmount: 60000, lastBenefitDate: '2025-09-01T00:00:00Z', region: 'St. Elizabeth', enrolledAt: '2024-01-10T00:00:00Z' },
]

export const grievances: AdminGrievance[] = [
  {
    id: 'grv_001',
    familyId: 'F001',
    familyName: 'Johnson Family',
    category: 'PAYMENT_ISSUE',
    priority: 'HIGH',
    status: 'OPEN',
    summary: 'PATH payment not received for February 2026',
    assignedAdmin: 'Sarah Mitchell',
    assignedAdminId: 'adm_002',
    createdAt: '2026-02-10T09:00:00Z',
    slaDue: '2026-02-17T09:00:00Z',
    resolvedAt: null,
  },
  {
    id: 'grv_002',
    familyId: 'F003',
    familyName: 'Brown Family',
    category: 'ELIGIBILITY_DISPUTE',
    priority: 'MEDIUM',
    status: 'IN_PROGRESS',
    summary: 'Family believes they meet eligibility criteria for PATH programme',
    assignedAdmin: 'James Cooper',
    assignedAdminId: 'adm_003',
    createdAt: '2026-02-08T14:30:00Z',
    slaDue: '2026-02-22T14:30:00Z',
    resolvedAt: null,
  },
  {
    id: 'grv_003',
    familyId: 'F006',
    familyName: 'Garcia Family',
    category: 'SERVICE_COMPLAINT',
    priority: 'LOW',
    status: 'RESOLVED',
    summary: 'Long wait times at local office for document verification',
    assignedAdmin: 'Sarah Mitchell',
    assignedAdminId: 'adm_002',
    createdAt: '2026-01-25T11:00:00Z',
    slaDue: '2026-02-08T11:00:00Z',
    resolvedAt: '2026-02-05T16:00:00Z',
  },
  {
    id: 'grv_004',
    familyId: 'F008',
    familyName: 'Thompson Family',
    category: 'DATA_CORRECTION',
    priority: 'MEDIUM',
    status: 'OPEN',
    summary: 'Incorrect address recorded in system, causing delivery issues',
    assignedAdmin: null,
    assignedAdminId: null,
    createdAt: '2026-02-15T10:00:00Z',
    slaDue: '2026-03-01T10:00:00Z',
    resolvedAt: null,
  },
  {
    id: 'grv_005',
    familyId: 'F002',
    familyName: 'Williams Family',
    category: 'STAFF_CONDUCT',
    priority: 'CRITICAL',
    status: 'ESCALATED',
    summary: 'Complaint about unprofessional behavior at St. Andrew office',
    assignedAdmin: 'Admin Administrator',
    assignedAdminId: 'adm_001',
    createdAt: '2026-02-12T08:00:00Z',
    slaDue: '2026-02-14T08:00:00Z',
    resolvedAt: null,
  },
  {
    id: 'grv_006',
    familyId: 'F010',
    familyName: 'Clark Family',
    category: 'PAYMENT_ISSUE',
    priority: 'HIGH',
    status: 'CLOSED',
    summary: 'STEP training allowance deposited to wrong account',
    assignedAdmin: 'James Cooper',
    assignedAdminId: 'adm_003',
    createdAt: '2026-01-15T09:30:00Z',
    slaDue: '2026-01-22T09:30:00Z',
    resolvedAt: '2026-01-20T14:00:00Z',
  },
]

export const appeals: Appeal[] = [
  {
    id: 'apl_001',
    grievanceId: 'grv_002',
    familyId: 'F003',
    familyName: 'Brown Family',
    reason: 'Initial grievance decision did not consider updated income documentation',
    status: 'PENDING',
    reviewer: null,
    reviewerId: null,
    submittedAt: '2026-02-12T10:00:00Z',
    reviewedAt: null,
    resolution: null,
  },
  {
    id: 'apl_002',
    grievanceId: 'grv_003',
    familyId: 'F006',
    familyName: 'Garcia Family',
    reason: 'Requesting compensation for missed benefits due to administrative error',
    status: 'UNDER_REVIEW',
    reviewer: 'Sarah Mitchell',
    reviewerId: 'adm_002',
    submittedAt: '2026-02-06T11:00:00Z',
    reviewedAt: null,
    resolution: null,
  },
  {
    id: 'apl_003',
    grievanceId: 'grv_006',
    familyId: 'F010',
    familyName: 'Clark Family',
    reason: 'Bank charges incurred due to wrong account deposit should be reimbursed',
    status: 'INFO_REQUESTED',
    reviewer: 'James Cooper',
    reviewerId: 'adm_003',
    submittedAt: '2026-01-22T15:00:00Z',
    reviewedAt: '2026-01-25T09:00:00Z',
    resolution: 'Please provide bank statement showing charges incurred',
  },
  {
    id: 'apl_004',
    grievanceId: 'grv_001',
    familyId: 'F001',
    familyName: 'Johnson Family',
    reason: 'Emergency situation requires expedited payment processing',
    status: 'APPROVED',
    reviewer: 'Admin Administrator',
    reviewerId: 'adm_001',
    submittedAt: '2026-02-11T14:00:00Z',
    reviewedAt: '2026-02-12T09:00:00Z',
    resolution: 'Emergency payment approved and processed',
  },
  {
    id: 'apl_005',
    grievanceId: 'grv_005',
    familyId: 'F002',
    familyName: 'Williams Family',
    reason: 'Requesting formal apology and policy review',
    status: 'DENIED',
    reviewer: 'Admin Administrator',
    reviewerId: 'adm_001',
    submittedAt: '2026-02-14T10:00:00Z',
    reviewedAt: '2026-02-16T11:00:00Z',
    resolution: 'Staff member has been counseled. Formal apology is not standard procedure but matter is being addressed internally.',
  },
]

const fullPermissions: AdminPermissions = {
  families: { view: true, create: true, edit: true, archive: true },
  programmes: { view: true, create: true, edit: true, archive: true },
  grievances: { view: true, create: true, edit: true, archive: true },
  appeals: { view: true, create: true, edit: true, archive: true },
  archived: { view: true, restore: true },
  auditLogs: { view: true },
  admins: { view: true, create: true, edit: true, managePermissions: true },
  export: { enabled: true },
}

const adminPermissions: AdminPermissions = {
  families: { view: true, create: true, edit: true, archive: true },
  programmes: { view: true, create: true, edit: true, archive: false },
  grievances: { view: true, create: true, edit: true, archive: true },
  appeals: { view: true, create: false, edit: true, archive: false },
  archived: { view: true, restore: false },
  auditLogs: { view: true },
  admins: { view: true, create: false, edit: false, managePermissions: false },
  export: { enabled: true },
}

const caseWorkerPermissions: AdminPermissions = {
  families: { view: true, create: true, edit: true, archive: false },
  programmes: { view: true, create: false, edit: false, archive: false },
  grievances: { view: true, create: true, edit: true, archive: false },
  appeals: { view: true, create: false, edit: false, archive: false },
  archived: { view: false, restore: false },
  auditLogs: { view: false },
  admins: { view: false, create: false, edit: false, managePermissions: false },
  export: { enabled: false },
}

const auditorPermissions: AdminPermissions = {
  families: { view: true, create: false, edit: false, archive: false },
  programmes: { view: true, create: false, edit: false, archive: false },
  grievances: { view: true, create: false, edit: false, archive: false },
  appeals: { view: true, create: false, edit: false, archive: false },
  archived: { view: true, restore: false },
  auditLogs: { view: true },
  admins: { view: true, create: false, edit: false, managePermissions: false },
  export: { enabled: true },
}

export const admins: Admin[] = [
  {
    id: 'adm_001',
    name: 'Admin Administrator',
    email: 'admin@spis.gov.jm',
    role: 'SuperAdmin',
    status: 'ACTIVE',
    lastLogin: '2026-02-18T08:00:00Z',
    createdAt: '2022-01-01T00:00:00Z',
    permissions: fullPermissions,
  },
  {
    id: 'adm_002',
    name: 'Sarah Mitchell',
    email: 'sarah.mitchell@spis.gov.jm',
    role: 'Admin',
    status: 'ACTIVE',
    lastLogin: '2026-02-17T14:30:00Z',
    createdAt: '2023-03-15T00:00:00Z',
    permissions: adminPermissions,
  },
  {
    id: 'adm_003',
    name: 'James Cooper',
    email: 'james.cooper@spis.gov.jm',
    role: 'CaseWorker',
    status: 'ACTIVE',
    lastLogin: '2026-02-18T09:15:00Z',
    createdAt: '2024-01-10T00:00:00Z',
    permissions: caseWorkerPermissions,
  },
  {
    id: 'adm_004',
    name: 'Maria Santos',
    email: 'maria.santos@spis.gov.jm',
    role: 'ProgrammeManager',
    status: 'ACTIVE',
    lastLogin: '2026-02-16T11:00:00Z',
    createdAt: '2023-08-20T00:00:00Z',
    permissions: adminPermissions,
  },
  {
    id: 'adm_005',
    name: 'David Brown',
    email: 'david.brown@spis.gov.jm',
    role: 'Auditor',
    status: 'ACTIVE',
    lastLogin: '2026-02-15T10:00:00Z',
    createdAt: '2024-06-01T00:00:00Z',
    permissions: auditorPermissions,
  },
  {
    id: 'adm_006',
    name: 'Jennifer White',
    email: 'jennifer.white@spis.gov.jm',
    role: 'CaseWorker',
    status: 'SUSPENDED',
    lastLogin: '2026-01-10T08:00:00Z',
    createdAt: '2023-11-15T00:00:00Z',
    permissions: caseWorkerPermissions,
  },
]

export const archivedRecords: ArchivedRecord[] = [
  {
    id: 'arc_001',
    recordType: 'FAMILY',
    originalId: 'F050',
    originalName: 'Henderson Family',
    archivedReason: 'Family relocated outside of jurisdiction',
    archivedBy: 'Sarah Mitchell',
    archivedById: 'adm_002',
    archivedAt: '2026-01-15T10:00:00Z',
    metadata: { lastAddress: 'Kingston', memberCount: 4 },
  },
  {
    id: 'arc_002',
    recordType: 'PROGRAMME',
    originalId: 'prog_008',
    originalName: 'COVID-19 Relief Programme',
    archivedReason: 'Programme ended as scheduled',
    archivedBy: 'Admin Administrator',
    archivedById: 'adm_001',
    archivedAt: '2025-12-31T23:59:59Z',
    metadata: { totalDisbursed: 150000000, familiesServed: 5000 },
  },
  {
    id: 'arc_003',
    recordType: 'GRIEVANCE',
    originalId: 'grv_050',
    originalName: 'Payment Issue - Morgan Family',
    archivedReason: 'Duplicate of existing grievance',
    archivedBy: 'James Cooper',
    archivedById: 'adm_003',
    archivedAt: '2026-02-01T14:00:00Z',
    metadata: { duplicateOf: 'grv_048' },
  },
  {
    id: 'arc_004',
    recordType: 'APPEAL',
    originalId: 'apl_020',
    originalName: 'Eligibility Appeal - Peters Family',
    archivedReason: 'Appeal withdrawn by applicant',
    archivedBy: 'Sarah Mitchell',
    archivedById: 'adm_002',
    archivedAt: '2026-01-28T09:00:00Z',
    metadata: { withdrawalReason: 'Found alternative assistance' },
  },
  {
    id: 'arc_005',
    recordType: 'FAMILY',
    originalId: 'F075',
    originalName: 'Campbell Family',
    archivedReason: 'No longer meets programme eligibility criteria',
    archivedBy: 'Maria Santos',
    archivedById: 'adm_004',
    archivedAt: '2026-02-10T11:00:00Z',
    metadata: { reason: 'Income exceeded threshold' },
  },
]

export const auditLogs: AuditLog[] = [
  {
    id: 'log_001',
    timestamp: '2026-02-18T09:15:00Z',
    actor: 'James Cooper',
    actorId: 'adm_003',
    action: 'LOGIN',
    module: 'AUTH',
    recordId: null,
    summary: 'User logged in successfully',
    ipAddress: '192.168.1.100',
    metadata: {},
  },
  {
    id: 'log_002',
    timestamp: '2026-02-18T08:45:00Z',
    actor: 'Admin Administrator',
    actorId: 'adm_001',
    action: 'UPDATE',
    module: 'PROGRAMMES',
    recordId: 'prog_001',
    summary: 'Updated PATH Cash Transfer programme details',
    ipAddress: '192.168.1.50',
    metadata: { changedFields: ['benefitsDisbursed', 'enrolledCount'] },
  },
  {
    id: 'log_003',
    timestamp: '2026-02-18T08:30:00Z',
    actor: 'Sarah Mitchell',
    actorId: 'adm_002',
    action: 'CREATE',
    module: 'GRIEVANCES',
    recordId: 'grv_007',
    summary: 'Created new grievance for Williams Family',
    ipAddress: '192.168.1.75',
    metadata: { category: 'PAYMENT_ISSUE' },
  },
  {
    id: 'log_004',
    timestamp: '2026-02-18T08:00:00Z',
    actor: 'Admin Administrator',
    actorId: 'adm_001',
    action: 'LOGIN',
    module: 'AUTH',
    recordId: null,
    summary: 'User logged in successfully',
    ipAddress: '192.168.1.50',
    metadata: {},
  },
  {
    id: 'log_005',
    timestamp: '2026-02-17T17:00:00Z',
    actor: 'Maria Santos',
    actorId: 'adm_004',
    action: 'EXPORT',
    module: 'FAMILIES',
    recordId: null,
    summary: 'Exported families data to CSV',
    ipAddress: '192.168.1.120',
    metadata: { recordCount: 250, filters: { region: 'Kingston' } },
  },
  {
    id: 'log_006',
    timestamp: '2026-02-17T15:30:00Z',
    actor: 'Admin Administrator',
    actorId: 'adm_001',
    action: 'PERMISSION_CHANGE',
    module: 'ADMINS',
    recordId: 'adm_003',
    summary: 'Updated permissions for James Cooper',
    ipAddress: '192.168.1.50',
    metadata: { changed: ['grievances.edit'] },
  },
  {
    id: 'log_007',
    timestamp: '2026-02-17T14:00:00Z',
    actor: 'James Cooper',
    actorId: 'adm_003',
    action: 'UPDATE',
    module: 'GRIEVANCES',
    recordId: 'grv_002',
    summary: 'Updated grievance status to IN_PROGRESS',
    ipAddress: '192.168.1.100',
    metadata: { previousStatus: 'OPEN', newStatus: 'IN_PROGRESS' },
  },
  {
    id: 'log_008',
    timestamp: '2026-02-17T11:00:00Z',
    actor: 'Sarah Mitchell',
    actorId: 'adm_002',
    action: 'ARCHIVE',
    module: 'FAMILIES',
    recordId: 'F050',
    summary: 'Archived Henderson Family record',
    ipAddress: '192.168.1.75',
    metadata: { reason: 'Family relocated outside of jurisdiction' },
  },
  {
    id: 'log_009',
    timestamp: '2026-02-16T16:00:00Z',
    actor: 'Admin Administrator',
    actorId: 'adm_001',
    action: 'RESTORE',
    module: 'ARCHIVED',
    recordId: 'arc_010',
    summary: 'Restored Thompson Family record from archive',
    ipAddress: '192.168.1.50',
    metadata: {},
  },
  {
    id: 'log_010',
    timestamp: '2026-02-16T10:00:00Z',
    actor: 'David Brown',
    actorId: 'adm_005',
    action: 'EXPORT',
    module: 'AUDIT_LOGS',
    recordId: null,
    summary: 'Exported audit logs for compliance review',
    ipAddress: '192.168.1.200',
    metadata: { dateRange: { from: '2026-01-01', to: '2026-02-16' } },
  },
]

// ════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Get all families associated with a specific programme
 */
export function getProgrammeFamilies(programmeId: string): ProgrammeFamilyMapping[] {
  return programmeFamilyMappings.filter(mapping => mapping.programmeId === programmeId)
}

/**
 * Get families by programme and enrollment segment
 */
export function getProgrammeFamiliesBySegment(
  programmeId: string,
  segment: 'enrolled' | 'eligible' | 'benefits_received'
): ProgrammeFamilyMapping[] {
  const families = getProgrammeFamilies(programmeId)
  
  switch (segment) {
    case 'enrolled':
      return families.filter(f => f.enrollmentStatus === 'ENROLLED')
    case 'eligible':
      return families.filter(f => f.enrollmentStatus === 'ELIGIBLE' || f.enrollmentStatus === 'PENDING')
    case 'benefits_received':
      return families.filter(f => f.benefitsReceivedCount > 0).sort((a, b) => b.benefitsReceivedAmount - a.benefitsReceivedAmount)
    default:
      return families
  }
}

/**
 * Check if a user has a specific permission
 */
export function hasPermission(
  admin: Admin,
  module: keyof AdminPermissions,
  action: string
): boolean {
  if (admin.role === 'SuperAdmin') return true
  
  const modulePermissions = admin.permissions[module]
  if (!modulePermissions) return false
  
  return (modulePermissions as Record<string, boolean>)[action] ?? false
}

/**
 * Get programmes grouped by type
 */
export function getProgrammesByType(): Record<ProgrammeType, Programme[]> {
  const grouped: Record<ProgrammeType, Programme[]> = {
    CASH_TRANSFER: [],
    FOOD_SECURITY: [],
    HEALTH: [],
    EDUCATION: [],
    HOUSING: [],
    EMPLOYMENT: [],
  }
  
  programmes.forEach(prog => {
    grouped[prog.programmeType].push(prog)
  })
  
  return grouped
}

/**
 * Get grievances filtered by status
 */
export function getGrievancesByStatus(status?: GrievanceStatus): AdminGrievance[] {
  if (!status) return grievances
  return grievances.filter(g => g.status === status)
}

/**
 * Get appeals filtered by status
 */
export function getAppealsByStatus(status?: AppealStatus): Appeal[] {
  if (!status) return appeals
  return appeals.filter(a => a.status === status)
}

/**
 * Get archived records filtered by type
 */
export function getArchivedByType(recordType?: RecordType): ArchivedRecord[] {
  if (!recordType) return archivedRecords
  return archivedRecords.filter(r => r.recordType === recordType)
}

/**
 * Get audit logs with filters
 */
export function getFilteredAuditLogs(filters: {
  actorId?: string
  module?: AuditModule
  action?: AuditAction
  dateFrom?: string
  dateTo?: string
}): AuditLog[] {
  return auditLogs.filter(log => {
    if (filters.actorId && log.actorId !== filters.actorId) return false
    if (filters.module && log.module !== filters.module) return false
    if (filters.action && log.action !== filters.action) return false
    if (filters.dateFrom && log.timestamp < filters.dateFrom) return false
    if (filters.dateTo && log.timestamp > filters.dateTo) return false
    return true
  })
}

/**
 * Get current admin (mock - would come from auth in real app)
 */
export function getCurrentAdmin(): Admin {
  return admins[0] // SuperAdmin
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-JM', {
    style: 'currency',
    currency: 'JMD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Format date for display
 */
export function formatDate(dateString: string | null, format: 'short' | 'long' | 'relative' = 'short'): string {
  if (!dateString) return '—'
  
  const date = new Date(dateString)
  
  if (format === 'relative') {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  
  if (format === 'long') {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Export data to CSV
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function exportToCSV<T extends object>(
  data: T[],
  filename: string,
  columns: { key: keyof T; label: string }[]
): void {
  const headers = columns.map(c => c.label).join(',')
  const rows = data.map(item =>
    columns.map(c => {
      const value = item[c.key]
      // Escape commas and quotes
      const strValue = String(value ?? '')
      return strValue.includes(',') || strValue.includes('"')
        ? `"${strValue.replace(/"/g, '""')}"`
        : strValue
    }).join(',')
  )
  
  const csv = [headers, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`
  link.click()
}

// ════════════════════════════════════════════════════════════════════════════
// CASE WORKERS MOCK DATA
// ════════════════════════════════════════════════════════════════════════════

export const caseWorkers: CaseWorker[] = [
  {
    id: 'cw_001',
    name: 'Maria Thompson',
    email: 'maria.thompson@spis.gov.jm',
    phone: '876-555-0101',
    status: 'ACTIVE',
    region: 'Kingston',
    assignedCasesCount: 24,
    completedCasesCount: 156,
    pendingCasesCount: 18,
    overdueCasesCount: 3,
    lastLogin: '2026-02-19T08:30:00Z',
    createdAt: '2024-03-15T00:00:00Z',
    updatedAt: '2026-02-19T08:30:00Z',
  },
  {
    id: 'cw_002',
    name: 'David Brown',
    email: 'david.brown@spis.gov.jm',
    phone: '876-555-0102',
    status: 'ACTIVE',
    region: 'St. Andrew',
    assignedCasesCount: 31,
    completedCasesCount: 203,
    pendingCasesCount: 25,
    overdueCasesCount: 5,
    lastLogin: '2026-02-19T09:15:00Z',
    createdAt: '2023-08-20T00:00:00Z',
    updatedAt: '2026-02-19T09:15:00Z',
  },
  {
    id: 'cw_003',
    name: 'Sarah Williams',
    email: 'sarah.williams@spis.gov.jm',
    phone: '876-555-0103',
    status: 'ACTIVE',
    region: 'St. Catherine',
    assignedCasesCount: 18,
    completedCasesCount: 89,
    pendingCasesCount: 14,
    overdueCasesCount: 1,
    lastLogin: '2026-02-18T16:45:00Z',
    createdAt: '2024-06-10T00:00:00Z',
    updatedAt: '2026-02-18T16:45:00Z',
  },
  {
    id: 'cw_004',
    name: 'Michael Johnson',
    email: 'michael.johnson@spis.gov.jm',
    phone: '876-555-0104',
    status: 'ON_LEAVE',
    region: 'Manchester',
    assignedCasesCount: 0,
    completedCasesCount: 178,
    pendingCasesCount: 0,
    overdueCasesCount: 0,
    lastLogin: '2026-02-10T12:00:00Z',
    createdAt: '2023-02-01T00:00:00Z',
    updatedAt: '2026-02-10T12:00:00Z',
  },
  {
    id: 'cw_005',
    name: 'Jennifer Clarke',
    email: 'jennifer.clarke@spis.gov.jm',
    phone: '876-555-0105',
    status: 'ACTIVE',
    region: 'Clarendon',
    assignedCasesCount: 22,
    completedCasesCount: 134,
    pendingCasesCount: 16,
    overdueCasesCount: 2,
    lastLogin: '2026-02-19T07:00:00Z',
    createdAt: '2024-01-05T00:00:00Z',
    updatedAt: '2026-02-19T07:00:00Z',
  },
  {
    id: 'cw_006',
    name: 'Robert Taylor',
    email: 'robert.taylor@spis.gov.jm',
    phone: '876-555-0106',
    status: 'INACTIVE',
    region: 'St. James',
    assignedCasesCount: 0,
    completedCasesCount: 245,
    pendingCasesCount: 0,
    overdueCasesCount: 0,
    lastLogin: '2025-11-15T09:30:00Z',
    createdAt: '2022-05-20T00:00:00Z',
    updatedAt: '2025-11-15T09:30:00Z',
  },
]

export const cases: Case[] = [
  // Maria Thompson's cases
  {
    id: 'case_001',
    caseNumber: 'CS-2026-0001',
    title: 'PATH Enrollment - Johnson Family',
    type: 'ENROLLMENT',
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    familyId: 'F001',
    familyName: 'Johnson Family',
    assignedWorkerId: 'cw_001',
    assignedWorkerName: 'Maria Thompson',
    assignedById: 'admin_001',
    assignedByName: 'James Cooper',
    assignedAt: '2026-02-15T10:00:00Z',
    dueDate: '2026-02-25T23:59:59Z',
    createdAt: '2026-02-15T09:00:00Z',
    updatedAt: '2026-02-18T14:30:00Z',
    completedAt: null,
  },
  {
    id: 'case_002',
    caseNumber: 'CS-2026-0002',
    title: 'Document Verification - Smith Family',
    type: 'VERIFICATION',
    status: 'PENDING_REVIEW',
    priority: 'HIGH',
    familyId: 'F002',
    familyName: 'Smith Family',
    assignedWorkerId: 'cw_001',
    assignedWorkerName: 'Maria Thompson',
    assignedById: 'admin_002',
    assignedByName: 'Linda Martinez',
    assignedAt: '2026-02-10T08:00:00Z',
    dueDate: '2026-02-20T23:59:59Z',
    createdAt: '2026-02-10T07:30:00Z',
    updatedAt: '2026-02-17T11:00:00Z',
    completedAt: null,
  },
  {
    id: 'case_003',
    caseNumber: 'CS-2026-0003',
    title: 'Grievance Investigation - Brown Family',
    type: 'GRIEVANCE',
    status: 'OPEN',
    priority: 'URGENT',
    familyId: 'F003',
    familyName: 'Brown Family',
    assignedWorkerId: 'cw_001',
    assignedWorkerName: 'Maria Thompson',
    assignedById: 'admin_001',
    assignedByName: 'James Cooper',
    assignedAt: '2026-02-18T14:00:00Z',
    dueDate: '2026-02-19T17:00:00Z',
    createdAt: '2026-02-18T13:00:00Z',
    updatedAt: '2026-02-18T14:00:00Z',
    completedAt: null,
  },
  // David Brown's cases
  {
    id: 'case_004',
    caseNumber: 'CS-2026-0004',
    title: 'Annual Assessment - Williams Family',
    type: 'ASSESSMENT',
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    familyId: 'F004',
    familyName: 'Williams Family',
    assignedWorkerId: 'cw_002',
    assignedWorkerName: 'David Brown',
    assignedById: 'admin_003',
    assignedByName: 'Patricia Anderson',
    assignedAt: '2026-02-12T09:00:00Z',
    dueDate: '2026-02-28T23:59:59Z',
    createdAt: '2026-02-12T08:00:00Z',
    updatedAt: '2026-02-16T16:00:00Z',
    completedAt: null,
  },
  {
    id: 'case_005',
    caseNumber: 'CS-2026-0005',
    title: 'Address Update - Davis Family',
    type: 'UPDATE',
    status: 'COMPLETED',
    priority: 'LOW',
    familyId: 'F005',
    familyName: 'Davis Family',
    assignedWorkerId: 'cw_002',
    assignedWorkerName: 'David Brown',
    assignedById: 'admin_002',
    assignedByName: 'Linda Martinez',
    assignedAt: '2026-02-05T10:00:00Z',
    dueDate: '2026-02-15T23:59:59Z',
    createdAt: '2026-02-05T09:00:00Z',
    updatedAt: '2026-02-14T11:00:00Z',
    completedAt: '2026-02-14T11:00:00Z',
  },
  // Sarah Williams's cases
  {
    id: 'case_006',
    caseNumber: 'CS-2026-0006',
    title: 'NHF Enrollment - Miller Family',
    type: 'ENROLLMENT',
    status: 'OPEN',
    priority: 'HIGH',
    familyId: 'F006',
    familyName: 'Miller Family',
    assignedWorkerId: 'cw_003',
    assignedWorkerName: 'Sarah Williams',
    assignedById: 'admin_001',
    assignedByName: 'James Cooper',
    assignedAt: '2026-02-17T11:00:00Z',
    dueDate: '2026-02-27T23:59:59Z',
    createdAt: '2026-02-17T10:00:00Z',
    updatedAt: '2026-02-17T11:00:00Z',
    completedAt: null,
  },
  // Unassigned cases
  {
    id: 'case_007',
    caseNumber: 'CS-2026-0007',
    title: 'New Application - Taylor Family',
    type: 'ENROLLMENT',
    status: 'OPEN',
    priority: 'MEDIUM',
    familyId: 'F007',
    familyName: 'Taylor Family',
    assignedWorkerId: null,
    assignedWorkerName: null,
    assignedById: null,
    assignedByName: null,
    assignedAt: null,
    dueDate: '2026-03-01T23:59:59Z',
    createdAt: '2026-02-18T15:00:00Z',
    updatedAt: '2026-02-18T15:00:00Z',
    completedAt: null,
  },
  {
    id: 'case_008',
    caseNumber: 'CS-2026-0008',
    title: 'Emergency Assistance - Moore Family',
    type: 'ASSESSMENT',
    status: 'OPEN',
    priority: 'URGENT',
    familyId: 'F008',
    familyName: 'Moore Family',
    assignedWorkerId: null,
    assignedWorkerName: null,
    assignedById: null,
    assignedByName: null,
    assignedAt: null,
    dueDate: '2026-02-20T23:59:59Z',
    createdAt: '2026-02-19T08:00:00Z',
    updatedAt: '2026-02-19T08:00:00Z',
    completedAt: null,
  },
]

export const caseAssignments: CaseAssignment[] = [
  {
    id: 'assign_001',
    caseId: 'case_001',
    workerId: 'cw_001',
    workerName: 'Maria Thompson',
    assignedById: 'admin_001',
    assignedByName: 'James Cooper',
    assignedAt: '2026-02-15T10:00:00Z',
    unassignedAt: null,
    status: 'ACTIVE',
  },
  {
    id: 'assign_002',
    caseId: 'case_002',
    workerId: 'cw_001',
    workerName: 'Maria Thompson',
    assignedById: 'admin_002',
    assignedByName: 'Linda Martinez',
    assignedAt: '2026-02-10T08:00:00Z',
    unassignedAt: null,
    status: 'ACTIVE',
  },
  {
    id: 'assign_003',
    caseId: 'case_003',
    workerId: 'cw_001',
    workerName: 'Maria Thompson',
    assignedById: 'admin_001',
    assignedByName: 'James Cooper',
    assignedAt: '2026-02-18T14:00:00Z',
    unassignedAt: null,
    status: 'ACTIVE',
  },
]

// ════════════════════════════════════════════════════════════════════════════
// CASE WORKER HELPER FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Get case worker by ID
 */
export function getCaseWorkerById(workerId: string): CaseWorker | null {
  return caseWorkers.find(w => w.id === workerId) || null
}

/**
 * Get cases assigned to a worker
 */
export function getCasesByWorkerId(workerId: string): Case[] {
  return cases.filter(c => c.assignedWorkerId === workerId)
}

/**
 * Get case worker stats
 */
export function getCaseWorkerStats(workerId: string): CaseWorkerStats {
  const workerCases = getCasesByWorkerId(workerId)
  const now = new Date()
  
  const completed = workerCases.filter(c => c.status === 'COMPLETED' || c.status === 'CLOSED').length
  const pending = workerCases.filter(c => c.status !== 'COMPLETED' && c.status !== 'CLOSED').length
  const overdue = workerCases.filter(c => {
    if (c.status === 'COMPLETED' || c.status === 'CLOSED') return false
    if (!c.dueDate) return false
    return new Date(c.dueDate) < now
  }).length
  
  // Calculate assigned-by breakdown
  const assignedByMap = new Map<string, { name: string; count: number }>()
  for (const c of workerCases) {
    if (c.assignedById && c.assignedByName) {
      const existing = assignedByMap.get(c.assignedById)
      if (existing) {
        existing.count++
      } else {
        assignedByMap.set(c.assignedById, { name: c.assignedByName, count: 1 })
      }
    }
  }
  
  const assignedByBreakdown = Array.from(assignedByMap.entries()).map(([assignerId, data]) => ({
    assignerId,
    assignerName: data.name,
    count: data.count,
  }))
  
  return {
    totalAssigned: workerCases.length,
    completed,
    pending,
    overdue,
    assignedByBreakdown,
  }
}

/**
 * Get unassigned cases
 */
export function getUnassignedCases(): Case[] {
  return cases.filter(c => !c.assignedWorkerId)
}

/**
 * Assign case to worker (mock)
 */
export function assignCaseToWorker(
  caseId: string,
  workerId: string,
  assignedById: string,
  assignedByName: string
): Case | null {
  const caseIndex = cases.findIndex(c => c.id === caseId)
  if (caseIndex === -1) return null
  
  const worker = getCaseWorkerById(workerId)
  if (!worker) return null
  
  const now = new Date().toISOString()
  
  // Update case
  cases[caseIndex] = {
    ...cases[caseIndex],
    assignedWorkerId: workerId,
    assignedWorkerName: worker.name,
    assignedById,
    assignedByName,
    assignedAt: now,
    updatedAt: now,
  }
  
  // Add assignment record
  caseAssignments.push({
    id: `assign_${Date.now()}`,
    caseId,
    workerId,
    workerName: worker.name,
    assignedById,
    assignedByName,
    assignedAt: now,
    unassignedAt: null,
    status: 'ACTIVE',
  })
  
  return cases[caseIndex]
}
