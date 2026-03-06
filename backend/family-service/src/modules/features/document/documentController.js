/**
 * DocumentController — handles /api/v1/documents routes
 */

import { BaseController } from '../../../../../base/baseController.js'
import { ApplicationError } from '../../../../../base/applicationError.js'
import { DocumentService } from './documentService.js'
import { DocumentRepository } from './documentRepository.js'

export class DocumentController extends BaseController {
  /** @param {import('../../../../../base/apiContext.js').ApiContext} ctx */
  constructor(ctx) {
    super(ctx)
    const repo = new DocumentRepository()
    this.service = new DocumentService(repo)
  }

  async listByFamily() {
    const data = await this.service.listByFamily(this.context.req.params.familyId)
    return this.respondOk({ success: true, data })
  }

  async listByMember() {
    const data = await this.service.listByMember(this.context.req.params.memberId)
    return this.respondOk({ success: true, data })
  }

  async get() {
    const document = await this.service.get(this.context.req.params.id)
    if (!document) throw ApplicationError.notFound('Document not found')
    return this.respondOk({ success: true, data: document })
  }

  async create() {
    const result = await this.service.create(this.context.req.body)
    if (result.notFound) throw ApplicationError.notFound(`${result.notFound} not found`)
    return this.respondCreated({ success: true, data: result.document })
  }

  async verify() {
    const result = await this.service.verify(this.context.req.params.id, this.context.req.body)
    if (!result) throw ApplicationError.notFound('Document not found')
    return this.respondOk({ success: true, data: result })
  }

  async remove() {
    const result = await this.service.remove(this.context.req.params.id)
    if (!result) throw ApplicationError.notFound('Document not found')
    return this.respondOk({ success: true, message: 'Document deleted successfully' })
  }
}
