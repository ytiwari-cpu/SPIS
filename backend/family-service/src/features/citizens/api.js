/**
 * citizens/api.js — route definitions for the citizens feature
 */

import { ApiSchema } from '../../../../base/apiSchema.js'
import { CitizensController } from './citizensController.js'
import { requireAuth } from '../../middleware/requireAuth.js'

const list = { path: '/',    verb: 'GET', handler: { controller: CitizensController, method: 'list' }, middleware: [requireAuth] }
const get  = { path: '/:id', verb: 'GET', handler: { controller: CitizensController, method: 'get' },  middleware: [requireAuth] }

export const CitizensApi = new ApiSchema({
  name:      'Citizens',
  url:       '/api/v1/citizens',
  endpoints: [list, get],
})
