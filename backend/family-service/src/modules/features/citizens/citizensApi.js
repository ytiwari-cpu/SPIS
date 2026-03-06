/**
 * citizensApi.js — route definitions for the citizens feature
 */

import { ApiSchema } from '../../../../../base/apiSchema.js'
import { CitizensController } from './citizensController.js'
import { requireAuth } from '../../../../../base/middleware/requireAuth.js'

const auth = [requireAuth()]

const list = { path: '/',    verb: 'GET', handler: { controller: CitizensController, method: 'list' }, middleware: auth, permission: 'ADMIN.USERS.VIEW' }
const get  = { path: '/:id', verb: 'GET', handler: { controller: CitizensController, method: 'get' },  middleware: auth, permission: 'ADMIN.USERS.VIEW' }

export const CitizensApi = new ApiSchema({
  name:      'Citizens',
  url:       '/api/v1/citizens',
  endpoints: [list, get],
})
