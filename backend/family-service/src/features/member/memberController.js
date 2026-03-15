/**
 * MemberController — handles /api/v1/members routes
 */

import { BaseController } from '../../../../base/baseController.js'
import { ApplicationError } from '../../../../base/applicationError.js'
import { MemberService } from './memberService.js'

export class MemberController extends BaseController {
  /** @param {import('../../../../base/apiContext.js').ApiContext} context */
  constructor(context) {
    super(context)
    this.memberService = new MemberService(context)
  }

  async listByFamily(params) {
    const members = await this.memberService.listByFamily(params.familyId)
    if (members === null) {
      throw ApplicationError.notFound('Family not found')
    }
    this.respondOk({ success: true, data: members })
  }

  /** Public lookup — used by IAM service */
  async lookup(query) {
    const nationalIdRaw = typeof query.national_id === 'string' ? query.national_id : ''
    try {
      const member = await this.memberService.lookup(nationalIdRaw)
      if (!member) {
        return this.respondNotFound({ success: false, error: 'Member not found' })
      }
      this.respondOk({ success: true, data: member })
    } catch (err) {
      this.respondBadRequest({ success: false, error: err.message })
    }
  }

  async get(params) {
    const member = await this.memberService.get(params.id)
    if (!member) {
      throw ApplicationError.notFound('Member not found')
    }
    this.respondOk({ success: true, data: member })
  }

  async create(body, user) {
    const changedBy = user?.sub || 'system'
    try {
      const result = await this.memberService.create(body, changedBy)
      if (result.notFound) {
        throw ApplicationError.notFound('Family not found')
      }
      this.respondCreated({ success: true, data: result.member })
    } catch (err) {
      if (err instanceof ApplicationError) {
        throw err
      }
      throw ApplicationError.badRequest(err.message)
    }
  }

  async update(params, body, user) {
    const changedBy = user?.sub || 'system'
    const member = await this.memberService.update(params.id, body, changedBy)
    if (!member) {
      throw ApplicationError.notFound('Member not found')
    }
    this.respondOk({ success: true, data: member })
  }

  async remove(params, user) {
    const changedBy = user?.sub || 'system'
    try {
      const result = await this.memberService.remove(params.id, changedBy)
      if (!result) {
        throw ApplicationError.notFound('Member not found')
      }
      this.respondOk({ success: true, message: 'Member deleted successfully' })
    } catch (err) {
      if (err instanceof ApplicationError) {
        throw err
      }
      throw ApplicationError.badRequest(err.message)
    }
  }
}
