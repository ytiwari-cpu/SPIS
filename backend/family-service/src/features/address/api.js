/**
 * address/api.js — route definitions for the address feature
 */

import { ApiSchema } from '../../../../base/apiSchema.js'
import { AddressController } from './addressController.js'
import { requireAuth } from '../../middleware/requireAuth.js'

const get    = { path: '/:id', verb: 'GET',    handler: { controller: AddressController, method: 'get' },    middleware: [requireAuth] }
const create = { path: '/',    verb: 'POST',   handler: { controller: AddressController, method: 'create' }, middleware: [requireAuth] }
const update = { path: '/:id', verb: 'PATCH',  handler: { controller: AddressController, method: 'update' }, middleware: [requireAuth] }
const remove = { path: '/:id', verb: 'DELETE', handler: { controller: AddressController, method: 'remove' }, middleware: [requireAuth] }

export const AddressApi = new ApiSchema({
  name:      'Address',
  url:       '/api/v1/addresses',
  endpoints: [get, create, update, remove],
})
