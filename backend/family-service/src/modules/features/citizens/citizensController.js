/**
 * CitizensController — handles /api/v1/citizens routes
 */

import { BaseController } from '../../../../../base/baseController.js'
import { ApplicationError } from '../../../../../base/applicationError.js'
import { CitizensService } from './citizensService.js'
import { CitizensRepository } from './citizensRepository.js'

export class CitizensController extends BaseController {
  /** @param {import('../../../../../base/apiContext.js').ApiContext} ctx */
  constructor(ctx) {
    super(ctx)
    const repo = new CitizensRepository()
    this.service = new CitizensService(repo)
  }

  async list() {
    const req = this.context.req
    const page   = Math.max(1, parseInt(req.query.page, 10)  || 1)
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20))
    const search = (req.query.search || '').trim()
    const status = (req.query.status || '').trim()
    const gender = (req.query.gender || '').trim()

    const { citizens, total } = await this.service.list({ page, limit, status, gender, search })

    return this.respondOk({
      success: true,
      data: citizens,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  }

  async get() {
    const citizen = await this.service.get(this.context.req.params.id)
    if (!citizen) throw ApplicationError.notFound('Citizen not found')
    return this.respondOk({ success: true, data: citizen })
  }
}
