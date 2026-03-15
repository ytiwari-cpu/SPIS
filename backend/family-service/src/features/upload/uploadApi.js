/**
 * Upload Api — route definitions for document file upload / download / delete
 *
 * Migrated from routes/upload.routes.ts to the 4-layer ApiSchema pattern.
 * Adds auth + permissions (original had neither).
 */

import { ApiSchema }        from '../../../../base/apiSchema.js'
import { UploadController } from './uploadController.js'
import { requireAuth }      from '../../../../base/middleware/requireAuth.js'

const auth      = requireAuth()
const writePerm = { anyOf: ['ADMIN.FAMILIES.EDIT', 'CITIZEN.DOCUMENTS.UPLOAD'] }
const readPerm  = { anyOf: ['ADMIN.FAMILIES.VIEW', 'CITIZEN.DOCUMENTS.VIEW'] }
const delPerm   = { anyOf: ['ADMIN.FAMILIES.DELETE', 'CITIZEN.DOCUMENTS.DELETE'] }

const UPLOAD_MIMES = [
  'application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

// ── Endpoints ────────────────────────────────────────────────

const uploadFamilyDoc = {
  path:       '/family/:familyId/documents',
  verb:       'POST',
  handler:    { controller: UploadController, method: 'uploadFamilyDocument', arguments: ['request:params', 'request:body'] },
  middleware: [auth],
  permission: writePerm,
  file:       { field: 'file', maxSizeMb: 10, mimeTypes: UPLOAD_MIMES },
}

const uploadMemberDoc = {
  path:       '/member/:memberId/documents',
  verb:       'POST',
  handler:    { controller: UploadController, method: 'uploadMemberDocument', arguments: ['request:params', 'request:body'] },
  middleware: [auth],
  permission: writePerm,
  file:       { field: 'file', maxSizeMb: 10, mimeTypes: UPLOAD_MIMES },
}

const getDocUrl = {
  path:       '/documents/:documentId/url',
  verb:       'GET',
  handler:    { controller: UploadController, method: 'getDocumentUrl', arguments: ['request:params', 'request:query'] },
  middleware: [auth],
  permission: readPerm,
}

const deleteDocScoped = {
  path:       '/:ownerType/:ownerId/documents/:documentId',
  verb:       'DELETE',
  handler:    { controller: UploadController, method: 'deleteDocumentScoped', arguments: ['request:params'] },
  middleware: [auth],
  permission: delPerm,
}

const deleteDocById = {
  path:       '/documents/:documentId',
  verb:       'DELETE',
  handler:    { controller: UploadController, method: 'deleteDocumentById', arguments: ['request:params'] },
  middleware: [auth],
  permission: delPerm,
}

export const UploadApi = new ApiSchema({
  name:      'Upload',
  url:       '/api/v1/upload',
  endpoints: [uploadFamilyDoc, uploadMemberDoc, getDocUrl, deleteDocScoped, deleteDocById],
})
