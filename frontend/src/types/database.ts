// ═══════════════════════════════════════════════════════════════════════════
// DATABASE TYPES - ACTUAL SCHEMA FROM SUPABASE 'family' SCHEMA
// Social Protection Information System (SPIS)
// Generated from actual database tables
// ═══════════════════════════════════════════════════════════════════════════

// ────────────────────────────────────────────────────────────────────────────
// ADDRESS TABLE
// ────────────────────────────────────────────────────────────────────────────
export type AddressType = 'permanent' | 'current' | 'mailing'

export interface DbAddress {
  address_id: string
  address_type: AddressType | null
  line1: string | null
  line2: string | null
  parish: string | null      // Note: 'parish' not 'city'
  district: string | null    // Note: 'district' not 'region'
  geo_code: string | null
  valid_from: string | null
  valid_to: string | null
}

export type AddressInsert = Partial<Omit<DbAddress, 'address_id'>>

// ────────────────────────────────────────────────────────────────────────────
// FAMILY TABLE
// Post-migration 006: uuid is internal, family_id is human-readable (F123)
// ────────────────────────────────────────────────────────────────────────────
export type FamilyStatus = 'active' | 'inactive' | 'suspended' | 'archived'
export type RegistrationStatus = 'draft' | 'pending_verification' | 'verified' | 'rejected'
export type IntakeChannel = 'field_registration' | 'web_portal' | 'mobile_app' | 'bulk_import' | 'migration'

export interface DbFamily {
  uuid: string                               // Internal UUID (was family_id)
  family_id: string                          // Human-readable ID: F123 (was family_code)
  permanent_address_id: string               // Required!
  head_member_id: string | null
  household_size: number | null
  geo_code: string | null
  vulnerability_flag: boolean | null
  status: FamilyStatus | null
  intake_channel: IntakeChannel | null
  registration_status: RegistrationStatus | null
  submitted_at: string | null
  verified_at: string | null
  created_at: string
  updated_at: string | null
}

export type FamilyInsert = Omit<DbFamily, 'uuid' | 'family_id' | 'created_at' | 'updated_at'>

// ────────────────────────────────────────────────────────────────────────────
// FAMILY MEMBER TABLE
// Post-migration 006: uuid is internal, member_id is human-readable (F123M001)
// ────────────────────────────────────────────────────────────────────────────
export type Gender = 'male' | 'female' | 'other'
export type RelationshipToHead = 'head' | 'spouse' | 'child' | 'parent' | 'sibling' | 'grandparent' | 'grandchild' | 'other'
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed' | 'separated'

export interface DbFamilyMember {
  uuid: string                               // Internal UUID (was member_id)
  member_id: string                          // Human-readable ID: F123M001 (was member_code)
  family_uuid: string                        // FK to family.uuid (was family_id)
  national_id: string | null
  first_name: string | null
  last_name: string | null
  date_of_birth: string | null
  gender: Gender | null
  relationship_to_head: RelationshipToHead | null
  current_address_id: string | null
  alive_flag: boolean | null
  marital_status: MaritalStatus | null
  created_at: string
  updated_at: string | null
}

export type FamilyMemberInsert = Omit<DbFamilyMember, 'uuid' | 'member_id' | 'created_at' | 'updated_at'>

// ────────────────────────────────────────────────────────────────────────────
// DOCUMENTS TABLE
// Note: Uses owner_type/owner_id pattern instead of family_id/member_id
// ────────────────────────────────────────────────────────────────────────────
export type OwnerType = 'family' | 'member'
export type DocumentType = 'national_id' | 'birth_certificate' | 'marriage_certificate' | 'death_certificate' | 'proof_of_address' | 'income_statement' | 'photo' | 'other'
export type DocumentStatus = 'pending' | 'verified' | 'rejected'

export interface DbDocument {
  document_id: string
  owner_type: OwnerType | null
  owner_id: string | null           // family_id or member_id
  document_type: DocumentType | null
  document_number: string | null
  file_url: string | null
  status: DocumentStatus | null
  uploaded_at: string | null
  uploaded_by: string | null
}

export type DocumentInsert = Omit<DbDocument, 'document_id'>

// ────────────────────────────────────────────────────────────────────────────
// ACCOUNT_DETAILS TABLE
// ────────────────────────────────────────────────────────────────────────────
export type AccountType = 'bank' | 'mobile_money' | 'other'
export type VerificationStatus = 'pending' | 'verified' | 'failed'

export interface DbAccountDetails {
  account_id: string
  owner_type: OwnerType | null
  owner_id: string | null
  account_type: AccountType | null
  masked_account_no: string | null
  verification_status: VerificationStatus | null
  created_at: string
}

export type AccountDetailsInsert = Omit<DbAccountDetails, 'account_id' | 'created_at'>

// ────────────────────────────────────────────────────────────────────────────
// BIOMETRIC_METADATA TABLE
// ────────────────────────────────────────────────────────────────────────────
export type BiometricType = 'fingerprint' | 'face' | 'iris'
export type EnrollmentStatus = 'pending' | 'enrolled' | 'failed'

export interface DbBiometricMetadata {
  biometric_id: string
  member_id: string | null
  biometric_type: BiometricType | null
  external_reference_id: string | null
  enrollment_status: EnrollmentStatus | null
  enrolled_at: string | null
  last_verified_at: string | null
}

export type BiometricMetadataInsert = Omit<DbBiometricMetadata, 'biometric_id'>

// ────────────────────────────────────────────────────────────────────────────
// IDENTITY_MATCH TABLE
// ────────────────────────────────────────────────────────────────────────────
export type MatchStatus = 'pending_review' | 'confirmed_duplicate' | 'false_positive'

export interface DbIdentityMatch {
  match_id: string
  primary_member_id: string | null
  duplicate_member_id: string | null
  match_score: number | null
  match_status: MatchStatus | null
  reviewed_by: string | null
  reviewed_at: string | null
}

// ────────────────────────────────────────────────────────────────────────────
// FAMILY_HISTORY TABLE (Audit Log)
// ────────────────────────────────────────────────────────────────────────────
export type EntityType = 'family' | 'member' | 'address' | 'document'
export type ChangeType = 'create' | 'update' | 'delete'

export interface DbFamilyHistory {
  history_id: string
  entity_type: EntityType | null
  entity_id: string | null
  change_type: ChangeType | null
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  changed_by: string | null
  changed_at: string
}

// ────────────────────────────────────────────────────────────────────────────
// FAMILY_EVENT_OUTBOX TABLE (Event Sourcing)
// ────────────────────────────────────────────────────────────────────────────
export interface DbFamilyEventOutbox {
  event_id: string
  event_type: string | null
  payload: Record<string, unknown> | null
  published: boolean
  created_at: string
}

// ────────────────────────────────────────────────────────────────────────────
// API RESPONSE TYPES
// ────────────────────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    total_pages: number
  }
}

// Alias for API compatibility
export type PaginatedApiResponse<T> = PaginatedResponse<T>

// ────────────────────────────────────────────────────────────────────────────
// AUTH TYPES
// Post-migration 006: uuid for routing, family_id for display
// ────────────────────────────────────────────────────────────────────────────
export interface AuthSession {
  uuid: string                              // Internal UUID for API routing
  family_id: string                         // Human-readable ID for display (F123)
  status: FamilyStatus | null
  registration_status: RegistrationStatus | null
  household_size: number | null
  created_at: string
  auth_mode: 'dev_family_id' | 'production'
}

// For dev mode - list of families for quick login
export interface FamilyListItem {
  uuid: string                              // Internal UUID
  family_id: string                         // Human-readable ID (F123)
  status: FamilyStatus | null
  registration_status: RegistrationStatus | null
  created_at: string
}

export interface FamilyWithHead extends DbFamily {
  head_member?: DbFamilyMember | null
}

// ────────────────────────────────────────────────────────────────────────────
// FORM/INPUT TYPES (for UI)
// ────────────────────────────────────────────────────────────────────────────
export interface AddressFormData {
  address_type?: AddressType
  line1: string
  line2?: string
  parish: string
  district: string
  geo_code?: string
}

export interface MemberFormData {
  national_id?: string
  first_name: string
  last_name: string
  date_of_birth?: string
  gender?: Gender
  relationship_to_head: RelationshipToHead
  marital_status?: MaritalStatus
  alive_flag?: boolean
}

export interface FamilyRegistrationData {
  address: AddressFormData
  head_member: MemberFormData
  household_members?: MemberFormData[]
  household_size?: number
  intake_channel?: IntakeChannel
}

// ────────────────────────────────────────────────────────────────────────────
// API REQUEST TYPES
// ────────────────────────────────────────────────────────────────────────────
export type CreateFamilyRequest = FamilyInsert
export type UpdateFamilyRequest = Partial<FamilyInsert>

export type CreateMemberRequest = FamilyMemberInsert
export type UpdateMemberRequest = Partial<Omit<FamilyMemberInsert, 'family_id'>>

export type CreateAddressRequest = AddressInsert
export type UpdateAddressRequest = Partial<AddressInsert>

export type CreateDocumentRequest = DocumentInsert
export type UpdateDocumentRequest = Partial<DocumentInsert>

// ────────────────────────────────────────────────────────────────────────────
// EXTENDED TYPES (with joins/relations)
// ────────────────────────────────────────────────────────────────────────────
export interface DbFamilyWithDetails extends DbFamily {
  address?: DbAddress | null
  head_member?: DbFamilyMember | null
  members?: DbFamilyMember[]
}

export interface DbDocumentWithVerification extends DbDocument {
  verification_status?: string
  verification_notes?: string
}
