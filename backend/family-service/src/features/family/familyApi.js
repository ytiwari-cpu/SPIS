/**
 * familyApi.js — route definitions for the family feature
 */

import { z } from 'zod'
import { ApiSchema } from '../../../../base/apiSchema.js'
import { FamilyController } from './familyController.js'
import { requireAuth } from '../../../../base/middleware/requireAuth.js'

// ─── Inline Zod Schemas ─────────────────────────────────────────────────────

const PhoneSchema = z.string().min(7).max(50).optional()
const EmailSchema = z.string().email({ message: 'Invalid email format' }).max(255).optional()
const FamilyStatusSchema = z.enum(['active', 'inactive', 'suspended', 'archived'])
const RegistrationStatusSchema = z.enum(['draft', 'pending_verification', 'verified', 'rejected', 'DRAFT', 'SUBMITTED', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED'])
const IntakeChannelSchema = z.enum(['field_registration', 'web_portal', 'mobile_app', 'bulk_import', 'migration'])
const ProgrammeSchema = z.enum(['PATH', 'other'])
const PaymentOptionSchema = z.enum(['KCC', 'cheque'])

const CreateFamilySchema = z.object({
  head_first_name:           z.string().min(1).max(100),
  head_last_name:            z.string().min(1).max(100),
  phone:                     PhoneSchema,
  email:                     EmailSchema,
  household_size:            z.number().int().min(1),
  intake_channel:            IntakeChannelSchema.optional().default('web_portal'),
  geo_code:                  z.string().max(50).optional(),
  vulnerability_flag:        z.boolean().optional().default(false),
  programme:                 ProgrammeSchema.optional(),
  payment_option:            PaymentOptionSchema.optional(),
  social_worker_zone:        z.string().max(100).optional(),
  social_worker_code:        z.string().max(50).optional(),
  application_no:            z.string().max(50).optional(),
  constituency_code:         z.string().max(50).optional(),
  head_middle_names:         z.string().max(200).optional(),
  head_alias:                z.string().max(100).optional(),
  head_mothers_maiden_name:  z.string().max(100).optional(),
  head_national_id:          z.string().max(50).optional(),
  mailing_address_different: z.boolean().optional().default(false),
  directions_to_house:       z.string().max(2000).optional(),
})

const UpdateFamilySchema = z.object({
  head_first_name:           z.string().min(1).max(100).optional(),
  head_last_name:            z.string().min(1).max(100).optional(),
  phone:                     PhoneSchema,
  email:                     EmailSchema,
  household_size:            z.number().int().min(1).optional(),
  geo_code:                  z.string().max(50).optional(),
  vulnerability_flag:        z.boolean().optional(),
  status:                    FamilyStatusSchema.optional(),
  registration_status:       RegistrationStatusSchema.optional(),
  programme:                 ProgrammeSchema.optional().nullable(),
  payment_option:            PaymentOptionSchema.optional().nullable(),
  social_worker_zone:        z.string().max(100).optional().nullable(),
  social_worker_code:        z.string().max(50).optional().nullable(),
  application_no:            z.string().max(50).optional().nullable(),
  constituency_code:         z.string().max(50).optional().nullable(),
  head_middle_names:         z.string().max(200).optional().nullable(),
  head_alias:                z.string().max(100).optional().nullable(),
  head_mothers_maiden_name:  z.string().max(100).optional().nullable(),
  mailing_address_different: z.boolean().optional(),
  directions_to_house:       z.string().max(2000).optional().nullable(),
})

// ─── Auth ────────────────────────────────────────────────────────────────────
const auth = [requireAuth()]

// ─── Endpoints ───────────────────────────────────────────────────────────────
const list = {
  path:       '/',
  verb:       'GET',
  handler:    { controller: FamilyController, method: 'list', arguments: ['request:query'] },
  middleware: auth,
  permission: { anyOf: ['ADMIN.FAMILIES.VIEW', 'CITIZEN.FAMILY.VIEW'] },
  cache:      { ttl: 60, prefix: 'family:families' },
}

const get = {
  path:       '/:id',
  verb:       'GET',
  handler:    { controller: FamilyController, method: 'get', arguments: ['request:params'] },
  middleware: auth,
  permission: { anyOf: ['ADMIN.FAMILIES.VIEW', 'CITIZEN.FAMILY.VIEW'] },
  cache:      { ttl: 120, prefix: 'family:family' },
}

const create = {
  path:       '/',
  verb:       'POST',
  handler:    { controller: FamilyController, method: 'create', arguments: ['request:body', 'user'] },
  middleware: auth,
  permission: 'ADMIN.FAMILIES.CREATE',
  request:    { body: CreateFamilySchema },
}

const update = {
  path:       '/:id',
  verb:       'PATCH',
  handler:    { controller: FamilyController, method: 'update', arguments: ['request:params', 'request:body', 'user'] },
  middleware: auth,
  permission: { anyOf: ['ADMIN.FAMILIES.EDIT', 'CITIZEN.FAMILY.EDIT'] },
  request:    { body: UpdateFamilySchema },
}

const submit = {
  path:       '/:id/submit',
  verb:       'POST',
  handler:    { controller: FamilyController, method: 'submit', arguments: ['request:params', 'user'] },
  middleware: auth,
  permission: { anyOf: ['ADMIN.FAMILIES.EDIT', 'CITIZEN.FAMILY.EDIT'] },
}

const verify = {
  path:       '/:id/verify',
  verb:       'POST',
  handler:    { controller: FamilyController, method: 'verify', arguments: ['request:params', 'user'] },
  middleware: auth,
  permission: 'ADMIN.FAMILIES.EDIT',
}

const reject = {
  path:       '/:id/reject',
  verb:       'POST',
  handler:    { controller: FamilyController, method: 'reject', arguments: ['request:params', 'request:body', 'user'] },
  middleware: auth,
  permission: 'ADMIN.FAMILIES.EDIT',
}

const history = {
  path:       '/:id/history',
  verb:       'GET',
  handler:    { controller: FamilyController, method: 'history', arguments: ['request:params'] },
  middleware: auth,
  permission: { anyOf: ['ADMIN.FAMILIES.VIEW', 'CITIZEN.FAMILY.VIEW'] },
}

const remove = {
  path:       '/:id',
  verb:       'DELETE',
  handler:    { controller: FamilyController, method: 'remove', arguments: ['request:params', 'user'] },
  middleware: auth,
  permission: 'ADMIN.FAMILIES.DELETE',
}

export const FamilyApi = new ApiSchema({
  name:      'Family',
  url:       '/api/v1/families',
  endpoints: [list, get, create, update, submit, verify, reject, history, remove],
})
