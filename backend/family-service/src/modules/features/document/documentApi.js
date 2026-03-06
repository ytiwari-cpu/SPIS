/**
 * documentApi.js — route definitions for the document feature
 */

import { z } from 'zod'
import { ApiSchema } from '../../../../../base/apiSchema.js'
import { DocumentController } from './documentController.js'
import { requireAuth } from '../../../../../base/middleware/requireAuth.js'

// ─── Inline Zod Schemas ─────────────────────────────────────────────────────

const DocumentTypeSchema = z.enum(['national_id', 'birth_certificate', 'marriage_certificate', 'death_certificate', 'proof_of_address', 'income_statement', 'photo', 'other'])
const DocumentStatusSchema = z.enum(['pending', 'verified', 'rejected', 'UPLOADED', 'PENDING', 'VERIFIED', 'REJECTED'])
const OwnerTypeSchema = z.enum(['FAMILY', 'MEMBER'])

export const CreateDocumentSchema = z.object({
  owner_type: OwnerTypeSchema.optional(),
  owner_id: z.string().uuid().optional(),
  document_type: DocumentTypeSchema,
  document_number: z.string().max(100).optional(),
  file_url: z.string().url().optional(),
  file_name: z.string().min(1).max(255).optional(),
  mime_type: z.string().max(100).optional(),
  file_size_bytes: z.number().int().positive().optional(),
  status: DocumentStatusSchema.optional().default('UPLOADED'),
})

export const VerifyDocumentSchema = z.object({
  status: DocumentStatusSchema,
  verified_by: z.string(),
  rejection_reason: z.string().max(500).optional(),
})

// ─── Auth ────────────────────────────────────────────────────────────────────
const auth = [requireAuth()]

// ─── Endpoints ───────────────────────────────────────────────────────────────
const listByFamily = { path: '/family/:familyId', verb: 'GET',    handler: { controller: DocumentController, method: 'listByFamily' }, middleware: auth, permissionsAnyOf: ['ADMIN.FAMILIES.VIEW', 'CITIZEN.DOCUMENTS.VIEW'] }
const listByMember = { path: '/member/:memberId', verb: 'GET',    handler: { controller: DocumentController, method: 'listByMember' }, middleware: auth, permissionsAnyOf: ['ADMIN.FAMILIES.VIEW', 'CITIZEN.DOCUMENTS.VIEW'] }
const get          = { path: '/:id',              verb: 'GET',    handler: { controller: DocumentController, method: 'get' },          middleware: auth, permissionsAnyOf: ['ADMIN.FAMILIES.VIEW', 'CITIZEN.DOCUMENTS.VIEW'] }
const create       = { path: '/',                 verb: 'POST',   handler: { controller: DocumentController, method: 'create' },       middleware: auth, permissionsAnyOf: ['ADMIN.FAMILIES.EDIT', 'CITIZEN.DOCUMENTS.UPLOAD'], validation: { body: CreateDocumentSchema } }
const verify       = { path: '/:id/verify',       verb: 'POST',   handler: { controller: DocumentController, method: 'verify' },       middleware: auth, permission: 'ADMIN.FAMILIES.EDIT', validation: { body: VerifyDocumentSchema } }
const remove       = { path: '/:id',              verb: 'DELETE', handler: { controller: DocumentController, method: 'remove' },       middleware: auth, permissionsAnyOf: ['ADMIN.FAMILIES.DELETE', 'CITIZEN.DOCUMENTS.DELETE'] }

export const DocumentApi = new ApiSchema({
  name:      'Document',
  url:       '/api/v1/documents',
  endpoints: [listByFamily, listByMember, get, create, verify, remove],
})
