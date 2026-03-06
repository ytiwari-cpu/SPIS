import { BaseController } from '../../../../../base/baseController.js'
import {
  createCustomField,
  getAllCustomFields,
  getCustomFieldsByTable,
  updateCustomField,
  deactivateCustomField,
} from '../../../services/customFieldManager.js'

export class CustomFieldController extends BaseController {
  constructor(ctx) {
    super(ctx)
  }

  async list() {
    try {
      const data = await getAllCustomFields()
      this.respondOk({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async listByTable() {
    try {
      const data = await getCustomFieldsByTable(this.context.request.params.table)
      this.respondOk({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async create() {
    try {
      const data = await createCustomField(this.context.request.body, this.context.user?.sub)
      this.respondCreated({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async update() {
    try {
      const data = await updateCustomField(this.context.request.params.id, this.context.request.body, this.context.user?.sub)
      this.respondOk({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async delete() {
    try {
      await deactivateCustomField(this.context.request.params.id)
      this.respondOk({ success: true, message: 'Custom field deactivated' })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }
}
