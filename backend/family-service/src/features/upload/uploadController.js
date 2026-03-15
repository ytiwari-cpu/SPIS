/**
 * UploadController — HTTP handlers for document upload / URL / delete endpoints
 *
 * Note: file uploads (multipart/form-data) arrive via multer and are accessed
 * through this.context.request.file — there is no 'file' arguments token in
 * the ApiSchema pattern.
 */

import { BaseController }  from '../../../../base/baseController.js'
import { UploadRepository } from './uploadRepository.js'
import { UploadService }    from './uploadService.js'

export class UploadController extends BaseController {
  constructor(context) {
    super(context)
    const repo   = new UploadRepository(context)
    this.service = new UploadService(context, repo)
  }

  // POST /family/:familyId/documents
  async uploadFamilyDocument(params, body) {
    const { familyId } = params
    const file          = this.context.request.file   // injected by multer via apiSchema `file:`
    const doc           = await this.service.uploadFamilyDocument(familyId, file, body)
    return this.respondCreated(doc, 'Document uploaded successfully.')
  }

  // POST /member/:memberId/documents
  async uploadMemberDocument(params, body) {
    const { memberId } = params
    const file          = this.context.request.file
    const doc           = await this.service.uploadMemberDocument(memberId, file, body)
    return this.respondCreated(doc, 'Document uploaded successfully.')
  }

  // GET /documents/:documentId/url
  async getDocumentUrl(params, query) {
    const { documentId } = params
    const result = await this.service.getDocumentUrl(documentId, query.expires_in)
    return this.respondOk(result)
  }

  // DELETE /:ownerType/:ownerId/documents/:documentId
  async deleteDocumentScoped(params) {
    const { ownerType, ownerId, documentId } = params
    await this.service.deleteDocumentScoped(ownerType, ownerId, documentId)
    return this.respondOk(null, 'Document deleted successfully.')
  }

  // DELETE /documents/:documentId
  async deleteDocumentById(params) {
    const { documentId } = params
    await this.service.deleteDocumentById(documentId)
    return this.respondOk(null, 'Document deleted successfully.')
  }
}
