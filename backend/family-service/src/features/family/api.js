/**
 * family/api.js — route definitions for the family feature
 */

import { ApiSchema } from '../../../../base/apiSchema.js'
import { FamilyController } from './familyController.js'
import { requireAuth } from '../../middleware/requireAuth.js'

const list    = { path: '/',            verb: 'GET',    handler: { controller: FamilyController, method: 'list' },    middleware: [requireAuth] }
const get     = { path: '/:id',         verb: 'GET',    handler: { controller: FamilyController, method: 'get' },     middleware: [requireAuth] }
const create  = { path: '/',            verb: 'POST',   handler: { controller: FamilyController, method: 'create' },  middleware: [requireAuth] }
const update  = { path: '/:id',         verb: 'PATCH',  handler: { controller: FamilyController, method: 'update' },  middleware: [requireAuth] }
const submit  = { path: '/:id/submit',  verb: 'POST',   handler: { controller: FamilyController, method: 'submit' },  middleware: [requireAuth] }
const verify  = { path: '/:id/verify',  verb: 'POST',   handler: { controller: FamilyController, method: 'verify' },  middleware: [requireAuth] }
const reject  = { path: '/:id/reject',  verb: 'POST',   handler: { controller: FamilyController, method: 'reject' },  middleware: [requireAuth] }
const history = { path: '/:id/history', verb: 'GET',    handler: { controller: FamilyController, method: 'history' }, middleware: [requireAuth] }
const remove  = { path: '/:id',         verb: 'DELETE', handler: { controller: FamilyController, method: 'remove' },  middleware: [requireAuth] }

export const FamilyApi = new ApiSchema({
  name:      'Family',
  url:       '/api/v1/families',
  endpoints: [list, get, create, update, submit, verify, reject, history, remove],
})
