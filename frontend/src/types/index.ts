// ═══════════════════════════════════════════════════════════════════════════
// FAMILY MODULE - CORE TYPES
// Social Protection Information System (SPIS)
// ═══════════════════════════════════════════════════════════════════════════

// ────────────────────────────────────────────────────────────────────────────
// ENUMS
// ────────────────────────────────────────────────────────────────────────────

export enum RegistrationStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SUSPENDED = 'SUSPENDED',
}

export enum MemberStatus {
  ALIVE = 'ALIVE',
  DECEASED = 'DECEASED',
}

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

export enum RelationshipType {
  SELF = 'SELF',
  SPOUSE = 'SPOUSE',
  SON = 'SON',
  DAUGHTER = 'DAUGHTER',
  FATHER = 'FATHER',
  MOTHER = 'MOTHER',
  SIBLING = 'SIBLING',
  GRANDPARENT = 'GRANDPARENT',
  GRANDCHILD = 'GRANDCHILD',
  OTHER = 'OTHER',
}

export enum DocumentType {
  NATIONAL_ID = 'NATIONAL_ID',
  BIRTH_CERTIFICATE = 'BIRTH_CERTIFICATE',
  PROOF_OF_ADDRESS = 'PROOF_OF_ADDRESS',
  INCOME_STATEMENT = 'INCOME_STATEMENT',
  MARRIAGE_CERTIFICATE = 'MARRIAGE_CERTIFICATE',
  DEATH_CERTIFICATE = 'DEATH_CERTIFICATE',
  OTHER = 'OTHER',
}

export enum DocumentStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

export enum BiometricType {
  FINGERPRINT = 'FINGERPRINT',
  FACE = 'FACE',
  IRIS = 'IRIS',
}

export enum UserRole {
  CITIZEN = 'CITIZEN',
  CASE_WORKER = 'CASE_WORKER',
  PROGRAMME_MANAGER = 'PROGRAMME_MANAGER',
  ADMINISTRATOR = 'ADMINISTRATOR',
}

// ────────────────────────────────────────────────────────────────────────────
// CORE ENTITIES
// ────────────────────────────────────────────────────────────────────────────

export interface Family {
  id: string
  family_code: string
  registration_status: RegistrationStatus
  head_member_id: string | null
  vulnerability_score: number | null
  priority_level: string | null
  created_at: string
  updated_at: string
  submitted_at: string | null
}

export interface FamilyMember {
  id: string
  family_id: string
  first_name: string
  last_name: string
  date_of_birth: string
  gender: Gender
  relationship_to_head: RelationshipType
  national_id: string | null
  phone_number: string | null
  email: string | null
  status: MemberStatus
  is_head: boolean
  created_at: string
  updated_at: string
}

export interface Address {
  id: string
  family_id: string
  address_line_1: string
  address_line_2: string | null
  city: string
  district: string
  province: string
  postal_code: string | null
  country: string
  latitude: number | null
  longitude: number | null
  is_primary: boolean
  created_at: string
  updated_at: string
}

export interface Document {
  id: string
  family_id: string | null
  member_id: string | null
  document_type: DocumentType
  file_name: string
  file_url: string
  file_size: number
  mime_type: string
  uploaded_at: string
  expires_at: string | null
}

export interface DocumentVerification {
  id: string
  document_id: string
  status: DocumentStatus
  verified_by: string | null
  verified_at: string | null
  rejection_reason: string | null
  created_at: string
  updated_at: string
}

export interface BiometricMetadata {
  id: string
  member_id: string
  biometric_type: BiometricType
  enrollment_status: 'PENDING' | 'ENROLLED' | 'FAILED'
  enrolled_at: string | null
  device_id: string | null
  quality_score: number | null
  created_at: string
  updated_at: string
}

export interface AccountDetails {
  id: string
  member_id: string
  bank_name: string
  account_number: string
  account_holder_name: string
  branch_code: string | null
  is_verified: boolean
  created_at: string
  updated_at: string
}

export interface IdentityMatch {
  id: string
  source_member_id: string
  matched_member_id: string
  match_score: number
  match_type: string
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED'
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

export interface FamilyHistory {
  id: string
  family_id: string
  action: string
  field_name: string | null
  old_value: string | null
  new_value: string | null
  performed_by: string
  performed_at: string
  ip_address: string | null
  user_agent: string | null
}

export interface FamilyEventOutbox {
  id: string
  family_id: string
  event_type: string
  event_payload: Record<string, unknown>
  status: 'PENDING' | 'PROCESSED' | 'FAILED'
  retry_count: number
  created_at: string
  processed_at: string | null
}

// ────────────────────────────────────────────────────────────────────────────
// AUTH CONTEXT
// ────────────────────────────────────────────────────────────────────────────

export interface AuthUser {
  user_id: string
  member_id: string | null
  family_id: string | null
  role: UserRole
  email: string
  name: string
  avatar_url: string | null
}

// ────────────────────────────────────────────────────────────────────────────
// PUBLIC NOTICES
// ────────────────────────────────────────────────────────────────────────────

export enum NoticeCategory {
  GOVERNMENT = 'GOVERNMENT',
  PROGRAMME = 'PROGRAMME',
  EMERGENCY = 'EMERGENCY',
  GENERAL = 'GENERAL',
}

export interface PublicNotice {
  id: string
  title: string
  summary: string
  content: string
  category: NoticeCategory
  is_pinned: boolean
  published_at: string
  expires_at: string | null
  attachments: NoticeAttachment[]
}

export interface NoticeAttachment {
  id: string
  notice_id: string
  file_name: string
  file_url: string
  file_size: number
}

// ────────────────────────────────────────────────────────────────────────────
// PROGRAMMES (PLACEHOLDER)
// ────────────────────────────────────────────────────────────────────────────

export enum ProgrammeStatus {
  ELIGIBLE = 'ELIGIBLE',
  APPROVED = 'APPROVED',
  IN_PROGRESS = 'IN_PROGRESS',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
}

export interface Programme {
  id: string
  name: string
  description: string
  icon: string
  status: ProgrammeStatus
  enrolled_members: string[]
  effective_from: string | null
  effective_to: string | null
}

// ────────────────────────────────────────────────────────────────────────────
// BENEFITS (PLACEHOLDER)
// ────────────────────────────────────────────────────────────────────────────

export enum BenefitType {
  CASH = 'CASH',
  IN_KIND = 'IN_KIND',
  VOUCHER = 'VOUCHER',
}

export enum BenefitStatus {
  ISSUED = 'ISSUED',
  PENDING = 'PENDING',
  FAILED = 'FAILED',
}

export interface Benefit {
  id: string
  programme_name: string
  beneficiary_name: string
  type: BenefitType
  amount: number | null
  item_description: string | null
  status: BenefitStatus
  issued_at: string | null
  failure_reason: string | null
}

// ────────────────────────────────────────────────────────────────────────────
// GRIEVANCES (PLACEHOLDER)
// ────────────────────────────────────────────────────────────────────────────

export enum GrievanceStatus {
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export enum GrievanceType {
  REJECTION_APPEAL = 'REJECTION_APPEAL',
  PAYMENT_DELAY = 'PAYMENT_DELAY',
  INCORRECT_DETAILS = 'INCORRECT_DETAILS',
  ELIGIBILITY_REVIEW = 'ELIGIBILITY_REVIEW',
  OTHER = 'OTHER',
}

export interface Grievance {
  id: string
  grievance_code: string
  programme_name: string
  type: GrievanceType
  reason: string
  supporting_remarks: string | null
  status: GrievanceStatus
  submitted_at: string
  resolved_at: string | null
  resolution_notes: string | null
}

// ────────────────────────────────────────────────────────────────────────────
// API RESPONSE TYPES
// ────────────────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

export interface ApiError {
  success: false
  error: {
    code: string
    message: string
    details?: Record<string, string[]>
  }
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// ────────────────────────────────────────────────────────────────────────────
// REGISTRATION DTOs
// ────────────────────────────────────────────────────────────────────────────

export interface CreateFamilyDraftRequest {
  head_member: {
    first_name: string
    last_name: string
    date_of_birth: string
    gender: Gender
    national_id?: string
    phone_number?: string
    email?: string
  }
}

export interface AddFamilyMemberRequest {
  family_id: string
  first_name: string
  last_name: string
  date_of_birth: string
  gender: Gender
  relationship_to_head: RelationshipType
  national_id?: string
  phone_number?: string
  email?: string
}

export interface UpdateAddressRequest {
  family_id: string
  address_line_1: string
  address_line_2?: string
  city: string
  district: string
  province: string
  postal_code?: string
  country: string
}

export interface SubmitFamilyRegistrationRequest {
  family_id: string
  declaration_accepted: boolean
}

// ────────────────────────────────────────────────────────────────────────────
// DASHBOARD SUMMARY
// ────────────────────────────────────────────────────────────────────────────

export interface DashboardSummary {
  family_id: string
  family_code: string
  registration_status: RegistrationStatus
  member_count: number
  active_programmes: number
  total_benefits_received: number
  open_grievances: number
  pending_documents: number
  last_login: string
  notifications: Notification[]
}

export interface Notification {
  id: string
  type: 'success' | 'warning' | 'info' | 'error'
  title: string
  message: string
  read: boolean
  created_at: string
}
