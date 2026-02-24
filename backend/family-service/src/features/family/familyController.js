/**
 * FamilyController — handles all /api/v1/families routes
 */

import { FamilyService } from './familyService.js'
import { FamilyRepository } from './familyRepository.js'
import { NotFoundError, BadRequestError } from '../../middleware/errorHandler.js'

export class FamilyController {
  /** @param {import('../../../../base/apiContext.js').ApiContext} ctx */
  constructor(ctx) {
    this.ctx = ctx
    this.req = ctx.req
    this.res = ctx.res
    const repo = new FamilyRepository()
    this.service = new FamilyService(repo)
  }

  async list() {
    const { req, res } = this
    const page   = parseInt(req.query.page)  || 1
    const limit  = parseInt(req.query.limit) || 20
    const status             = req.query.status
    const registrationStatus = req.query.registration_status

    const { families, total } = await this.service.list({ page, limit, status, registrationStatus })
    return res.json({
      success: true,
      data: families,
      pagination: { page, limit, total, total_pages: total ? Math.ceil(total / limit) : 0 },
    })
  }

  async get() {
    const { req, res } = this
    const family = await this.service.get(req.params.id)
    if (!family) throw new NotFoundError('Family not found')
    return res.json({ success: true, data: family })
  }

  async create() {
    const { req, res } = this
    const changedBy = req.headers['x-family-id'] || 'system'
    const result = await this.service.create(req.body, changedBy)
    return res.status(201).json({ success: true, data: result })
  }

  async update() {
    const { req, res } = this
    const changedBy = req.headers['x-family-id'] || 'system'
    const family = await this.service.update(req.params.id, req.body, changedBy)
    if (!family) throw new NotFoundError('Family not found')
    return res.json({ success: true, data: family })
  }

  async submit() {
    const { req, res } = this
    const changedBy = req.headers['x-family-id'] || 'system'
    try {
      const family = await this.service.submit(req.params.id, changedBy)
      if (!family) throw new NotFoundError('Family not found')
      return res.json({ success: true, data: family })
    } catch (err) {
      if (err instanceof NotFoundError) throw err
      throw new BadRequestError(err.message)
    }
  }

  async verify() {
    const { req, res } = this
    const changedBy = req.headers['x-family-id'] || 'system'
    try {
      const family = await this.service.verify(req.params.id, changedBy)
      if (!family) throw new NotFoundError('Family not found')
      return res.json({ success: true, data: family })
    } catch (err) {
      if (err instanceof NotFoundError) throw err
      throw new BadRequestError(err.message)
    }
  }

  async reject() {
    const { req, res } = this
    const changedBy = req.headers['x-family-id'] || 'system'
    const { reason } = req.body
    try {
      const family = await this.service.reject(req.params.id, reason, changedBy)
      if (!family) throw new NotFoundError('Family not found')
      return res.json({ success: true, data: family })
    } catch (err) {
      if (err instanceof NotFoundError) throw err
      throw new BadRequestError(err.message)
    }
  }

  async history() {
    const { req, res } = this
    const data = await this.service.history(req.params.id)
    return res.json({ success: true, data })
  }

  async remove() {
    const { req, res } = this
    const changedBy = req.headers['x-family-id'] || 'system'
    const family = await this.service.remove(req.params.id, changedBy)
    if (!family) throw new NotFoundError('Family not found')
    return res.json({ success: true, message: 'Family archived successfully' })
  }
}
