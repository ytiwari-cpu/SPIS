/**
 * CitizensController — handles /api/v1/citizens routes
 */

import { CitizensService } from './citizensService.js'
import { CitizensRepository } from './citizensRepository.js'

export class CitizensController {
  /** @param {import('../../../../base/apiContext.js').ApiContext} ctx */
  constructor(ctx) {
    this.ctx = ctx
    this.req = ctx.req
    this.res = ctx.res
    const repo = new CitizensRepository()
    this.service = new CitizensService(repo)
  }

  async list() {
    const { req, res } = this
    const page   = Math.max(1, parseInt(req.query.page, 10)  || 1)
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20))
    const search = (req.query.search || '').trim()
    const status = (req.query.status || '').trim()
    const gender = (req.query.gender || '').trim()

    const { citizens, total } = await this.service.list({ page, limit, status, gender, search })

    return res.json({
      success: true,
      data: citizens,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  }

  async get() {
    const { req, res } = this
    const citizen = await this.service.get(req.params.id)
    if (!citizen) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Citizen not found' } })
    }
    return res.json({ success: true, data: citizen })
  }
}

