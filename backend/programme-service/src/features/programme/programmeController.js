import { BaseController }    from '../../../../base/baseController.js'
import { ProgrammeService }  from './programmeService.js'
import { ProgrammeRepository } from './programmeRepository.js'
import { createProgrammeSchema, updateProgrammeSchema } from '../../validators/programme.validators.js'

export class ProgrammeController extends BaseController {
  constructor(ctx) {
    super(ctx)
    const repo = new ProgrammeRepository(ctx)
    this.service = new ProgrammeService(repo)
  }

  async list() {
    try {
      const data = await this.service.list()
      this.respondOk({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async get() {
    try {
      const data = await this.service.getById(this.context.request.params.id)
      if (!data) { this.respondNotFound({ success: false, error: 'Programme not found' }); return }
      this.respondOk({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async create() {
    try {
      const parsed = createProgrammeSchema.parse(this.context.request.body)
      const data   = await this.service.create(parsed)
      this.respondCreated({ success: true, data })
    } catch (err) {
      if (err?.name === 'ZodError') {
        this.respondBadRequest({ success: false, error: 'Validation failed', details: err }); return
      }
      this.respondError({ success: false, error: err.message })
    }
  }

  async update() {
    try {
      const parsed = updateProgrammeSchema.parse(this.context.request.body)
      const data   = await this.service.update(this.context.request.params.id, parsed)
      this.respondOk({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async updateRulesTree() {
    try {
      const { rules_tree } = this.context.request.body
      const data = await this.service.updateRulesTree(this.context.request.params.id, rules_tree)
      this.respondOk({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async activate() {
    try {
      const result = await this.service.activate(this.context.request.params.id)
      if (!result.found) { this.respondNotFound({ success: false, error: 'Programme not found' }); return }
      if (result.alreadyActive) { this.respondOk({ success: true, data: result.data, message: 'Already active' }); return }
      if (result.invalid) {
        this.respondBadRequest({ success: false, error: 'Cannot activate programme without eligibility rules' }); return
      }
      this.respondOk({ success: true, data: result.data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async delete() {
    try {
      await this.service.softDelete(this.context.request.params.id)
      this.respondOk({ success: true, message: 'Programme deactivated' })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }
}
