import { BaseController }   from '../../../../base/baseController.js'
import { ProgrammeService } from './programmeService.js'

export class ProgrammeController extends BaseController {
  constructor(context) {
    super(context)
    this.programmeService = new ProgrammeService(context)
  }

  async list() {
    try {
      const data = await this.programmeService.list()
      this.respondOk({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async get(params) {
    try {
      const data = await this.programmeService.getById(params.id)
      if (!data) {
        this.respondNotFound({ success: false, error: 'Programme not found' })
        return
      }
      this.respondOk({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async create(body) {
    try {
      const data = await this.programmeService.create(body)
      this.respondCreated({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async update(params, body) {
    try {
      const data = await this.programmeService.update(params.id, body)
      this.respondOk({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async updateRulesTree(params, body) {
    try {
      const { rules_tree } = body
      const data = await this.programmeService.updateRulesTree(params.id, rules_tree)
      this.respondOk({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async activate(params) {
    try {
      const result = await this.programmeService.activate(params.id)
      if (!result.found) {
        this.respondNotFound({ success: false, error: 'Programme not found' })
        return
      }
      if (result.alreadyActive) {
        this.respondOk({ success: true, data: result.data, message: 'Already active' })
        return
      }
      if (result.invalid) {
        this.respondBadRequest({ success: false, error: 'Cannot activate programme without eligibility rules' })
        return
      }
      this.respondOk({ success: true, data: result.data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async delete(params) {
    try {
      await this.programmeService.softDelete(params.id)
      this.respondOk({ success: true, message: 'Programme deactivated' })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }
}
