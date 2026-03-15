import { BaseService } from '../../../../base/baseService.js'
import { AddressRepository } from './addressRepository.js'
/**
 * AddressService — business logic for the address feature
 */

export class AddressService extends BaseService {
  /** @param {import('./addressRepository.js').AddressRepository} repo */
  constructor(context) {
    super(context)
    this.addressRepository = new AddressRepository(context)
  }

  async get(addressId) {
    return await this.addressRepository.getById(addressId)
  }

  async create({ line1, line2, city, region, postal_code, country, latitude, longitude }) {
    return await this.addressRepository.create({
      line1,
      line2:       line2        || null,
      city:        city         || null,
      region:      region       || null,
      postal_code: postal_code  || null,
      country:     country      || 'Tanzania',
      latitude:    latitude     || null,
      longitude:   longitude    || null,
    })
  }

  async update(addressId, updates) {
    const existing = await this.addressRepository.getById(addressId)
    if (!existing) {
      return null
    }
    return this.addressRepository.update(addressId, updates)
  }

  async remove(addressId) {
    const familyRef = await this.addressRepository.getFamilyRef(addressId)
    if (familyRef && familyRef.length > 0) {
      throw new Error('Cannot delete address that is used as a permanent address by a family')
    }

    const memberRef = await this.addressRepository.getMemberRef(addressId)
    if (memberRef && memberRef.length > 0) {
      throw new Error('Cannot delete address that is used by a family member')
    }

    await this.addressRepository.remove(addressId)
    return true
  }
}
