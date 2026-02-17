/**
 * SPIS Family Module - Database Types
 * Exact 1-to-1 mapping with PostgreSQL schema in family schema
 */

// ============ ENUMS (matching database CHECK constraints) ============

export type FamilyStatus = 'active' | 'inactive' | 'suspended' | 'archived'
export type RegistrationStatus = 'draft' | 'pending_verification' | 'verified' | 'rejected'
export type IntakeChannel = 'field_registration' | 'web_portal' | 'mobile_app' | 'bulk_import' | 'migration'
export type Gender = 'male' | 'female' | 'other'
export type RelationshipToHead = 'head' | 'spouse' | 'child' | 'parent' | 'sibling' | 'grandparent' | 'grandchild' | 'other'
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed' | 'separated'
export type DocumentType = 'national_id' | 'birth_certificate' | 'marriage_certificate' | 'death_certificate' | 'proof_of_address' | 'income_statement' | 'photo' | 'other'
export type DocumentStatus = 'pending' | 'verified' | 'rejected'
export type BiometricType = 'fingerprint' | 'face' | 'iris'
export type AccountType = 'bank' | 'mobile_money' | 'cooperative'
export type HistoryAction = 'create' | 'update' | 'delete' | 'submit' | 'verify' | 'reject'
export type EventStatus = 'pending' | 'published' | 'failed'

// ============ DATABASE TABLE TYPES (exact column mapping) ============

/**
 * family table - Core family record
 */
export interface Family {
  uuid: string // UUID, Primary Key
  family_id: string // UNIQUE, auto-generated code (e.g., F123)
  permanent_address_id: string | null // FK to address
  household_size: number // Default 1
  geo_code: string | null
  vulnerability_flag: boolean // Default false
  status: FamilyStatus // Default 'active'
  intake_channel: IntakeChannel | null
  registration_status: RegistrationStatus // Default 'draft'
  submitted_at: string | null // TIMESTAMPTZ
  verified_at: string | null // TIMESTAMPTZ
  created_at: string // TIMESTAMPTZ
  updated_at: string // TIMESTAMPTZ
}

/**
 * family_member table - Individual member within family
 */
export interface FamilyMember {
  uuid: string // UUID, Primary Key
  member_id: string // UNIQUE, auto-generated code (e.g., F123M01)
  family_uuid: string // FK to family
  national_id: string | null // UNIQUE
  first_name: string // Required
  last_name: string // Required
  date_of_birth: string | null // DATE
  gender: Gender | null
  relationship_to_head: RelationshipToHead // Default 'other'
  current_address_id: string | null // FK to address
  alive_flag: boolean // Default true
  marital_status: MaritalStatus | null
  created_at: string // TIMESTAMPTZ
  updated_at: string // TIMESTAMPTZ
}

/**
 * address table - Physical address (shared, not family-specific)
 */
export interface Address {
  address_id: string // UUID, Primary Key
  line1: string // Required
  line2: string | null
  city: string | null
  region: string | null
  postal_code: string | null
  country: string // Default 'Tanzania'
  latitude: number | null // DECIMAL(10,8)
  longitude: number | null // DECIMAL(11,8)
  created_at: string // TIMESTAMPTZ
  updated_at: string // TIMESTAMPTZ
}

/**
 * documents table - Uploaded documents
 */
export interface Document {
  document_id: string // UUID, Primary Key
  family_id: string | null // FK to family
  member_id: string | null // FK to family_member
  document_type: DocumentType // Required
  file_path: string // Required
  file_name: string // Required
  mime_type: string | null
  file_size_bytes: number | null
  uploaded_by: string | null
  created_at: string // TIMESTAMPTZ
}

/**
 * document_verification table - Verification status of documents
 */
export interface DocumentVerification {
  verification_id: string // UUID, Primary Key
  document_id: string // FK to documents
  status: DocumentStatus // Default 'pending'
  verified_by: string | null
  verified_at: string | null // TIMESTAMPTZ
  rejection_reason: string | null
  created_at: string // TIMESTAMPTZ
  updated_at: string // TIMESTAMPTZ
}

/**
 * biometric_metadata table - Biometric capture metadata
 */
export interface BiometricMetadata {
  biometric_id: string // UUID, Primary Key
  member_id: string // FK to family_member
  biometric_type: BiometricType // Required
  external_reference_id: string // External system reference
  captured_at: string // TIMESTAMPTZ
  captured_by: string | null
  quality_score: number | null // 0-100
  is_active: boolean // Default true
  created_at: string // TIMESTAMPTZ
}

/**
 * account_details table - Payment/banking details
 */
export interface AccountDetails {
  account_id: string // UUID, Primary Key
  member_id: string // FK to family_member
  account_type: AccountType // Default 'bank'
  provider_name: string | null
  account_number: string // Required
  account_holder_name: string // Required
  is_verified: boolean // Default false
  verified_at: string | null // TIMESTAMPTZ
  is_primary: boolean // Default false
  created_at: string // TIMESTAMPTZ
  updated_at: string // TIMESTAMPTZ
}

/**
 * identity_match table - External identity matching results
 */
export interface IdentityMatch {
  match_id: string // UUID, Primary Key
  member_id: string // FK to family_member
  external_system: string // Required
  external_id: string // Required
  match_confidence: number // DECIMAL(5,4), 0-1
  matched_at: string // TIMESTAMPTZ
  matched_by: string | null
  is_confirmed: boolean // Default false
  created_at: string // TIMESTAMPTZ
}

/**
 * family_history table - Audit log for all changes
 */
export interface FamilyHistory {
  history_id: string // UUID, Primary Key
  family_id: string // FK to family
  action_type: HistoryAction // Required
  changed_by: string | null
  old_values: Record<string, unknown> | null // JSONB
  new_values: Record<string, unknown> | null // JSONB
  change_reason: string | null
  created_at: string // TIMESTAMPTZ
}

/**
 * family_event_outbox table - Event publishing outbox pattern
 */
export interface FamilyEventOutbox {
  event_id: string // UUID, Primary Key
  event_type: string // Required
  aggregate_type: string // Required
  aggregate_id: string // Required
  payload: Record<string, unknown> // JSONB
  status: EventStatus // Default 'pending'
  created_at: string // TIMESTAMPTZ
  published_at: string | null // TIMESTAMPTZ
  error_message: string | null
}

// ============ API REQUEST/RESPONSE TYPES ============

export interface CreateFamilyRequest {
  head_member: {
    national_id?: string
    first_name: string
    last_name: string
    date_of_birth?: string
    gender?: Gender
    marital_status?: MaritalStatus
  }
  address?: {
    line1: string
    line2?: string
    city?: string
    region?: string
    postal_code?: string
    country?: string
    latitude?: number
    longitude?: number
  }
  household_size?: number
  geo_code?: string
  vulnerability_flag?: boolean
  intake_channel?: IntakeChannel
}

export interface UpdateFamilyRequest {
  household_size?: number
  geo_code?: string
  vulnerability_flag?: boolean
  status?: FamilyStatus
  registration_status?: RegistrationStatus
}

export interface CreateMemberRequest {
  family_uuid: string
  national_id?: string
  first_name: string
  last_name: string
  date_of_birth?: string
  gender?: Gender
  relationship_to_head: RelationshipToHead
  current_address_id?: string
  alive_flag?: boolean
  marital_status?: MaritalStatus
  phone?: string
  email?: string
}

export interface UpdateMemberRequest {
  national_id?: string
  first_name?: string
  last_name?: string
  date_of_birth?: string
  gender?: Gender
  relationship_to_head?: RelationshipToHead
  current_address_id?: string
  alive_flag?: boolean
  marital_status?: MaritalStatus
  phone?: string
  email?: string
}

export interface CreateAddressRequest {
  line1: string
  line2?: string
  city?: string
  region?: string
  postal_code?: string
  country?: string
  latitude?: number
  longitude?: number
}

export interface UpdateAddressRequest {
  line1?: string
  line2?: string
  city?: string
  region?: string
  postal_code?: string
  country?: string
  latitude?: number
  longitude?: number
}

export interface CreateDocumentRequest {
  family_id?: string
  member_id?: string
  document_type: DocumentType
  file_path: string
  file_name: string
  mime_type?: string
  file_size_bytes?: number
  uploaded_by?: string
}

export interface VerifyDocumentRequest {
  status: DocumentStatus
  verified_by: string
  rejection_reason?: string
}
