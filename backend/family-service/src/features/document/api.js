/**
 * document/api.js — route definitions for the document feature
 */

import { ApiSchema } from '../../../../base/apiSchema.js'
import { DocumentController } from './documentController.js'
import { requireAuth } from '../../middleware/requireAuth.js'

const listByFamily = { path: '/family/:familyId', verb: 'GET',    handler: { controller: DocumentController, method: 'listByFamily' }, middleware: [requireAuth] }
const listByMember = { path: '/member/:memberId', verb: 'GET',    handler: { controller: DocumentController, method: 'listByMember' }, middleware: [requireAuth] }
const get          = { path: '/:id',              verb: 'GET',    handler: { controller: DocumentController, method: 'get' },          middleware: [requireAuth] }
const create       = { path: '/',                 verb: 'POST',   handler: { controller: DocumentController, method: 'create' },       middleware: [requireAuth] }
const verify       = { path: '/:id/verify',       verb: 'POST',   handler: { controller: DocumentController, method: 'verify' },       middleware: [requireAuth] }
const remove       = { path: '/:id',              verb: 'DELETE', handler: { controller: DocumentController, method: 'remove' },       middleware: [requireAuth] }

export const DocumentApi = new ApiSchema({
  name:      'Document',
  url:       '/api/v1/documents',
  endpoints: [listByFamily, listByMember, get, create, verify, remove],
})
