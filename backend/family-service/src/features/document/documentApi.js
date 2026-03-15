/**
 * documentApi.js — route definitions for the document feature
 */

import { z } from 'zod'
import { ApiSchema } from '../../../../base/apiSchema.js'
import { DocumentController } from './documentController.js'
import { requireAuth } from '../../../../base/middleware/requireAuth.js'

// ─── Shared helper schemas (internal only, not exported) ──────────────────────
const DocumentTypeSchema   = z.enum(['national_id', 'birth_certificate', 'marriage_certificate', 'death_certificate', 'proof_of_address', 'income_statement', 'photo', 'other'])
const DocumentStatusSchema = z.enum(['pending', 'verified', 'rejected', 'UPLOADED', 'PENDING', 'VERIFIED', 'REJECTED'])
const OwnerTypeSchema      = z.enum(['FAMILY', 'MEMBER'])

// ─── Auth ────────────────────────────────────────────────────────────────────
const auth = [requireAuth()]

// ─── Endpoints ───────────────────────────────────────────────────────────────
const listByFamily = {
  path:       '/family/:familyId',
  verb:       'GET',
  handler:    { controller: DocumentController, method: 'listByFamily', arguments: ['request:params'] },
  middleware: auth,
  permission: { anyOf: ['ADMIN.FAMILIES.VIEW', 'CITIZEN.DOCUMENTS.VIEW'] },
}

const listByMember = {
  path:       '/member/:memberId',
  verb:       'GET',
  handler:    { controller: DocumentController, method: 'listByMember', arguments: ['request:params'] },
  middleware: auth,
  permission: { anyOf: ['ADMIN.FAMILIES.VIEW', 'CITIZEN.DOCUMENTS.VIEW'] },
}

const get = {
  path:       '/:id',
  verb:       'GET',
  handler:    { controller: DocumentController, method: 'get', arguments: ['request:params'] },
  middleware: auth,
  permission: { anyOf: ['ADMIN.FAMILIES.VIEW', 'CITIZEN.DOCUMENTS.VIEW'] },
}

const create = {
  path:       '/',
  verb:       'POST',
  handler:    { controller: DocumentController, method: 'create', arguments: ['request:body', 'user'] },
  middleware: auth,
  permission: { anyOf: ['ADMIN.FAMILIES.EDIT', 'CITIZEN.DOCUMENTS.UPLOAD'] },
  request:    {
    body: z.object({
      owner_type:      OwnerTypeSchema.optional(),
      owner_id:        z.string().uuid().optional(),
      document_type:   DocumentTypeSchema,
      document_number: z.string().max(100).optional(),
      file_url:        z.string().url().max(2048).optional(),
      file_name:       z.string().min(1).max(255).optional(),
      mime_type:       z.string().max(100).optional(),
      file_size_bytes: z.number().int().positive().optional(),
      status:          DocumentStatusSchema.optional().default('UPLOADED'),
    }),
  },
}

const verify = {
  path:       '/:id/verify',
  verb:       'POST',
  handler:    { controller: DocumentController, method: 'verify', arguments: ['request:params', 'request:body', 'user'] },
  middleware: auth,
  permission: 'ADMIN.FAMILIES.EDIT',
  request:    {
    body: z.object({
      status:           DocumentStatusSchema,
      verified_by:      z.string().max(255),
      rejection_reason: z.string().max(500).optional(),
    }),
  },
}

const remove = {
  path:       '/:id',
  verb:       'DELETE',
  handler:    { controller: DocumentController, method: 'remove', arguments: ['request:params', 'user'] },
  middleware: auth,
  permission: { anyOf: ['ADMIN.FAMILIES.DELETE', 'CITIZEN.DOCUMENTS.DELETE'] },
}

export const DocumentApi = new ApiSchema({
  name:      'Document',
  url:       '/api/v1/documents',
  endpoints: [listByFamily, listByMember, get, create, verify, remove],
})
