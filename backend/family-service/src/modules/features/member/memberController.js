/**
 * MemberController — handles /api/v1/members routes
 */

import { BaseController } from '../../../../../base/baseController.js'
import { ApplicationError } from '../../../../../base/applicationError.js'
import { MemberService } from './memberService.js'
import { MemberRepository } from './memberRepository.js'

export class MemberController extends BaseController {
  /** @param {import('../../../../../base/apiContext.js').ApiContext} ctx */
  constructor(ctx) {
    super(ctx)
    const repo = new MemberRepository()
    this.service = new MemberService(repo)
  }

  async listByFamily() {
    const members = await this.service.listByFamily(this.context.req.params.familyId)
    if (members === null) throw ApplicationError.notFound('Family not found')
    this.respondOk({ success: true, data: members })
  }

  /** Public lookup — used by IAM service */
  async lookup() {
    const nationalIdRaw = typeof this.context.req.query.national_id === 'string' ? this.context.req.query.national_id : ''
    try {
      const member = await this.service.lookup(nationalIdRaw)
      if (!member) return this.respondNotFound({ success: false, error: 'Member not found' })
      this.respondOk({ success: true, data: member })
    } catch (err) {
      this.respondBadRequest({ success: false, error: err.message })
    }
  }

  async get() {
    const member = await this.service.get(this.context.req.params.id)
    if (!member) throw ApplicationError.notFound('Member not found')
    this.respondOk({ success: true, data: member })
  }

  async create() {
    const changedBy = this.context.req.headers['x-family-id'] || 'system'
    try {
      const result = await this.service.create(this.context.req.body, changedBy)
      if (result.notFound) throw ApplicationError.notFound('Family not found')
      this.respondCreated({ success: true, data: result.member })
    } catch (err) {
      if (err instanceof ApplicationError) throw err
      throw ApplicationError.badRequest(err.message)
    }
  }

  async update() {
    const changedBy = this.context.req.headers['x-family-id'] || 'system'
    const member = await this.service.update(this.context.req.params.id, this.context.req.body, changedBy)
    if (!member) throw ApplicationError.notFound('Member not found')
    this.respondOk({ success: true, data: member })
  }

  async remove() {
    const changedBy = this.context.req.headers['x-family-id'] || 'system'
    try {
      const result = await this.service.remove(this.context.req.params.id, changedBy)
      if (!result) throw ApplicationError.notFound('Member not found')
      this.respondOk({ success: true, message: 'Member deleted successfully' })
    } catch (err) {
      if (err instanceof ApplicationError) throw err
      throw ApplicationError.badRequest(err.message)
    }
  }
}
