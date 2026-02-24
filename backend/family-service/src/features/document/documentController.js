/**
 * DocumentController — handles /api/v1/documents routes
 */

import { DocumentService } from './documentService.js'
import { DocumentRepository } from './documentRepository.js'
import { NotFoundError } from '../../middleware/errorHandler.js'

export class DocumentController {
  /** @param {import('../../../../base/apiContext.js').ApiContext} ctx */
  constructor(ctx) {
    this.ctx = ctx
    this.req = ctx.req
    this.res = ctx.res
    const repo = new DocumentRepository()
    this.service = new DocumentService(repo)
  }

  async listByFamily() {
    const data = await this.service.listByFamily(this.req.params.familyId)
    return this.res.json({ success: true, data })
  }

  async listByMember() {
    const data = await this.service.listByMember(this.req.params.memberId)
    return this.res.json({ success: true, data })
  }

  async get() {
    const document = await this.service.get(this.req.params.id)
    if (!document) throw new NotFoundError('Document not found')
    return this.res.json({ success: true, data: document })
  }

  async create() {
    const result = await this.service.create(this.req.body)
    if (result.notFound) throw new NotFoundError(`${result.notFound} not found`)
    return this.res.status(201).json({ success: true, data: result.document })
  }

  async verify() {
    const result = await this.service.verify(this.req.params.id, this.req.body)
    if (!result) throw new NotFoundError('Document not found')
    return this.res.json({ success: true, data: result })
  }

  async remove() {
    const result = await this.service.remove(this.req.params.id)
    if (!result) throw new NotFoundError('Document not found')
    return this.res.json({ success: true, message: 'Document deleted successfully' })
  }
}

