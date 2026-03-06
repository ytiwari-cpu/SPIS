import { BaseController } from '../../../../../base/baseController.js'
import { EngineService }    from './engineService.js'
import { EngineRepository } from './engineRepository.js'

export class EngineController extends BaseController {
  constructor(ctx) {
    super(ctx)
    const repo = new EngineRepository(ctx)
    this.service = new EngineService(repo)
  }

  async evaluate() {
    try {
      const { subject_id, subject_type } = this.context.request.body
      if (!subject_id || !subject_type) {
        this.respondBadRequest({ success: false, error: 'subject_id and subject_type are required' })
        return
      }
      const data = await this.service.evaluate(
        this.context.request.params.programmeId,
        subject_id,
        subject_type,
      )
      this.respondOk({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async evaluateAll() {
    try {
      const data = await this.service.evaluateAll(this.context.request.params.programmeId)
      this.respondOk({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async impact() {
    try {
      const data = await this.service.impactAnalysis(this.context.request.params.programmeId)
      this.respondOk({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }
}
