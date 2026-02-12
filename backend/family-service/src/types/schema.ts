/**
 * SPIS Family Module - Actual Database Schema Types
 * Generated from family schema in Supabase
 * 
 * Tables: family, family_member, address, documents, account_details,
 *         biometric_metadata, identity_match, family_history, family_event_outbox
 */

// ═══════════════════════════════════════════════════════════════
// ADDRESS TABLE
// ═══════════════════════════════════════════════════════════════
export interface DbAddress {
  address_id: string
  address_type: string | null  // 'permanent', 'current', etc.
  line1: string | null
  line2: string | null
  parish: string | null        // Note: not 'city' but 'parish'
  district: string | null      // Note: not 'region' but 'district'
  geo_code: string | null
  valid_from: string | null
  valid_to: string | null
}

export type AddressInsert = Omit<DbAddress, 'address_id'>
export type AddressUpdate = Partial<AddressInsert>

// ═══════════════════════════════════════════════════════════════
// FAMILY TABLE
// ═══════════════════════════════════════════════════════════════
// Post-migration 006: uuid is the internal UUID, family_id is human-readable (F123)
export interface DbFamily {
  uuid: string                              // Internal UUID (was family_id)
  family_id: string                         // Human-readable ID: F123 (was family_code)
  permanent_address_id: string              // Required!
  head_member_id: string | null
  household_size: number | null
  geo_code: string | null
  vulnerability_flag: boolean | null
  status: string | null                     // 'active', 'inactive', etc.
  intake_channel: string | null             // 'field_registration', 'web_portal', etc.
  registration_status: string | null        // 'draft', 'pending_verification', 'verified', 'rejected'
  submitted_at: string | null
  verified_at: string | null
  created_at: string
  updated_at: string | null
}

export type FamilyInsert = Omit<DbFamily, 'uuid' | 'family_id' | 'created_at' | 'updated_at'>
export type FamilyUpdate = Partial<Omit<FamilyInsert, 'permanent_address_id'>>

// ═══════════════════════════════════════════════════════════════
// FAMILY_MEMBER TABLE
// ═══════════════════════════════════════════════════════════════
// Post-migration 006: uuid is the internal UUID, member_id is human-readable (F123M001)
export interface DbFamilyMember {
  uuid: string                              // Internal UUID (was member_id)
  member_id: string                         // Human-readable ID: F123M001 (was member_code)
  family_uuid: string                       // FK to family.uuid (was family_id)
  national_id: string | null
  first_name: string | null
  last_name: string | null
  date_of_birth: string | null
  gender: string | null                     // 'male', 'female', 'other'
  relationship_to_head: string | null       // 'head', 'spouse', 'child', etc.
  current_address_id: string | null
  alive_flag: boolean | null
  marital_status: string | null             // 'single', 'married', 'divorced', etc.
  created_at: string
  updated_at: string | null
}

export type FamilyMemberInsert = Omit<DbFamilyMember, 'uuid' | 'member_id' | 'created_at' | 'updated_at'>
export type FamilyMemberUpdate = Partial<Omit<FamilyMemberInsert, 'family_uuid'>>

// ═══════════════════════════════════════════════════════════════
// DOCUMENTS TABLE
// Note: Different structure - uses owner_type/owner_id instead of family_id/member_id
// ═══════════════════════════════════════════════════════════════
export interface DbDocument {
  document_id: string
  owner_type: string | null          // 'family', 'member', etc.
  owner_id: string | null            // family_id or member_id
  document_type: string | null       // 'national_id', 'birth_certificate', etc.
  document_number: string | null
  file_url: string | null
  status: string | null              // 'pending', 'verified', 'rejected'
  uploaded_at: string | null
  uploaded_by: string | null
}

export type DocumentInsert = Omit<DbDocument, 'document_id'>
export type DocumentUpdate = Partial<DocumentInsert>

// ═══════════════════════════════════════════════════════════════
// ACCOUNT_DETAILS TABLE
// ═══════════════════════════════════════════════════════════════
export interface DbAccountDetails {
  account_id: string
  owner_type: string | null          // 'family', 'member', etc.
  owner_id: string | null            // family_id or member_id
  account_type: string | null        // 'bank', 'mobile_money', etc.
  masked_account_no: string | null
  verification_status: string | null // 'pending', 'verified', 'failed'
  created_at: string
}

export type AccountDetailsInsert = Omit<DbAccountDetails, 'account_id' | 'created_at'>
export type AccountDetailsUpdate = Partial<AccountDetailsInsert>

// ═══════════════════════════════════════════════════════════════
// BIOMETRIC_METADATA TABLE
// ═══════════════════════════════════════════════════════════════
export interface DbBiometricMetadata {
  biometric_id: string
  member_id: string | null
  biometric_type: string | null          // 'fingerprint', 'face', 'iris'
  external_reference_id: string | null   // Reference to external biometric system
  enrollment_status: string | null       // 'pending', 'enrolled', 'failed'
  enrolled_at: string | null
  last_verified_at: string | null
}

export type BiometricMetadataInsert = Omit<DbBiometricMetadata, 'biometric_id'>
export type BiometricMetadataUpdate = Partial<BiometricMetadataInsert>

// ═══════════════════════════════════════════════════════════════
// IDENTITY_MATCH TABLE
// ═══════════════════════════════════════════════════════════════
export interface DbIdentityMatch {
  match_id: string
  primary_member_id: string | null
  duplicate_member_id: string | null
  match_score: number | null
  match_status: string | null            // 'pending_review', 'confirmed_duplicate', 'false_positive'
  reviewed_by: string | null
  reviewed_at: string | null
}

export type IdentityMatchInsert = Omit<DbIdentityMatch, 'match_id'>
export type IdentityMatchUpdate = Partial<IdentityMatchInsert>

// ═══════════════════════════════════════════════════════════════
// FAMILY_HISTORY TABLE (Audit Log)
// ═══════════════════════════════════════════════════════════════
export interface DbFamilyHistory {
  history_id: string
  entity_type: string | null             // 'family', 'member', 'address', etc.
  entity_id: string | null
  change_type: string | null             // 'create', 'update', 'delete'
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  changed_by: string | null
  changed_at: string
}

export type FamilyHistoryInsert = Omit<DbFamilyHistory, 'history_id' | 'changed_at'>

// ═══════════════════════════════════════════════════════════════
// FAMILY_EVENT_OUTBOX TABLE (Event Sourcing)
// ═══════════════════════════════════════════════════════════════
export interface DbFamilyEventOutbox {
  event_id: string
  event_type: string | null              // 'family.created', 'member.added', etc.
  payload: Record<string, unknown> | null
  published: boolean
  created_at: string
}

export type FamilyEventOutboxInsert = Omit<DbFamilyEventOutbox, 'event_id' | 'created_at'>

// ═══════════════════════════════════════════════════════════════
// ENUMS / Constants
// ═══════════════════════════════════════════════════════════════
export const Gender = ['male', 'female', 'other'] as const
export type GenderType = typeof Gender[number]

export const RelationshipToHead = ['head', 'spouse', 'child', 'parent', 'sibling', 'grandparent', 'grandchild', 'other'] as const
export type RelationshipToHeadType = typeof RelationshipToHead[number]

export const MaritalStatus = ['single', 'married', 'divorced', 'widowed', 'separated'] as const
export type MaritalStatusType = typeof MaritalStatus[number]

export const FamilyStatus = ['active', 'inactive', 'suspended', 'archived'] as const
export type FamilyStatusType = typeof FamilyStatus[number]

export const RegistrationStatus = ['draft', 'pending_verification', 'verified', 'rejected'] as const
export type RegistrationStatusType = typeof RegistrationStatus[number]

export const IntakeChannel = ['field_registration', 'web_portal', 'mobile_app', 'bulk_import', 'migration'] as const
export type IntakeChannelType = typeof IntakeChannel[number]

export const DocumentType = ['national_id', 'birth_certificate', 'marriage_certificate', 'death_certificate', 'proof_of_address', 'income_statement', 'photo', 'other'] as const
export type DocumentTypeType = typeof DocumentType[number]

export const AddressType = ['permanent', 'current', 'mailing'] as const
export type AddressTypeType = typeof AddressType[number]

export const OwnerType = ['family', 'member'] as const
export type OwnerTypeType = typeof OwnerType[number]
