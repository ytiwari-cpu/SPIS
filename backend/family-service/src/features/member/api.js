/**
 * member/api.js — route definitions for the member feature
 */

import { ApiSchema } from '../../../../base/apiSchema.js'
import { MemberController } from './memberController.js'
import { requireAuth } from '../../middleware/requireAuth.js'

const listByFamily = { path: '/family/:familyId', verb: 'GET',    handler: { controller: MemberController, method: 'listByFamily' }, middleware: [requireAuth] }
const get          = { path: '/:id',              verb: 'GET',    handler: { controller: MemberController, method: 'get' },          middleware: [requireAuth] }
const create       = { path: '/',                 verb: 'POST',   handler: { controller: MemberController, method: 'create' },       middleware: [requireAuth] }
const update       = { path: '/:id',              verb: 'PATCH',  handler: { controller: MemberController, method: 'update' },       middleware: [requireAuth] }
const remove       = { path: '/:id',              verb: 'DELETE', handler: { controller: MemberController, method: 'remove' },       middleware: [requireAuth] }

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
