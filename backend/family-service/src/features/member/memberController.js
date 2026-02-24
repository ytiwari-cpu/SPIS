/**
 * MemberController — handles /api/v1/members routes
 */

import { MemberService } from './memberService.js'
import { MemberRepository } from './memberRepository.js'
import { NotFoundError, BadRequestError } from '../../middleware/errorHandler.js'

export class MemberController {
  /** @param {import('../../../../base/apiContext.js').ApiContext} ctx */
  constructor(ctx) {
    this.ctx = ctx
    this.req = ctx.req
    this.res = ctx.res
    const repo = new MemberRepository()
    this.service = new MemberService(repo)
  }

  async listByFamily() {
    const { req, res } = this
    const members = await this.service.listByFamily(req.params.familyId)
    if (members === null) throw new NotFoundError('Family not found')
    return res.json({ success: true, data: members })
  }

  /** Public lookup — used by IAM service */
  async lookup() {
    const { req, res } = this
    const nationalIdRaw = typeof req.query.national_id === 'string' ? req.query.national_id : ''
    try {
      const member = await this.service.lookup(nationalIdRaw)
      if (!member) return res.status(404).json({ success: false, error: 'Member not found' })
      return res.json({ success: true, data: member })
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message })
    }
  }

  async get() {
    const { req, res } = this
    const member = await this.service.get(req.params.id)
    if (!member) throw new NotFoundError('Member not found')
    return res.json({ success: true, data: member })
  }

  async create() {
    const { req, res } = this
    const changedBy = req.headers['x-family-id'] || 'system'
    try {
      const result = await this.service.create(req.body, changedBy)
      if (result.notFound) throw new NotFoundError('Family not found')
      return res.status(201).json({ success: true, data: result.member })
    } catch (err) {
      if (err instanceof NotFoundError) throw err
      throw new BadRequestError(err.message)
    }
  }

  async update() {
    const { req, res } = this
    const changedBy = req.headers['x-family-id'] || 'system'
    const member = await this.service.update(req.params.id, req.body, changedBy)
    if (!member) throw new NotFoundError('Member not found')
    return res.json({ success: true, data: member })
  }

  async remove() {
    const { req, res } = this
    const changedBy = req.headers['x-family-id'] || 'system'
    try {
      const result = await this.service.remove(req.params.id, changedBy)
      if (!result) throw new NotFoundError('Member not found')
      return res.json({ success: true, message: 'Member deleted successfully' })
    } catch (err) {
      if (err instanceof NotFoundError) throw err
      throw new BadRequestError(err.message)
    }
  }
}
