import { BaseController }     from '../../../../base/baseController.js'
import { VariableService }    from './variableService.js'
import { VariableRepository } from './variableRepository.js'

export class VariableController extends BaseController {
  constructor(ctx) {
    super(ctx)
    const repo = new VariableRepository(ctx)
    this.service = new VariableService(repo)
  }

  async list() {
    try {
      this.respondOk({ success: true, data: await this.service.listAll() })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async listGrouped() {
    try {
      this.respondOk({ success: true, data: await this.service.listGrouped() })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async refresh() {
    try {
      const data = await this.service.refresh()
      this.respondOk({ success: true, message: 'Variable catalog refreshed', count: data.length, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }
}
