/**
 * Registration Api
 *
 * Declares all 28 registration wizard endpoints for the family-service.
 * Uses ApiSchema for declarative route registration with permission bindings.
 */

import { z }                       from 'zod'
import { ApiSchema }               from '../../../../base/apiSchema.js'
import { RegistrationController }  from './registrationController.js'
import { requireAuth }             from '../../../../base/middleware/requireAuth.js'

const auth = requireAuth()

const readPerm  = ['CITIZEN.FAMILY.VIEW']
const editPerm = ['CITIZEN.FAMILY.EDIT']
const addPerm  = ['CITIZEN.FAMILY.EDIT']

// ─── Shared address fields ───────────────────────────────
const addressBody = z.object({
  line1:            z.string().max(255).optional(),
  line2:            z.string().max(255).optional(),
  parish:           z.string().max(100).optional(),
  district:         z.string().max(100).optional(),
  geo_code:         z.string().max(50).optional(),
  lot_apt:          z.string().max(100).optional(),
  street_district:  z.string().max(255).optional(),
  post_office:      z.string().max(100).optional(),
  post_code:        z.string().max(20).optional(),
  area_type:        z.string().max(20).optional(),
}).passthrough()

// ─── FAMILY ──────────────────────────────────────────────

const getFamily = {
  path:       '/family/:familyUuid',
  verb:       'GET',
  handler:    { controller: RegistrationController, method: 'getFamily', arguments: ['request:params'] },
  middleware: [auth],
  permission: readPerm,
  request:    { params: z.object({ familyUuid: z.string().uuid() }) },
}

const updateFamily = {
  path:       '/family/:familyUuid',
  verb:       'PUT',
  handler:    { controller: RegistrationController, method: 'updateFamily', arguments: ['request:params', 'request:body'] },
  middleware: [auth],
  permission: editPerm,
  request:    {
    params: z.object({ familyUuid: z.string().uuid() }),
    body:   z.object({
      household_size:         z.number().int().positive().optional(),
      status:                 z.string().max(50).optional(),
      intake_channel:         z.string().max(50).optional(),
      head_first_name:        z.string().max(100).optional(),
      head_last_name:         z.string().max(100).optional(),
      head_middle_names:      z.string().max(255).optional(),
      head_alias:             z.string().max(100).optional(),
      head_mothers_maiden_name: z.string().max(255).optional(),
      phone:                  z.string().max(50).optional(),
      email:                  z.string().email().optional().nullable(),
      geo_code:               z.string().max(50).optional(),
      vulnerability_flag:     z.boolean().optional(),
      registration_status:    z.string().max(30).optional(),
      programme:              z.string().max(50).optional(),
      payment_option:         z.string().max(20).optional(),
      social_worker_zone:     z.string().max(50).optional(),
      social_worker_code:     z.string().max(50).optional(),
      application_no:         z.string().max(50).optional(),
      constituency_code:      z.string().max(50).optional(),
      mailing_address_different: z.boolean().optional(),
      directions_to_house:    z.string().optional(),
    }).passthrough(),
  },
}

const createFamily = {
  path:       '/family',
  verb:       'POST',
  handler:    { controller: RegistrationController, method: 'createFamily', arguments: ['request:body'] },
  middleware: [auth],
  permission: addPerm,
  request:    {
    body: z.object({
      head_first_name:  z.string().min(1).max(100),
      head_last_name:   z.string().min(1).max(100),
      household_size:   z.number().int().positive().optional(),
      family_name:      z.string().max(255).optional(),
      head_middle_names: z.string().max(255).optional(),
      head_alias:       z.string().max(100).optional(),
      head_mothers_maiden_name: z.string().max(255).optional(),
      head_national_id: z.string().optional(),
      head_date_of_birth: z.string().optional(),
      head_sex:         z.enum(['M', 'F', 'OTHER']).optional(),
      phone:            z.string().max(50).optional(),
      email:            z.string().email().optional(),
      intake_channel:   z.string().max(50).optional(),
      vulnerability_flag: z.boolean().optional(),
      geo_code:         z.string().max(50).optional(),
      programme:        z.string().max(50).optional(),
      payment_option:   z.string().max(20).optional(),
      social_worker_zone: z.string().max(50).optional(),
      social_worker_code: z.string().max(50).optional(),
      mailing_address_different: z.boolean().optional(),
      directions_to_house: z.string().optional(),
    }).passthrough(),
  },
}

// ─── ADDRESS ─────────────────────────────────────────────

const updatePermanentAddress = {
  path:       '/family/:familyUuid/address',
  verb:       'PUT',
  handler:    { controller: RegistrationController, method: 'updatePermanentAddress', arguments: ['request:params', 'request:body'] },
  middleware: [auth],
  permission: editPerm,
  request:    { params: z.object({ familyUuid: z.string().uuid() }), body: addressBody },
}

const createPermanentAddress = {
  path:       '/family/:familyUuid/address',
  verb:       'POST',
  handler:    { controller: RegistrationController, method: 'createPermanentAddress', arguments: ['request:params', 'request:body'] },
  middleware: [auth],
  permission: addPerm,
  request:    {
    params: z.object({ familyUuid: z.string().uuid() }),
    body:   addressBody.extend({
      line1:  z.string().min(1).max(255),
      parish: z.string().min(1).max(100),
    }),
  },
}

const createMemberAddress = {
  path:       '/member/:memberUuid/address',
  verb:       'POST',
  handler:    { controller: RegistrationController, method: 'createMemberAddress', arguments: ['request:params', 'request:body'] },
  middleware: [auth],
  permission: addPerm,
  request:    {
    params: z.object({ memberUuid: z.string().uuid() }),
    body:   addressBody.extend({
      use_family_address: z.boolean().optional(),
    }),
  },
}

// ─── MAILING ADDRESS ────────────────────────────────────

const createMailingAddress = {
  path:       '/family/:familyUuid/mailing-address',
  verb:       'POST',
  handler:    { controller: RegistrationController, method: 'createMailingAddress', arguments: ['request:params', 'request:body'] },
  middleware: [auth],
  permission: addPerm,
  request:    {
    params: z.object({ familyUuid: z.string().uuid() }),
    body:   addressBody.extend({
      same_as_permanent: z.boolean().optional(),
    }),
  },
}

const getMailingAddress = {
  path:       '/family/:familyUuid/mailing-address',
  verb:       'GET',
  handler:    { controller: RegistrationController, method: 'getMailingAddress', arguments: ['request:params'] },
  middleware: [auth],
  permission: readPerm,
  request:    { params: z.object({ familyUuid: z.string().uuid() }) },
}

const updateMailingAddress = {
  path:       '/family/:familyUuid/mailing-address',
  verb:       'PUT',
  handler:    { controller: RegistrationController, method: 'updateMailingAddress', arguments: ['request:params', 'request:body'] },
  middleware: [auth],
  permission: editPerm,
  request:    { params: z.object({ familyUuid: z.string().uuid() }), body: addressBody },
}

// ─── MEMBERS ─────────────────────────────────────────────

const updateMember = {
  path:       '/family/:familyUuid/members/:memberUuid',
  verb:       'PUT',
  handler:    { controller: RegistrationController, method: 'updateMember', arguments: ['request:params', 'request:body'] },
  middleware: [auth],
  permission: editPerm,
  request:    {
    params: z.object({ familyUuid: z.string().uuid(), memberUuid: z.string().uuid() }),
    body:   z.object({
      first_name:           z.string().min(1).max(100).optional(),
      last_name:            z.string().min(1).max(100).optional(),
      middle_names:         z.string().max(255).optional().nullable(),
      alias:                z.string().max(100).optional().nullable(),
      date_of_birth:        z.string().optional().nullable(),
      gender:               z.string().max(10).optional(),
      sex_code:             z.number().int().optional(),
      national_id:          z.string().optional().nullable(),
      trn:                  z.string().optional().nullable(),
      nis_no:               z.string().optional().nullable(),
      phone:                z.string().max(50).optional().nullable(),
      contact_no_1:         z.string().max(30).optional().nullable(),
      contact_no_2:         z.string().max(30).optional().nullable(),
      email:                z.string().email().optional().nullable(),
      relationship_to_head: z.string().max(50).optional(),
      marital_status:       z.string().max(50).optional().nullable(),
      union_status:         z.string().max(20).optional().nullable(),
      alive_flag:           z.boolean().optional(),
      occupation:           z.string().max(100).optional().nullable(),
      order_number:         z.number().int().optional(),
      is_twin:              z.boolean().optional(),
    }).passthrough(),
  },
}

const createMember = {
  path:       '/family/:familyUuid/members',
  verb:       'POST',
  handler:    { controller: RegistrationController, method: 'createMember', arguments: ['request:params', 'request:body'] },
  middleware: [auth],
  permission: addPerm,
  request:    {
    params: z.object({ familyUuid: z.string().uuid() }),
    body:   z.object({
      first_name:           z.string().min(1).max(100),
      last_name:            z.string().min(1).max(100),
      relationship_to_head: z.string().min(1).max(50),
      middle_names:         z.string().max(255).optional(),
      alias:                z.string().max(100).optional(),
      national_id:          z.string().optional(),
      date_of_birth:        z.string().optional(),
      gender:               z.string().max(10).optional(),
      sex_code:             z.number().int().optional(),
      phone:                z.string().max(50).optional(),
      contact_no_1:         z.string().max(30).optional(),
      contact_no_2:         z.string().max(30).optional(),
      email:                z.string().email().optional(),
      marital_status:       z.string().max(50).optional(),
      union_status:         z.string().max(20).optional(),
      alive_flag:           z.boolean().optional(),
      occupation:           z.string().max(100).optional(),
      order_number:         z.number().int().optional(),
      is_twin:              z.boolean().optional(),
      address:              addressBody.optional(),
      current_address:      addressBody.optional(),
      use_family_address:   z.boolean().optional(),
    }).passthrough(),
  },
}

const addMember = {
  path:       '/family/:familyUuid/members/add',
  verb:       'POST',
  handler:    { controller: RegistrationController, method: 'addMember', arguments: ['request:params', 'request:body'] },
  middleware: [auth],
  permission: addPerm,
  request:    {
    params: z.object({ familyUuid: z.string().uuid() }),
    body:   z.object({
      first_name:           z.string().min(1).max(100),
      last_name:            z.string().min(1).max(100),
      middle_names:         z.string().max(255).optional(),
      alias:                z.string().max(100).optional(),
      national_id:          z.string().optional(),
      date_of_birth:        z.string().optional(),
      gender:               z.string().max(10).optional(),
      sex_code:             z.number().int().optional(),
      phone:                z.string().max(50).optional(),
      email:                z.string().email().optional(),
      relationship_to_head: z.string().max(50).optional(),
      reason_for_addition:  z.string().max(500).optional(),
    }).passthrough(),
  },
}

const updateMemberStatus = {
  path:       '/family/:familyUuid/members/:memberUuid/status',
  verb:       'PATCH',
  handler:    { controller: RegistrationController, method: 'updateMemberStatus', arguments: ['request:params', 'request:body'] },
  middleware: [auth],
  permission: editPerm,
  request:    {
    params: z.object({ familyUuid: z.string().uuid(), memberUuid: z.string().uuid() }),
    body:   z.object({
      status:        z.string().min(1),
      date_of_death: z.string().optional(),
      left_date:     z.string().optional(),
      reason:        z.string().max(500).optional(),
    }),
  },
}

const deleteMember = {
  path:       '/family/:familyUuid/members/:memberUuid',
  verb:       'DELETE',
  handler:    { controller: RegistrationController, method: 'deleteMember', arguments: ['request:params', 'request:body'] },
  middleware: [auth],
  permission: ['CITIZEN.FAMILY.DELETE'],
  request:    {
    params: z.object({ familyUuid: z.string().uuid(), memberUuid: z.string().uuid() }),
    body:   z.object({
      hard_delete: z.boolean().optional(),
      reason:      z.string().max(500).optional(),
    }).optional(),
  },
}

const getMemberHistory = {
  path:       '/family/:familyUuid/members/:memberUuid/history',
  verb:       'GET',
  handler:    { controller: RegistrationController, method: 'getMemberHistory', arguments: ['request:params'] },
  middleware: [auth],
  permission: readPerm,
  request:    { params: z.object({ familyUuid: z.string().uuid(), memberUuid: z.string().uuid() }) },
}

// ─── DOCUMENTS ───────────────────────────────────────────

const createFamilyDocument = {
  path:       '/family/:familyUuid/documents',
  verb:       'POST',
  handler:    { controller: RegistrationController, method: 'createFamilyDocument', arguments: ['request:params', 'request:body'] },
  middleware: [auth],
  permission: addPerm,
  request:    { params: z.object({ familyUuid: z.string().uuid() }), body: z.object({
    document_type:       z.string().max(50).optional(),
    document_name:       z.string().max(255).optional(),
    document_number:     z.string().max(100).optional(),
    issue_date:          z.string().optional(),
    expiry_date:         z.string().optional(),
    issuing_authority:   z.string().max(255).optional(),
    verification_status: z.enum(['PENDING', 'VERIFIED', 'REJECTED']).optional(),
    notes:               z.string().max(1000).optional(),
  }) },
}

const createMemberDocument = {
  path:       '/member/:memberUuid/documents',
  verb:       'POST',
  handler:    { controller: RegistrationController, method: 'createMemberDocument', arguments: ['request:params', 'request:body'] },
  middleware: [auth],
  permission: addPerm,
  request:    { params: z.object({ memberUuid: z.string().uuid() }), body: z.object({
    document_type:       z.string().max(50).optional(),
    document_name:       z.string().max(255).optional(),
    document_number:     z.string().max(100).optional(),
    issue_date:          z.string().optional(),
    expiry_date:         z.string().optional(),
    issuing_authority:   z.string().max(255).optional(),
    verification_status: z.enum(['PENDING', 'VERIFIED', 'REJECTED']).optional(),
    notes:               z.string().max(1000).optional(),
  }) },
}

// ─── HOUSE SERVICES ──────────────────────────────────────

const createHouseServices = {
  path:       '/family/:familyUuid/house-services',
  verb:       'POST',
  handler:    { controller: RegistrationController, method: 'createHouseServices', arguments: ['request:params', 'request:body'] },
  middleware: [auth],
  permission: addPerm,
  request:    {
    params: z.object({ familyUuid: z.string().uuid() }),
    body:   z.object({
      dwelling_tenure:        z.string().max(30).optional(),
      own_house:              z.boolean().optional(),
      house_insurance:        z.boolean().optional(),
      outer_wall_material:    z.string().max(30).optional(),
      lighting_source:        z.string().max(30).optional(),
      pays_for_electricity:   z.boolean().optional(),
      water_source:           z.string().max(30).optional(),
      drinking_water_source:  z.string().max(30).optional(),
      toilet_facility:        z.string().max(30).optional(),
      toilet_count:           z.number().int().optional(),
      toilet_exclusive_use:   z.boolean().optional(),
      garbage_disposal:       z.string().max(30).optional(),
      kitchen_location:       z.string().max(20).optional(),
      rooms_occupied:         z.number().int().optional(),
      has_landline:           z.boolean().optional(),
      has_internet:           z.boolean().optional(),
      has_laptop:             z.boolean().optional(),
      has_desktop:            z.boolean().optional(),
      has_washing_machine:    z.boolean().optional(),
      has_refrigerator:       z.boolean().optional(),
      has_gas_stove:          z.boolean().optional(),
      has_electric_stove:     z.boolean().optional(),
      has_car:                z.boolean().optional(),
      has_fan:                z.boolean().optional(),
      has_air_conditioner:    z.boolean().optional(),
      has_motorcycle:         z.boolean().optional(),
      has_water_heater:       z.boolean().optional(),
      has_generator:          z.boolean().optional(),
      has_sewing_machine:     z.boolean().optional(),
      has_stereo:             z.boolean().optional(),
      has_dvd_player:         z.boolean().optional(),
      has_video_equipment:    z.boolean().optional(),
      has_dryer:              z.boolean().optional(),
      has_scanner:            z.boolean().optional(),
      weekly_family_spending: z.number().optional(),
      head_has_resident_partner: z.boolean().optional(),
    }).passthrough(),
  },
}

const getHouseServices = {
  path:       '/family/:familyUuid/house-services',
  verb:       'GET',
  handler:    { controller: RegistrationController, method: 'getHouseServices', arguments: ['request:params'] },
  middleware: [auth],
  permission: readPerm,
  request:    { params: z.object({ familyUuid: z.string().uuid() }) },
}

const updateHouseServices = {
  path:       '/family/:familyUuid/house-services',
  verb:       'PUT',
  handler:    { controller: RegistrationController, method: 'updateHouseServices', arguments: ['request:params', 'request:body'] },
  middleware: [auth],
  permission: editPerm,
  request:    {
    params: z.object({ familyUuid: z.string().uuid() }),
    body:   z.object({
      dwelling_tenure:        z.string().max(30).optional(),
      own_house:              z.boolean().optional(),
      house_insurance:        z.boolean().optional(),
      outer_wall_material:    z.string().max(30).optional(),
      lighting_source:        z.string().max(30).optional(),
      pays_for_electricity:   z.boolean().optional(),
      water_source:           z.string().max(30).optional(),
      drinking_water_source:  z.string().max(30).optional(),
      toilet_facility:        z.string().max(30).optional(),
      toilet_count:           z.number().int().optional(),
      toilet_exclusive_use:   z.boolean().optional(),
      garbage_disposal:       z.string().max(30).optional(),
      kitchen_location:       z.string().max(20).optional(),
      rooms_occupied:         z.number().int().optional(),
      has_landline:           z.boolean().optional(),
      has_internet:           z.boolean().optional(),
      has_laptop:             z.boolean().optional(),
      has_desktop:            z.boolean().optional(),
      has_washing_machine:    z.boolean().optional(),
      has_refrigerator:       z.boolean().optional(),
      has_gas_stove:          z.boolean().optional(),
      has_electric_stove:     z.boolean().optional(),
      has_car:                z.boolean().optional(),
      has_fan:                z.boolean().optional(),
      has_air_conditioner:    z.boolean().optional(),
      has_motorcycle:         z.boolean().optional(),
      has_water_heater:       z.boolean().optional(),
      has_generator:          z.boolean().optional(),
      has_sewing_machine:     z.boolean().optional(),
      has_stereo:             z.boolean().optional(),
      has_dvd_player:         z.boolean().optional(),
      has_video_equipment:    z.boolean().optional(),
      has_dryer:              z.boolean().optional(),
      has_scanner:            z.boolean().optional(),
      weekly_family_spending: z.number().optional(),
      head_has_resident_partner: z.boolean().optional(),
    }).passthrough(),
  },
}

// ─── SUBMISSION / REVIEW ─────────────────────────────────

const getAccountInfo = {
  path:       '/family/:familyUuid/account-info',
  verb:       'GET',
  handler:    { controller: RegistrationController, method: 'getAccountInfo', arguments: ['request:params'] },
  middleware: [auth],
  permission: readPerm,
  request:    { params: z.object({ familyUuid: z.string().uuid() }) },
}

const getMemberAccountInfo = {
  path:       '/member/:memberUuid/account-info',
  verb:       'GET',
  handler:    { controller: RegistrationController, method: 'getAccountInfo', arguments: ['request:params'] },
  middleware: [auth],
  permission: readPerm,
  request:    { params: z.object({ memberUuid: z.string().uuid() }) },
}

const getReview = {
  path:       '/family/:familyUuid/review',
  verb:       'GET',
  handler:    { controller: RegistrationController, method: 'getReview', arguments: ['request:params'] },
  middleware: [auth],
  permission: readPerm,
  request:    { params: z.object({ familyUuid: z.string().uuid() }) },
}

const saveDraft = {
  path:       '/family/:familyUuid/save-draft',
  verb:       'POST',
  handler:    { controller: RegistrationController, method: 'saveDraft', arguments: ['request:params', 'request:body'] },
  middleware: [auth],
  permission: addPerm,
  request:    { params: z.object({ familyUuid: z.string().uuid() }), body: z.object({}).passthrough() },
}

const submitRegistration = {
  path:       '/family/:familyUuid/submit',
  verb:       'POST',
  handler:    { controller: RegistrationController, method: 'submit', arguments: ['request:params'] },
  middleware: [auth],
  permission: addPerm,
  request:    { params: z.object({ familyUuid: z.string().uuid() }) },
}

const getProgress = {
  path:       '/family/:familyUuid/progress',
  verb:       'GET',
  handler:    { controller: RegistrationController, method: 'getProgress', arguments: ['request:params'] },
  middleware: [auth],
  permission: readPerm,
  request:    { params: z.object({ familyUuid: z.string().uuid() }) },
}

// ─── SAVE EDITS ──────────────────────────────────────────

const saveEdits = {
  path:       '/family/:familyUuid/save-edits',
  verb:       'POST',
  handler:    { controller: RegistrationController, method: 'saveEdits', arguments: ['request:params', 'request:body'] },
  middleware: [auth],
  permission: addPerm,
}

// ─── CHECK NATIONAL ID ──────────────────────────────────

const checkNationalId = {
  path:       '/check-national-id/:nationalId',
  verb:       'GET',
  handler:    { controller: RegistrationController, method: 'checkNationalId', arguments: ['request:params'] },
  middleware: [auth],
  permission: readPerm,
  request:    { params: z.object({ nationalId: z.string().min(1) }) },
}

export const RegistrationApi = new ApiSchema({
  name:      'Registration',
  url:       '/api/v1/registration',
  endpoints: [
    getFamily, updateFamily, createFamily,
    updatePermanentAddress, createPermanentAddress, createMemberAddress,
    createMailingAddress, getMailingAddress, updateMailingAddress,
    updateMember, createMember, addMember, updateMemberStatus, deleteMember, getMemberHistory,
    createFamilyDocument, createMemberDocument,
    createHouseServices, getHouseServices, updateHouseServices,
    getAccountInfo, getMemberAccountInfo,
    getReview, saveDraft, submitRegistration, getProgress,
    saveEdits,
    checkNationalId,
  ],
})
