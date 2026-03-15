import { BaseController }    from '../../../../base/baseController.js'
import { CustomFieldService } from './customFieldService.js'

export class CustomFieldController extends BaseController {
  constructor(context) {
    super(context)
    this.customFieldService = new CustomFieldService(context)
  }

  async list() {
    try {
      const data = await this.customFieldService.list()
      this.respondOk({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async listByTable(params) {
    try {
      const data = await this.customFieldService.listByTable(params.table)
      this.respondOk({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async create(body, user) {
    try {
      const data = await this.customFieldService.create(body, user?.sub)
      this.respondCreated({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async update(params, body, user) {
    try {
      const data = await this.customFieldService.update(params.id, body, user?.sub)
      this.respondOk({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async delete(params) {
    try {
      await this.customFieldService.deactivate(params.id)
      this.respondOk({ success: true, message: 'Custom field deactivated' })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }
}
