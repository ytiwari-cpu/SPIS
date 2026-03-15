/**
 * AddressController — handles /api/v1/addresses routes
 */

import { BaseController }   from '../../../../base/baseController.js'
import { ApplicationError } from '../../../../base/applicationError.js'
import { AddressService }   from './addressService.js'

export class AddressController extends BaseController {
  /** @param {import('../../../../base/apiContext.js').ApiContext} context */
  constructor(context) {
    super(context)
    this.addressService = new AddressService(context)
  }

  async get(params) {
    const address = await this.addressService.get(params.id)
    if (!address) {
      throw ApplicationError.notFound('Address not found')
    }
    this.respondOk({ success: true, data: address })
  }

  async create(body) {
    const address = await this.addressService.create(body)
    this.respondCreated({ success: true, data: address })
  }

  async update(params, body) {
    const address = await this.addressService.update(params.id, body)
    if (!address) {
      throw ApplicationError.notFound('Address not found')
    }
    this.respondOk({ success: true, data: address })
  }

  async remove(params) {
    try {
      await this.addressService.remove(params.id)
      this.respondOk({ success: true, message: 'Address deleted successfully' })
    } catch (err) {
      this.respondBadRequest({ success: false, error: err.message })
    }
  }
}
