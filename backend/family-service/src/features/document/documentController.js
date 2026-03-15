/**
 * DocumentController — handles /api/v1/documents routes
 */

import { BaseController } from '../../../../base/baseController.js'
import { ApplicationError } from '../../../../base/applicationError.js'
import { DocumentService } from './documentService.js'

export class DocumentController extends BaseController {
  /** @param {import('../../../../base/apiContext.js').ApiContext} context */
  constructor(context) {
    super(context)
    this.documentService = new DocumentService(context)
  }

  async listByFamily(params) {
    const data = await this.documentService.listByFamily(params.familyId)
    return this.respondOk({ success: true, data })
  }

  async listByMember(params) {
    const data = await this.documentService.listByMember(params.memberId)
    return this.respondOk({ success: true, data })
  }

  async get(params) {
    const document = await this.documentService.get(params.id)
    if (!document) {
      throw ApplicationError.notFound('Document not found')
    }
    return this.respondOk({ success: true, data: document })
  }

  async create(body, _user) {
    const result = await this.documentService.create(body)
    if (result.notFound) {
      throw ApplicationError.notFound(`${result.notFound} not found`)
    }
    return this.respondCreated({ success: true, data: result.document })
  }

  async verify(params, body, _user) {
    const result = await this.documentService.verify(params.id, body)
    if (!result) {
      throw ApplicationError.notFound('Document not found')
    }
    return this.respondOk({ success: true, data: result })
  }

  async remove(params, _user) {
    const result = await this.documentService.remove(params.id)
    if (!result) {
      throw ApplicationError.notFound('Document not found')
    }
    return this.respondOk({ success: true, message: 'Document deleted successfully' })
  }
}
