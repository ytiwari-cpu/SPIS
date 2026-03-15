import { BaseController } from '../../../../base/baseController.js'
import { EngineService }  from './engineService.js'

export class EngineController extends BaseController {
  constructor(context) {
    super(context)
    this.engineService = new EngineService(context)
  }

  async evaluate(params, body) {
    try {
      const { subject_id, subject_type } = body
      if (!subject_id || !subject_type) {
        this.respondBadRequest({ success: false, error: 'subject_id and subject_type are required' })
        return
      }
      const data = await this.engineService.evaluate(params.programmeId, subject_id, subject_type)
      this.respondOk({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async evaluateAll(params) {
    try {
      const data = await this.engineService.evaluateAll(params.programmeId)
      this.respondOk({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }

  async impact(params) {
    try {
      const data = await this.engineService.impactAnalysis(params.programmeId)
      this.respondOk({ success: true, data })
    } catch (err) {
      this.respondError({ success: false, error: err.message })
    }
  }
}
