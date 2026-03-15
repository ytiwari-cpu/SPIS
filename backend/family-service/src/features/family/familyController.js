/**
 * FamilyController — handles all /api/v1/families routes
 */

import { BaseController }   from '../../../../base/baseController.js'
import { ApplicationError } from '../../../../base/applicationError.js'
import { FamilyService }    from './familyService.js'

export class FamilyController extends BaseController {
  /** @param {import('../../../../base/apiContext.js').ApiContext} context */
  constructor(context) {
    super(context)
    this.service = new FamilyService(context)
  }

  async list(query) {
    const result = await this.service.list({
      page:               query.page,
      limit:              query.limit,
      status:             query.status,
      registrationStatus: query.registration_status,
    })
    this.respondOk({
      success:    true,
      data:       result.families,
      pagination: result.pagination,
    })
  }

  async get(params) {
    const family = await this.service.get(params.id)
    if (!family) {
      throw ApplicationError.notFound('Family not found')
    }
    this.respondOk({ success: true, data: family })
  }

  async create(body, user) {
    const changedBy = user?.sub || 'system'
    const result    = await this.service.create(body, changedBy)
    this.respondCreated({ success: true, data: result })
  }

  async update(params, body, user) {
    const changedBy = user?.sub || 'system'
    const family    = await this.service.update(params.id, body, changedBy)
    if (!family) {
      throw ApplicationError.notFound('Family not found')
    }
    this.respondOk({ success: true, data: family })
  }

  async submit(params, user) {
    const changedBy = user?.sub || 'system'
    try {
      const family = await this.service.submit(params.id, changedBy)
      if (!family) {
        throw ApplicationError.notFound('Family not found')
      }
      this.respondOk({ success: true, data: family })
    } catch (err) {
      if (err instanceof ApplicationError) {
        throw err
      }
      throw ApplicationError.badRequest(err.message)
    }
  }

  async verify(params, user) {
    const changedBy = user?.sub || 'system'
    try {
      const family = await this.service.verify(params.id, changedBy)
      if (!family) {
        throw ApplicationError.notFound('Family not found')
      }
      this.respondOk({ success: true, data: family })
    } catch (err) {
      if (err instanceof ApplicationError) {
        throw err
      }
      throw ApplicationError.badRequest(err.message)
    }
  }

  async reject(params, body, user) {
    const changedBy = user?.sub || 'system'
    const { reason } = body
    try {
      const family = await this.service.reject(params.id, reason, changedBy)
      if (!family) {
        throw ApplicationError.notFound('Family not found')
      }
      this.respondOk({ success: true, data: family })
    } catch (err) {
      if (err instanceof ApplicationError) {
        throw err
      }
      throw ApplicationError.badRequest(err.message)
    }
  }

  async history(params) {
    const data = await this.service.history(params.id)
    this.respondOk({ success: true, data })
  }

  async remove(params, user) {
    const changedBy = user?.sub || 'system'
    const family    = await this.service.remove(params.id, changedBy)
    if (!family) {
      throw ApplicationError.notFound('Family not found')
    }
    this.respondOk({ success: true, message: 'Family archived successfully' })
  }
}
