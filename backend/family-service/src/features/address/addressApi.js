/**
 * addressApi.js — route definitions for the address feature
 */

import { z } from 'zod'
import { ApiSchema } from '../../../../base/apiSchema.js'
import { AddressController } from './addressController.js'
import { requireAuth } from '../../../../base/middleware/requireAuth.js'

// ─── Shared helper schemas (internal only, not exported) ──────────────────────
const EntityTypeSchema  = z.enum(['FAMILY', 'MEMBER'])
const AddressTypeSchema = z.enum(['PERMANENT', 'CURRENT', 'MAILING'])
const AreaTypeSchema    = z.enum(['KMA', 'other_town', 'rural'])

// ─── Auth ────────────────────────────────────────────────────────────────────
const auth = [requireAuth()]

// ─── Endpoints ───────────────────────────────────────────────────────────────
const get = {
  path:       '/:id',
  verb:       'GET',
  handler:    { controller: AddressController, method: 'get', arguments: ['request:params'] },
  middleware: auth,
  permission: { anyOf: ['ADMIN.FAMILIES.VIEW', 'CITIZEN.FAMILY.VIEW'] },
}

const create = {
  path:       '/',
  verb:       'POST',
  handler:    { controller: AddressController, method: 'create', arguments: ['request:body'] },
  middleware: auth,
  permission: { anyOf: ['ADMIN.FAMILIES.EDIT', 'CITIZEN.FAMILY.EDIT'] },
  request:    {
    body: z.object({
      entity_type:     EntityTypeSchema.optional(),
      entity_id:       z.string().uuid().optional(),
      address_type:    AddressTypeSchema.optional(),
      line1:           z.string().min(1).max(255),
      line2:           z.string().max(255).optional(),
      parish:          z.string().max(100).optional(),
      district:        z.string().max(100),
      geo_code:        z.string().max(50).optional(),
      country:         z.string().max(100).optional().default('Jamaica'),
      latitude:        z.number().min(-90).max(90).optional(),
      longitude:       z.number().min(-180).max(180).optional(),
      lot_apt:         z.string().max(100).optional(),
      street_district: z.string().max(255).optional(),
      post_office:     z.string().max(200).optional(),
      post_code:       z.string().max(20).optional(),
      area_type:       AreaTypeSchema.optional(),
    }),
  },
}

const update = {
  path:       '/:id',
  verb:       'PATCH',
  handler:    { controller: AddressController, method: 'update', arguments: ['request:params', 'request:body'] },
  middleware: auth,
  permission: { anyOf: ['ADMIN.FAMILIES.EDIT', 'CITIZEN.FAMILY.EDIT'] },
  request:    {
    body: z.object({
      line1:           z.string().min(1).max(255).optional(),
      line2:           z.string().max(255).optional(),
      parish:          z.string().max(100).optional(),
      district:        z.string().max(100).optional(),
      geo_code:        z.string().max(50).optional(),
      country:         z.string().max(100).optional(),
      latitude:        z.number().min(-90).max(90).optional(),
      longitude:       z.number().min(-180).max(180).optional(),
      lot_apt:         z.string().max(100).optional().nullable(),
      street_district: z.string().max(255).optional().nullable(),
      post_office:     z.string().max(200).optional().nullable(),
      post_code:       z.string().max(20).optional().nullable(),
      area_type:       AreaTypeSchema.optional().nullable(),
    }),
  },
}

const remove = {
  path:       '/:id',
  verb:       'DELETE',
  handler:    { controller: AddressController, method: 'remove', arguments: ['request:params'] },
  middleware: auth,
  permission: 'ADMIN.FAMILIES.DELETE',
}

export const AddressApi = new ApiSchema({
  name:      'Address',
  url:       '/api/v1/addresses',
  endpoints: [get, create, update, remove],
})
