/**
 * CitizensController — handles /api/v1/citizens routes
 */

import { BaseController } from '../../../../base/baseController.js'
import { ApplicationError } from '../../../../base/applicationError.js'
import { CitizensService } from './citizensService.js'

export class CitizensController extends BaseController {
  /** @param {import('../../../../base/apiContext.js').ApiContext} context */
  constructor(context) {
    super(context)
    this.citizensService = new CitizensService(context)
  }

  async list(query) {
    const result = await this.citizensService.list({
      page:   query.page,
      limit:  query.limit,
      status: query.status,
      gender: query.gender,
      search: query.search,
    })

    return this.respondOk({
      success:    true,
      data:       result.citizens,
      pagination: result.pagination,
    })
  }

  async get(params) {
    const citizen = await this.citizensService.get(params.id)
    if (!citizen) {
      throw ApplicationError.notFound('Citizen not found')
    }
    return this.respondOk({ success: true, data: citizen })
  }
}
