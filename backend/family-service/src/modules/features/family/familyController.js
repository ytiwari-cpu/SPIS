/**
 * FamilyController — handles all /api/v1/families routes
 */

import { BaseController } from '../../../../../base/baseController.js'
import { ApplicationError } from '../../../../../base/applicationError.js'
import { FamilyService } from './familyService.js'
import { FamilyRepository } from './familyRepository.js'

export class FamilyController extends BaseController {
  /** @param {import('../../../../../base/apiContext.js').ApiContext} ctx */
  constructor(ctx) {
    super(ctx)
    const repo = new FamilyRepository()
    this.service = new FamilyService(repo)
  }

  async list() {
    const { req } = this.context
    const page   = parseInt(req.query.page)  || 1
    const limit  = parseInt(req.query.limit) || 20
    const status             = req.query.status
    const registrationStatus = req.query.registration_status

    const { families, total } = await this.service.list({ page, limit, status, registrationStatus })
    this.respondOk({
      success: true,
      data: families,
      pagination: { page, limit, total, total_pages: total ? Math.ceil(total / limit) : 0 },
    })
  }

  async get() {
    const family = await this.service.get(this.context.req.params.id)
    if (!family) throw ApplicationError.notFound('Family not found')
    this.respondOk({ success: true, data: family })
  }

  async create() {
    const changedBy = this.context.req.headers['x-family-id'] || 'system'
    const result = await this.service.create(this.context.req.body, changedBy)
    this.respondCreated({ success: true, data: result })
  }

  async update() {
    const changedBy = this.context.req.headers['x-family-id'] || 'system'
    const family = await this.service.update(this.context.req.params.id, this.context.req.body, changedBy)
    if (!family) throw ApplicationError.notFound('Family not found')
    this.respondOk({ success: true, data: family })
  }

  async submit() {
    const changedBy = this.context.req.headers['x-family-id'] || 'system'
    try {
      const family = await this.service.submit(this.context.req.params.id, changedBy)
      if (!family) throw ApplicationError.notFound('Family not found')
      this.respondOk({ success: true, data: family })
    } catch (err) {
      if (err instanceof ApplicationError) throw err
      throw ApplicationError.badRequest(err.message)
    }
  }

  async verify() {
    const changedBy = this.context.req.headers['x-family-id'] || 'system'
    try {
      const family = await this.service.verify(this.context.req.params.id, changedBy)
      if (!family) throw ApplicationError.notFound('Family not found')
      this.respondOk({ success: true, data: family })
    } catch (err) {
      if (err instanceof ApplicationError) throw err
      throw ApplicationError.badRequest(err.message)
    }
  }

  async reject() {
    const changedBy = this.context.req.headers['x-family-id'] || 'system'
    const { reason } = this.context.req.body
    try {
      const family = await this.service.reject(this.context.req.params.id, reason, changedBy)
      if (!family) throw ApplicationError.notFound('Family not found')
      this.respondOk({ success: true, data: family })
    } catch (err) {
      if (err instanceof ApplicationError) throw err
      throw ApplicationError.badRequest(err.message)
    }
  }

  async history() {
    const data = await this.service.history(this.context.req.params.id)
    this.respondOk({ success: true, data })
  }

  async remove() {
    const changedBy = this.context.req.headers['x-family-id'] || 'system'
    const family = await this.service.remove(this.context.req.params.id, changedBy)
    if (!family) throw ApplicationError.notFound('Family not found')
    this.respondOk({ success: true, message: 'Family archived successfully' })
  }
}
