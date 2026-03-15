import { BaseController }     from '../../../../base/baseController.js'
import { VariableService }    from './variableService.js'

export class VariableController extends BaseController {
  constructor(context) {
    super(context)
    this.variableService = new VariableService(context)
  }

  async list() {
    try {
      this.respondOk({ success: true, data: await this.variableService.listAll() })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async listGrouped() {
    try {
      this.respondOk({ success: true, data: await this.variableService.listGrouped() })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async refresh() {
    try {
      const data = await this.variableService.refresh()
      this.respondOk({ success: true, message: 'Variable catalog refreshed', count: data.length, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }
}
