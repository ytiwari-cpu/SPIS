/**
 * AddressService — business logic for the address feature
 */

export class AddressService {
  /** @param {import('./addressRepository.js').AddressRepository} repo */
  constructor(repo) {
    this.repo = repo
  }

  async get(addressId) {
    const { data, error } = await this.repo.getById(addressId)
    if (error || !data) return null
    return data
  }

  async create({ line1, line2, city, region, postal_code, country, latitude, longitude }) {
    const { data, error } = await this.repo.create({
      line1,
      line2:        line2        || null,
      city:         city         || null,
      region:       region       || null,
      postal_code:  postal_code  || null,
      country:      country      || 'Tanzania',
      latitude:     latitude     || null,
      longitude:    longitude    || null,
    })
    if (error) throw new Error(error.message)
    return data
  }

  async update(addressId, updates) {
    const { data: existing, error: fetchError } = await this.repo.getById(addressId)
    if (fetchError || !existing) return null

    const { data, error } = await this.repo.update(addressId, updates)
    if (error) throw new Error(error.message)
    return data
  }

  async remove(addressId) {
    const { data: familyRef } = await this.repo.getFamilyRef(addressId)
    if (familyRef && familyRef.length > 0) throw new Error('Cannot delete address that is used as a permanent address by a family')

    const { data: memberRef } = await this.repo.getMemberRef(addressId)
    if (memberRef && memberRef.length > 0) throw new Error('Cannot delete address that is used by a family member')

    const { error } = await this.repo.remove(addressId)
    if (error) throw new Error(error.message)
    return true
  }
}
