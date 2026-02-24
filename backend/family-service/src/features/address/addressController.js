/**
 * AddressController — handles /api/v1/addresses routes
 */

import { AddressService } from './addressService.js'
import { AddressRepository } from './addressRepository.js'
import { NotFoundError } from '../../middleware/errorHandler.js'

export class AddressController {
  /** @param {import('../../../../base/apiContext.js').ApiContext} ctx */
  constructor(ctx) {
    this.ctx = ctx
    this.req = ctx.req
    this.res = ctx.res
    const repo = new AddressRepository()
    this.service = new AddressService(repo)
  }

  async get() {
    const address = await this.service.get(this.req.params.id)
    if (!address) throw new NotFoundError('Address not found')
    return this.res.json({ success: true, data: address })
  }

  async create() {
    const address = await this.service.create(this.req.body)
    return this.res.status(201).json({ success: true, data: address })
  }

  async update() {
    const address = await this.service.update(this.req.params.id, this.req.body)
    if (!address) throw new NotFoundError('Address not found')
    return this.res.json({ success: true, data: address })
  }

  async remove() {
    try {
      await this.service.remove(this.req.params.id)
      return this.res.json({ success: true, message: 'Address deleted successfully' })
    } catch (err) {
      return this.res.status(400).json({ success: false, error: err.message })
    }
  }
}

