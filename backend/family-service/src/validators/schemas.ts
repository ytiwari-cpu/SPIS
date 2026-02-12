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
export const AddressTypeSchema = z.enum(['PERMANENT', 'CURRENT'])
export const OwnerTypeSchema = z.enum(['FAMILY', 'MEMBER'])

// ============ MEMBER SCHEMAS ============

export const CreateMemberSchema = z.object({
  family_id: z.string().uuid(),
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
  use_family_address: z.boolean().optional(), // If true, uses family PERMANENT address
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
})

// ============ ADDRESS SCHEMAS ============

// ============ ADDRESS SCHEMAS (POLYMORPHIC) ============

export const CreateAddressSchema = z.object({
  // Polymorphic fields
  entity_type: EntityTypeSchema.optional(), // Set by backend based on context
  entity_id: z.string().uuid().optional(),   // Set by backend based on context
  address_type: AddressTypeSchema.optional(), // Set by backend based on context
  // Address fields
  line1: z.string().min(1).max(255),
  line2: z.string().max(255).optional(),
  parish: z.string().max(100).optional(),
  district: z.string().max(100),
  geo_code: z.string().max(50).optional(),
  country: z.string().max(100).optional().default('Tanzania'),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
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
  // Primary contact (head) info - stored on family table
  head_first_name: z.string().min(1).max(100),
  head_last_name: z.string().min(1).max(100),
  phone: PhoneSchema,
  email: EmailSchema,
  // Family details
  household_size: z.number().int().min(1),
  intake_channel: IntakeChannelSchema.optional().default('web_portal'),
  geo_code: z.string().max(50).optional(),
  vulnerability_flag: z.boolean().optional().default(false),
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
})
