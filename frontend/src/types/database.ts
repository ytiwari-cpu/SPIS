// ═══════════════════════════════════════════════════════════════════════════
// DATABASE TYPES - ACTUAL SCHEMA FROM SUPABASE 'family' SCHEMA
// Social Protection Information System (SPIS)
// Generated from actual database tables
// ═══════════════════════════════════════════════════════════════════════════

// ────────────────────────────────────────────────────────────────────────────
// ADDRESS TABLE
// ────────────────────────────────────────────────────────────────────────────
export type AddressType = 'permanent' | 'current' | 'mailing' | 'PERMANENT' | 'CURRENT' | 'MAILING'
export type AreaType = 'URBAN' | 'PERI_URBAN' | 'RURAL'

export interface DbAddress {
  address_id: string
  address_type: AddressType | null
  entity_type: 'FAMILY' | 'MEMBER' | null
  entity_id: string | null
  line1: string | null
  line2: string | null
  parish: string | null
  district: string | null
  geo_code: string | null
  // Migration 010: Extended address fields
  lot_apt: string | null
  street_district: string | null
  post_office: string | null
  post_code: string | null
  area_type: AreaType | null
  valid_from: string | null
  valid_to: string | null
}

export type AddressInsert = Partial<Omit<DbAddress, 'address_id'>>

// ────────────────────────────────────────────────────────────────────────────
// FAMILY TABLE
// Post-migration 006: uuid is internal, family_id is human-readable (F123)
// ────────────────────────────────────────────────────────────────────────────
export type FamilyStatus = 'active' | 'inactive' | 'suspended' | 'archived'
export type RegistrationStatus = 'draft' | 'pending_verification' | 'verified' | 'rejected' | 'DRAFT' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED'
export type IntakeChannel = 'field_registration' | 'web_portal' | 'mobile_app' | 'bulk_import' | 'migration'
export type Programme = 'PATH' | 'STEP' | 'SSP' | 'OTHER'
export type PaymentOption = 'DIRECT_DEPOSIT' | 'CHEQUE' | 'CASH' | 'MOBILE_MONEY'

export interface DbFamily {
  uuid: string
  family_id: string
  permanent_address_id: string
  head_member_id: string | null
  household_size: number | null
  geo_code: string | null
  vulnerability_flag: boolean | null
  status: FamilyStatus | null
  intake_channel: IntakeChannel | null
  registration_status: RegistrationStatus | null
  submitted_at: string | null
  verified_at: string | null
  head_first_name: string | null
  head_last_name: string | null
  head_national_id: string | null
  phone: string | null
  email: string | null
  // Migration 010: Extended family fields
  programme: Programme | null
  payment_option: PaymentOption | null
  social_worker_zone: string | null
  social_worker_code: string | null
  application_no: string | null
  constituency_code: string | null
  head_middle_names: string | null
  head_alias: string | null
  head_mothers_maiden_name: string | null
  mailing_address_different: boolean | null
  directions_to_house: string | null
  created_at: string
  updated_at: string | null
}

export type FamilyInsert = Omit<DbFamily, 'uuid' | 'family_id' | 'created_at' | 'updated_at'>

// ────────────────────────────────────────────────────────────────────────────
// FAMILY MEMBER TABLE
// Post-migration 006: uuid is internal, member_id is human-readable (F123M001)
// ────────────────────────────────────────────────────────────────────────────
export type Gender = 'male' | 'female' | 'other' | 'MALE' | 'FEMALE' | 'OTHER'
export type RelationshipToHead = 'head' | 'spouse' | 'child' | 'parent' | 'sibling' | 'grandparent' | 'grandchild' | 'other'
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed' | 'separated'
export type UnionStatus = 'MARRIED' | 'COMMON_LAW' | 'VISITING' | 'SINGLE' | 'DIVORCED' | 'WIDOWED' | 'SEPARATED'
export type IdType = 'NATIONAL_ID' | 'PASSPORT' | 'DRIVERS_LICENSE' | 'VOTERS_ID' | 'BIRTH_CERTIFICATE' | 'OTHER'
export type LastSchoolCompleted = 'NONE' | 'PRIMARY' | 'SECONDARY' | 'TERTIARY' | 'VOCATIONAL' | 'UNIVERSITY' | 'POST_GRADUATE'
export type PregnantStatus = 'YES' | 'NO' | 'NOT_APPLICABLE'

export interface DbFamilyMember {
  uuid: string
  member_id: string
  family_uuid: string
  national_id: string | null
  first_name: string | null
  last_name: string | null
  date_of_birth: string | null
  gender: Gender | null
  relationship_to_head: RelationshipToHead | null
  current_address_id: string | null
  alive_flag: boolean | null
  marital_status: MaritalStatus | null
  phone: string | null
  email: string | null
  member_status: string | null
  annual_income: number | null
  // Migration 010: Extended member fields
  middle_names: string | null
  alias: string | null
  trn: string | null
  nis_no: string | null
  id_type: IdType | null
  id_number: string | null
  birth_entry_number: string | null
  mothers_maiden_name: string | null
  is_twin: boolean | null
  order_number: number | null
  occupation: string | null
  contact_no_1: string | null
  contact_no_2: string | null
  union_status: UnionStatus | null
  last_school_completed: LastSchoolCompleted | null
  school_name: string | null
  school_parish: string | null
  school_attended_since: string | null
  pregnant: PregnantStatus | null
  pregnancy_due_date: string | null
  health_condition_disability: boolean | null
  health_visual_impairment: boolean | null
  health_hiv_aids: boolean | null
  health_other: boolean | null
  health_other_specify: string | null
  pension_number: string | null
  clinic_name: string | null
  clinic_parish: string | null
  clinic_number: string | null
  reg_doc_birth_certificate: boolean | null
  reg_doc_id: boolean | null
  reg_doc_other: boolean | null
  reg_doc_other_specify: string | null
  sex_code: string | null
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
export type DocumentStatus = 'uploaded' | 'pending' | 'verified' | 'rejected'

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
// HOUSE SERVICES TABLE (Migration 010 - Section 3 of Jamaica Form)
// ────────────────────────────────────────────────────────────────────────────
export type DwellingTenure = 'OWNED' | 'RENTED' | 'LEASED' | 'SQUATTING' | 'RENT_FREE' | 'OTHER'

export interface DbHouseServices {
  id: string
  family_uuid: string
  dwelling_tenure: DwellingTenure | null
  utilities_electricity: boolean
  utilities_gas: boolean
  utilities_telephone: boolean
  water_piped_internal: boolean
  water_piped_external: boolean
  water_tank: boolean
  water_river_spring: boolean
  sanitation_wc_sewage: boolean
  sanitation_wc_septic: boolean
  sanitation_pit_latrine: boolean
  sanitation_other: boolean
  has_refrigerator: boolean
  has_living_room_set: boolean
  has_dining_room_set: boolean
  has_washing_machine: boolean
  has_stove_gas: boolean
  has_stove_electric: boolean
  has_stove_kerosene: boolean
  has_tv: boolean
  has_radio: boolean
  has_stereo: boolean
  has_computer: boolean
  has_cable_tv: boolean
  has_dvd_player: boolean
  has_bed: boolean
  has_motor_vehicle: boolean
  has_motorcycle: boolean
  has_bicycle: boolean
  has_cellphone: boolean
  has_sewing_machine: boolean
  weekly_family_spending: number | null
  monthly_rent: number | null
  total_income: number | null
  number_of_rooms: number | null
  number_of_bedrooms: number | null
  created_at: string
  updated_at: string | null
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
  familyUUID?: string                             // Internal UUID for API routing (absent for users without family)
  family_id?: string                        // Human-readable ID for display (F123)
  status?: FamilyStatus | null
  registration_status?: RegistrationStatus | null
  household_size?: number | null
  created_at?: string
  auth_mode: 'production' | 'iam_national_id'
  national_id?: string
  access_token?: string
  refresh_token?: string
  token_type?: string
  expires_in?: number
  roles?: string[]
  permissions?: string[]
  user_id?: string
  email?: string
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
  lot_apt?: string
  street_district?: string
  post_office?: string
  post_code?: string
  area_type?: AreaType
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
  phone?: string
  email?: string
  // Migration 010: Extended fields
  middle_names?: string
  alias?: string
  trn?: string
  nis_no?: string
  id_type?: IdType
  id_number?: string
  birth_entry_number?: string
  mothers_maiden_name?: string
  is_twin?: boolean
  order_number?: number
  occupation?: string
  contact_no_1?: string
  contact_no_2?: string
  union_status?: UnionStatus
  last_school_completed?: LastSchoolCompleted
  school_name?: string
  school_parish?: string
  school_attended_since?: string
  pregnant?: PregnantStatus
  pregnancy_due_date?: string
  health_condition_disability?: boolean
  health_visual_impairment?: boolean
  health_hiv_aids?: boolean
  health_other?: boolean
  health_other_specify?: string
  pension_number?: string
  clinic_name?: string
  clinic_parish?: string
  clinic_number?: string
  reg_doc_birth_certificate?: boolean
  reg_doc_id?: boolean
  reg_doc_other?: boolean
  reg_doc_other_specify?: string
  sex_code?: string
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
