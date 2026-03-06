/**
 * memberApi.js — route definitions for the member feature
 */

import { z } from 'zod'
import { ApiSchema } from '../../../../../base/apiSchema.js'
import { MemberController } from './memberController.js'
import { requireAuth } from '../../../../../base/middleware/requireAuth.js'

// ─── Inline Zod Schemas ─────────────────────────────────────────────────────

const NationalIdSchema = z.string()
  .transform(val => val.replace(/\D/g, ''))
  .refine(val => val.length === 14, { message: 'National ID must be exactly 14 digits' })
  .optional()

const PhoneSchema = z.string().min(7).max(50).optional()
const EmailSchema = z.string().email({ message: 'Invalid email format' }).max(255).optional()
const GenderSchema = z.enum(['male', 'female', 'other'])
const RelationshipToHeadSchema = z.enum(['head', 'spouse', 'child', 'parent', 'sibling', 'grandparent', 'grandchild', 'other'])
const MaritalStatusSchema = z.enum(['single', 'married', 'divorced', 'widowed', 'separated'])
const UnionStatusSchema = z.enum(['married', 'common_law', 'divorced', 'separated', 'widowed', 'visiting', 'single', 'none'])
const IdTypeSchema = z.enum(['drivers_license', 'passport', 'voters_id', 'senior_citizen_id', 'none'])
const LastSchoolCompletedSchema = z.enum(['completed_primary', 'some_secondary', 'completed_secondary', 'post_secondary', 'tertiary', 'none'])
const PregnantStatusSchema = z.enum(['yes', 'no', 'lactating'])

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

// ─── Auth ────────────────────────────────────────────────────────────────────
const auth = [requireAuth()]

// ─── Endpoints ───────────────────────────────────────────────────────────────
const listByFamily = { path: '/family/:familyId', verb: 'GET',    handler: { controller: MemberController, method: 'listByFamily' }, middleware: auth, permissionsAnyOf: ['ADMIN.FAMILIES.VIEW', 'CITIZEN.FAMILY.VIEW'] }
const get          = { path: '/:id',              verb: 'GET',    handler: { controller: MemberController, method: 'get' },          middleware: auth, permissionsAnyOf: ['ADMIN.FAMILIES.VIEW', 'CITIZEN.FAMILY.VIEW'] }
const create       = { path: '/',                 verb: 'POST',   handler: { controller: MemberController, method: 'create' },       middleware: auth, permissionsAnyOf: ['ADMIN.FAMILIES.EDIT', 'CITIZEN.FAMILY.EDIT'], validation: { body: CreateMemberSchema } }
const update       = { path: '/:id',              verb: 'PATCH',  handler: { controller: MemberController, method: 'update' },       middleware: auth, permissionsAnyOf: ['ADMIN.FAMILIES.EDIT', 'CITIZEN.FAMILY.EDIT'], validation: { body: UpdateMemberSchema } }
const remove       = { path: '/:id',              verb: 'DELETE', handler: { controller: MemberController, method: 'remove' },       middleware: auth, permission: 'ADMIN.FAMILIES.DELETE' }

const lookup = { path: '/lookup', verb: 'GET', handler: { controller: MemberController, method: 'lookup' }, middleware: [] }

export const MemberApi = new ApiSchema({
  name:      'Member',
  url:       '/api/v1/members',
  endpoints: [listByFamily, get, create, update, remove],
})

export const MemberPublicApi = new ApiSchema({
  name:      'MemberPublic',
  url:       '/api/v1/public/members',
  endpoints: [lookup],
})
