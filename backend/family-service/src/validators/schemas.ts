import { z } from 'zod'

/**
 * SPIS Family Module - Validation Schemas
 * FINAL NORMALIZATION - Matching database schema exactly
 */

// ============ CUSTOM VALIDATORS ============

// National ID: exactly 14 digits
const NationalIdSchema = z.string()
  .transform(val => val.replace(/\D/g, '')) // Strip non-digits
  .refine(val => val.length === 14, { message: 'National ID must be exactly 14 digits' })
  .optional()

// Email validation
const EmailSchema = z.string()
  .email({ message: 'Invalid email format' })
  .max(255)
  .optional()

// Phone validation (flexible - allows various formats)
const PhoneSchema = z.string()
  .min(7)
  .max(50)
  .optional()

// ============ ENUMS (matching database CHECK constraints) ============

export const FamilyStatusSchema = z.enum(['active', 'inactive', 'suspended', 'archived'])
export const RegistrationStatusSchema = z.enum(['draft', 'pending_verification', 'verified', 'rejected', 'DRAFT', 'SUBMITTED', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED'])
export const IntakeChannelSchema = z.enum(['field_registration', 'web_portal', 'mobile_app', 'bulk_import', 'migration'])
export const GenderSchema = z.enum(['male', 'female', 'other'])
export const RelationshipToHeadSchema = z.enum(['head', 'spouse', 'child', 'parent', 'sibling', 'grandparent', 'grandchild', 'other'])
export const MaritalStatusSchema = z.enum(['single', 'married', 'divorced', 'widowed', 'separated'])
export const DocumentTypeSchema = z.enum(['national_id', 'birth_certificate', 'marriage_certificate', 'death_certificate', 'proof_of_address', 'income_statement', 'photo', 'other'])
export const DocumentStatusSchema = z.enum(['pending', 'verified', 'rejected', 'UPLOADED', 'PENDING', 'VERIFIED', 'REJECTED'])

// Polymorphic types
export const EntityTypeSchema = z.enum(['FAMILY', 'MEMBER'])
export const AddressTypeSchema = z.enum(['PERMANENT', 'CURRENT', 'MAILING'])
export const OwnerTypeSchema = z.enum(['FAMILY', 'MEMBER'])

// Migration 010: New enums
export const UnionStatusSchema = z.enum(['married', 'common_law', 'divorced', 'separated', 'widowed', 'visiting', 'single', 'none'])
export const IdTypeSchema = z.enum(['drivers_license', 'passport', 'voters_id', 'senior_citizen_id', 'none'])
export const LastSchoolCompletedSchema = z.enum(['completed_primary', 'some_secondary', 'completed_secondary', 'post_secondary', 'tertiary', 'none'])
export const PregnantStatusSchema = z.enum(['yes', 'no', 'lactating'])
export const AreaTypeSchema = z.enum(['KMA', 'other_town', 'rural'])
export const DwellingTenureSchema = z.enum(['own', 'rent', 'lease', 'government_rent', 'live_rent_free', 'squat'])
export const ProgrammeSchema = z.enum(['PATH', 'other'])
export const PaymentOptionSchema = z.enum(['KCC', 'cheque'])
export const FamilyRelationshipSchema = z.enum(['head', 'spouse', 'son_daughter', 'grandchild', 'other_family', 'non_family'])

// ============ MEMBER SCHEMAS ============

export const CreateMemberSchema = z.object({
  family_uuid: z.string().uuid(),
  national_id: NationalIdSchema,
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  gender: GenderSchema.optional(),
  relationship_to_head: RelationshipToHeadSchema,
  alive_flag: z.boolean().optional(),
  marital_status: MaritalStatusSchema.optional(),
  phone: PhoneSchema,
  email: EmailSchema,
  use_family_address: z.boolean().optional(),
  // Migration 010: Extended member fields
  middle_names: z.string().max(200).optional(),
  alias: z.string().max(100).optional(),
  order_number: z.number().int().min(1).optional(),
  trn: z.string().max(30).optional(),
  nis_no: z.string().max(30).optional(),
  id_type: IdTypeSchema.optional(),
  id_number: z.string().max(50).optional(),
  birth_entry_number: z.string().max(50).optional(),
  mothers_maiden_name: z.string().max(100).optional(),
  is_twin: z.boolean().optional(),
  occupation: z.string().max(200).optional(),
  contact_no_1: PhoneSchema,
  contact_no_2: PhoneSchema,
  union_status: UnionStatusSchema.optional(),
  last_school_completed: LastSchoolCompletedSchema.optional(),
  school_name: z.string().max(200).optional(),
  school_code: z.string().max(50).optional(),
  school_grade: z.string().max(20).optional(),
  school_class: z.string().max(20).optional(),
  school_shift: z.string().max(30).optional(),
  pregnant: PregnantStatusSchema.optional(),
  pregnancy_due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  is_disabled: z.boolean().optional(),
  is_mentally_ill: z.boolean().optional(),
  is_chronically_ill: z.boolean().optional(),
  is_shut_in: z.boolean().optional(),
  is_nis_pensioner: z.boolean().optional(),
  pension_number: z.string().max(50).optional(),
  clinic_name: z.string().max(200).optional(),
  clinic_code: z.string().max(50).optional(),
  reg_doc_birth_cert: z.boolean().optional(),
  reg_doc_declaration: z.boolean().optional(),
  reg_doc_school_records: z.boolean().optional(),
  reg_doc_none: z.boolean().optional(),
  sex_code: z.number().int().min(1).max(2).optional(),
})

export const UpdateMemberSchema = z.object({
  national_id: NationalIdSchema,
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  gender: GenderSchema.optional(),
  relationship_to_head: RelationshipToHeadSchema.optional(),
  alive_flag: z.boolean().optional(),
  marital_status: MaritalStatusSchema.optional(),
  phone: PhoneSchema,
  email: EmailSchema,
  middle_names: z.string().max(200).optional().nullable(),
  alias: z.string().max(100).optional().nullable(),
  order_number: z.number().int().min(1).optional().nullable(),
  trn: z.string().max(30).optional().nullable(),
  nis_no: z.string().max(30).optional().nullable(),
  id_type: IdTypeSchema.optional().nullable(),
  id_number: z.string().max(50).optional().nullable(),
  birth_entry_number: z.string().max(50).optional().nullable(),
  mothers_maiden_name: z.string().max(100).optional().nullable(),
  is_twin: z.boolean().optional().nullable(),
  occupation: z.string().max(200).optional().nullable(),
  contact_no_1: PhoneSchema.nullable(),
  contact_no_2: PhoneSchema.nullable(),
  union_status: UnionStatusSchema.optional().nullable(),
  last_school_completed: LastSchoolCompletedSchema.optional().nullable(),
  school_name: z.string().max(200).optional().nullable(),
  school_code: z.string().max(50).optional().nullable(),
  school_grade: z.string().max(20).optional().nullable(),
  school_class: z.string().max(20).optional().nullable(),
  school_shift: z.string().max(30).optional().nullable(),
  pregnant: PregnantStatusSchema.optional().nullable(),
  pregnancy_due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  is_disabled: z.boolean().optional().nullable(),
  is_mentally_ill: z.boolean().optional().nullable(),
  is_chronically_ill: z.boolean().optional().nullable(),
  is_shut_in: z.boolean().optional().nullable(),
  is_nis_pensioner: z.boolean().optional().nullable(),
  pension_number: z.string().max(50).optional().nullable(),
  clinic_name: z.string().max(200).optional().nullable(),
  clinic_code: z.string().max(50).optional().nullable(),
  reg_doc_birth_cert: z.boolean().optional().nullable(),
  reg_doc_declaration: z.boolean().optional().nullable(),
  reg_doc_school_records: z.boolean().optional().nullable(),
  reg_doc_none: z.boolean().optional().nullable(),
  sex_code: z.number().int().min(1).max(2).optional().nullable(),
})

// ============ ADDRESS SCHEMAS ============

// ============ ADDRESS SCHEMAS (POLYMORPHIC) ============

export const CreateAddressSchema = z.object({
  entity_type: EntityTypeSchema.optional(),
  entity_id: z.string().uuid().optional(),
  address_type: AddressTypeSchema.optional(),
  line1: z.string().min(1).max(255),
  line2: z.string().max(255).optional(),
  parish: z.string().max(100).optional(),
  district: z.string().max(100),
  geo_code: z.string().max(50).optional(),
  country: z.string().max(100).optional().default('Jamaica'),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  // Migration 010: New address fields
  lot_apt: z.string().max(100).optional(),
  street_district: z.string().max(255).optional(),
  post_office: z.string().max(200).optional(),
  post_code: z.string().max(20).optional(),
  area_type: AreaTypeSchema.optional(),
})

export const UpdateAddressSchema = z.object({
  line1: z.string().min(1).max(255).optional(),
  line2: z.string().max(255).optional(),
  parish: z.string().max(100).optional(),
  district: z.string().max(100).optional(),
  geo_code: z.string().max(50).optional(),
  country: z.string().max(100).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  lot_apt: z.string().max(100).optional().nullable(),
  street_district: z.string().max(255).optional().nullable(),
  post_office: z.string().max(200).optional().nullable(),
  post_code: z.string().max(20).optional().nullable(),
  area_type: AreaTypeSchema.optional().nullable(),
})

// ============ DOCUMENT SCHEMAS (POLYMORPHIC) ============

export const CreateDocumentSchema = z.object({
  // Polymorphic fields
  owner_type: OwnerTypeSchema.optional(),  // Set by backend based on context
  owner_id: z.string().uuid().optional(),   // Set by backend based on context
  // Document fields
  document_type: DocumentTypeSchema,
  document_number: z.string().max(100).optional(),
  file_url: z.string().url().optional(),
  file_name: z.string().min(1).max(255).optional(),
  mime_type: z.string().max(100).optional(),
  file_size_bytes: z.number().int().positive().optional(),
  status: DocumentStatusSchema.optional().default('UPLOADED'),
})

export const VerifyDocumentSchema = z.object({
  status: DocumentStatusSchema,
  verified_by: z.string(),
  rejection_reason: z.string().max(500).optional(),
})

// ============ FAMILY SCHEMAS (NEW MODEL) ============

// Registration Step 1: Create family with contact info
export const CreateFamilySchema = z.object({
  head_first_name: z.string().min(1).max(100),
  head_last_name: z.string().min(1).max(100),
  phone: PhoneSchema,
  email: EmailSchema,
  household_size: z.number().int().min(1),
  intake_channel: IntakeChannelSchema.optional().default('web_portal'),
  geo_code: z.string().max(50).optional(),
  vulnerability_flag: z.boolean().optional().default(false),
  // Migration 010: Extended family fields
  programme: ProgrammeSchema.optional(),
  payment_option: PaymentOptionSchema.optional(),
  social_worker_zone: z.string().max(100).optional(),
  social_worker_code: z.string().max(50).optional(),
  application_no: z.string().max(50).optional(),
  constituency_code: z.string().max(50).optional(),
  head_middle_names: z.string().max(200).optional(),
  head_alias: z.string().max(100).optional(),
  head_mothers_maiden_name: z.string().max(100).optional(),
  head_national_id: z.string().optional(),
  mailing_address_different: z.boolean().optional().default(false),
  directions_to_house: z.string().max(2000).optional(),
})

export const UpdateFamilySchema = z.object({
  head_first_name: z.string().min(1).max(100).optional(),
  head_last_name: z.string().min(1).max(100).optional(),
  phone: PhoneSchema,
  email: EmailSchema,
  household_size: z.number().int().min(1).optional(),
  geo_code: z.string().max(50).optional(),
  vulnerability_flag: z.boolean().optional(),
  status: FamilyStatusSchema.optional(),
  registration_status: RegistrationStatusSchema.optional(),
  programme: ProgrammeSchema.optional().nullable(),
  payment_option: PaymentOptionSchema.optional().nullable(),
  social_worker_zone: z.string().max(100).optional().nullable(),
  social_worker_code: z.string().max(50).optional().nullable(),
  application_no: z.string().max(50).optional().nullable(),
  constituency_code: z.string().max(50).optional().nullable(),
  head_middle_names: z.string().max(200).optional().nullable(),
  head_alias: z.string().max(100).optional().nullable(),
  head_mothers_maiden_name: z.string().max(100).optional().nullable(),
  mailing_address_different: z.boolean().optional(),
  directions_to_house: z.string().max(2000).optional().nullable(),
})

// House & Services Schema (Section 3)
export const CreateHouseServicesSchema = z.object({
  family_uuid: z.string().uuid(),
  dwelling_tenure: DwellingTenureSchema.optional(),
  own_house: z.boolean().optional(),
  own_house_count: z.number().int().min(0).optional(),
  house_insurance: z.boolean().optional(),
  has_landline: z.boolean().optional(),
  has_internet: z.boolean().optional(),
  lighting_source: z.enum(['electricity', 'kerosene', 'other']).optional(),
  pays_for_electricity: z.boolean().optional(),
  outer_wall_material: z.enum(['wood', 'stone', 'brick', 'concrete', 'other']).optional(),
  water_source: z.enum(['indoor_tap', 'outdoor_pipe', 'standpipe', 'well', 'other']).optional(),
  garbage_disposal: z.enum(['collected', 'dump', 'burn', 'garbage_truck', 'other']).optional(),
  toilet_facility: z.enum(['water_closet_sewer', 'water_closet_not_sewer', 'pit', 'other', 'none']).optional(),
  toilet_count: z.number().int().min(0).optional(),
  toilet_exclusive_use: z.boolean().optional(),
  shared_households: z.number().int().min(0).optional(),
  drinking_water_source: z.string().max(50).optional(),
  rooms_occupied: z.number().int().min(0).optional(),
  kitchen_location: z.enum(['indoor', 'outdoor', 'none']).optional(),
  weekly_family_spending: z.number().min(0).optional(),
  head_has_resident_partner: z.boolean().optional(),
  // Assets
  has_laptop: z.boolean().optional(),
  has_desktop: z.boolean().optional(),
  has_washing_machine: z.boolean().optional(),
  has_refrigerator: z.boolean().optional(),
  has_gas_stove: z.boolean().optional(),
  has_electric_stove: z.boolean().optional(),
  has_car: z.boolean().optional(),
  has_fan: z.boolean().optional(),
  has_dvd_burner: z.boolean().optional(),
  has_dvd_player: z.boolean().optional(),
  has_stereo: z.boolean().optional(),
  has_video_equipment: z.boolean().optional(),
  has_air_conditioner: z.boolean().optional(),
  has_other_electrical: z.boolean().optional(),
  has_sewing_machine: z.boolean().optional(),
  has_motorcycle: z.boolean().optional(),
  has_water_heater: z.boolean().optional(),
  has_generator: z.boolean().optional(),
  has_scanner: z.boolean().optional(),
  has_dryer: z.boolean().optional(),
})

export const UpdateHouseServicesSchema = CreateHouseServicesSchema.partial().omit({ family_uuid: true })
