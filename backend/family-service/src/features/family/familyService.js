/**
 * FamilyService — business logic for the family feature
 */

export class FamilyService {
  /** @param {import('./familyRepository.js').FamilyRepository} repo */
  constructor(repo) {
    this.repo = repo
  }

  async list({ page, limit, status, registrationStatus }) {
    const { data, error, count } = await this.repo.list({ page, limit, status, registrationStatus })
    if (error) throw new Error(error.message)
    return { families: data || [], total: count || 0 }
  }

  async get(uuid) {
    const { data: family, error: familyError } = await this.repo.getById(uuid)
    if (familyError || !family) return null

    const [membersRes, addressRes, docsRes] = await Promise.all([
      this.repo.getMembersByFamily(uuid),
      this.repo.getAddressByFamily(uuid),
      this.repo.getDocumentsByFamily(uuid),
    ])

    return {
      ...family,
      members:   membersRes.data  || [],
      address:   addressRes.data  || null,
      documents: docsRes.data     || [],
    }
  }

  async create({ address, head_member, household_size, geo_code, vulnerability_flag, intake_channel }, changedBy) {
    let addressId = null

    if (address) {
      const { data: addr, error: addrErr } = await this.repo.createAddress({
        line1:       address.line1,
        line2:       address.line2       || null,
        city:        address.city        || null,
        region:      address.region      || null,
        postal_code: address.postal_code || null,
        country:     address.country     || 'Tanzania',
        latitude:    address.latitude    || null,
        longitude:   address.longitude   || null,
      })
      if (addrErr) throw new Error(`Failed to create address: ${addrErr.message}`)
      addressId = addr.address_id
    }

    const { data: family, error: familyError } = await this.repo.create({
      permanent_address_id: addressId,
      household_size:  household_size  || 1,
      geo_code:        geo_code        || null,
      vulnerability_flag: vulnerability_flag || false,
      status:           'active',
      intake_channel:  intake_channel  || 'web_portal',
      registration_status: 'draft',
    })
    if (familyError) throw new Error(`Failed to create family: ${familyError.message}`)

    const { data: headMember, error: memberError } = await this.repo.createMember({
      family_uuid:           family.uuid,
      national_id:           head_member.national_id  || null,
      first_name:            head_member.first_name,
      last_name:             head_member.last_name,
      date_of_birth:         head_member.date_of_birth || null,
      gender:                head_member.gender        || null,
      relationship_to_head: 'head',
      current_address_id:   addressId,
      alive_flag:           true,
      marital_status:        head_member.marital_status || null,
    })
    if (memberError) throw new Error(`Failed to create head member: ${memberError.message}`)

    await this.repo.logHistory(family.uuid, 'create', changedBy, null, { family, head_member: headMember, address: addressId ? { address_id: addressId } : null }, 'Family created')
    await this.repo.publishEvent('FAMILY_CREATED', 'family', family.uuid, { family_id: family.family_id, uuid: family.uuid })

    return { uuid: family.uuid, family_id: family.family_id, head_member_id: headMember.member_id, address_id: addressId }
  }

  async update(uuid, updates, changedBy) {
    const { data: oldData, error: fetchError } = await this.repo.getById(uuid)
    if (fetchError || !oldData) return null

    const { data: family, error: updateError } = await this.repo.update(uuid, updates)
    if (updateError) throw new Error(updateError.message)

    await this.repo.logHistory(uuid, 'update', changedBy, oldData, family, 'Family updated')
    if (updates.registration_status && updates.registration_status !== oldData.registration_status) {
      await this.repo.publishEvent('FAMILY_STATUS_CHANGED', 'family', uuid, { old_status: oldData.registration_status, new_status: updates.registration_status })
    }

    return family
  }

  async submit(uuid, changedBy) {
    const { data: family, error: fetchError } = await this.repo.getById(uuid)
    if (fetchError || !family) return null
    if (family.registration_status !== 'draft') throw new Error('Family is not in draft status')

    const { data: headMember } = await this.repo.getHeadMember(uuid)
    if (!headMember) throw new Error('Family must have a head member')
    if (!family.permanent_address_id) throw new Error('Family must have a permanent address')

    const { data: updated, error: updateError } = await this.repo.update(uuid, {
      registration_status: 'pending_verification',
      submitted_at: new Date().toISOString(),
    })
    if (updateError) throw new Error(updateError.message)

    await this.repo.logHistory(uuid, 'submit', changedBy, family, updated, 'Family submitted for verification')
    await this.repo.publishEvent('FAMILY_SUBMITTED', 'family', uuid, { family_id: family.family_id, submitted_at: updated.submitted_at })

    return updated
  }

  async verify(uuid, changedBy) {
    const { data: family, error: fetchError } = await this.repo.getById(uuid)
    if (fetchError || !family) return null
    if (family.registration_status !== 'pending_verification') throw new Error('Family is not pending verification')

    const { data: updated, error: updateError } = await this.repo.update(uuid, {
      registration_status: 'verified',
      verified_at: new Date().toISOString(),
    })
    if (updateError) throw new Error(updateError.message)

    await this.repo.logHistory(uuid, 'verify', changedBy, family, updated, 'Family verified')
    await this.repo.publishEvent('FAMILY_VERIFIED', 'family', uuid, { family_id: family.family_id, verified_at: updated.verified_at })

    return updated
  }

  async reject(uuid, reason, changedBy) {
    if (!reason) throw new Error('Rejection reason is required')
    const { data: family, error: fetchError } = await this.repo.getById(uuid)
    if (fetchError || !family) return null
    if (family.registration_status !== 'pending_verification') throw new Error('Family is not pending verification')

    const { data: updated, error: updateError } = await this.repo.update(uuid, { registration_status: 'rejected' })
    if (updateError) throw new Error(updateError.message)

    await this.repo.logHistory(uuid, 'reject', changedBy, family, updated, reason)
    await this.repo.publishEvent('FAMILY_REJECTED', 'family', uuid, { family_id: family.family_id, rejection_reason: reason })

    return updated
  }

  async history(uuid) {
    const { data, error } = await this.repo.getHistory(uuid)
    if (error) throw new Error(error.message)
    return data || []
  }

  async remove(uuid, changedBy) {
    const { data: family, error: fetchError } = await this.repo.getById(uuid)
    if (fetchError || !family) return null

    const { data: updated, error: updateError } = await this.repo.update(uuid, { status: 'archived' })
    if (updateError) throw new Error(updateError.message)

    await this.repo.logHistory(uuid, 'delete', changedBy, family, updated, 'Family archived')
    await this.repo.publishEvent('FAMILY_ARCHIVED', 'family', uuid, { family_id: family.family_id })

    return updated
  }
}
