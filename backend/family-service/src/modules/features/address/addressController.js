/**
 * AddressController — handles /api/v1/addresses routes
 */

import { BaseController } from '../../../../../base/baseController.js'
import { ApplicationError } from '../../../../../base/applicationError.js'
import { AddressService } from './addressService.js'
import { AddressRepository } from './addressRepository.js'

export class AddressController extends BaseController {
  /** @param {import('../../../../../base/apiContext.js').ApiContext} ctx */
  constructor(ctx) {
    super(ctx)
    const repo = new AddressRepository()
    this.service = new AddressService(repo)
  }

  async get() {
    const address = await this.service.get(this.context.req.params.id)
    if (!address) throw ApplicationError.notFound('Address not found')
    this.respondOk({ success: true, data: address })
  }

  async create() {
    const address = await this.service.create(this.context.req.body)
    this.respondCreated({ success: true, data: address })
  }

  async update() {
    const address = await this.service.update(this.context.req.params.id, this.context.req.body)
    if (!address) throw ApplicationError.notFound('Address not found')
    this.respondOk({ success: true, data: address })
  }

  async remove() {
    try {
      await this.service.remove(this.context.req.params.id)
      this.respondOk({ success: true, message: 'Address deleted successfully' })
    } catch (err) {
      this.respondBadRequest({ success: false, error: err.message })
    }
  }
}
