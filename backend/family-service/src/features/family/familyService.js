import { BaseService }       from '../../../../base/baseService.js'
import { FamilyRepository }  from './familyRepository.js'
/**
 * FamilyService — business logic for the family feature
 */

export class FamilyService extends BaseService {
  constructor(context) {
    super(context)
    this.familyRepository = new FamilyRepository(context)
  }

  async list({ page, limit, status, registrationStatus }) {
    const parsedPage  = parseInt(page, 10)  || 1
    const parsedLimit = parseInt(limit, 10) || 20
    const { data, count } = await this.familyRepository.list({
      page: parsedPage, limit: parsedLimit, status, registrationStatus,
    })
    const total = count || 0
    return {
      families:   data || [],
      total,
      pagination: {
        page:        parsedPage,
        limit:       parsedLimit,
        total,
        total_pages: total ? Math.ceil(total / parsedLimit) : 0,
      },
    }
  }

  async get(uuid) {
    const family = await this.familyRepository.getById(uuid)
    if (!family) {
      return null
    }

    const [members, address, mailingAddress, documents] = await Promise.all([
      this.familyRepository.getMembersByFamily(uuid),
      this.familyRepository.getAddressByFamily(uuid),
      this.familyRepository.getMailingAddressByFamily(uuid),
      this.familyRepository.getDocumentsByFamily(uuid),
    ])

    return {
      ...family,
      members:         members         || [],
      address:         address         || null,
      mailing_address: mailingAddress  || null,
      documents:       documents       || [],
    }
  }

  async create({ address, head_member, household_size, geo_code, vulnerability_flag, intake_channel }, changedBy) {
    let addressId = null

    if (address) {
      const addrUuid = FamilyService.generateUUID()
      await this.familyRepository.createAddress({
        uuid:        addrUuid,
        line1:       address.line1,
        line2:       address.line2       || null,
        city:        address.city        || null,
        region:      address.region      || null,
        postal_code: address.postal_code || null,
        country:     address.country     || 'Tanzania',
        latitude:    address.latitude    || null,
        longitude:   address.longitude   || null,
      })
      addressId = addrUuid
    }

    const familyUuid = FamilyService.generateUUID()
    await this.familyRepository.create({
      uuid:                 familyUuid,
      permanent_address_id: addressId,
      household_size:       household_size  || 1,
      geo_code:             geo_code        || null,
      vulnerability_flag:   vulnerability_flag || false,
      status:               'active',
      intake_channel:       intake_channel  || 'web_portal',
      registration_status:  'draft',
    })

    const family = await this.familyRepository.getById(familyUuid)

    const memberUuid = FamilyService.generateUUID()
    await this.familyRepository.createMember({
      uuid:                 memberUuid,
      family_uuid:          familyUuid,
      national_id:          head_member.national_id  || null,
      first_name:           head_member.first_name,
      last_name:            head_member.last_name,
      date_of_birth:        head_member.date_of_birth || null,
      gender:               head_member.gender        || null,
      relationship_to_head: 'head',
      current_address_id:   addressId,
      alive_flag:           true,
      marital_status:       head_member.marital_status || null,
    })

    await this.familyRepository.logHistory({
      family_uuid: familyUuid,
      entity_type: 'family',
      entity_id:   familyUuid,
      action_type: 'create',
      changed_by:  changedBy,
      old_values:  null,
      new_values:  JSON.stringify({ family_uuid: familyUuid }),
      reason:      'Family created',
    })
    await this.familyRepository.publishEvent({
      event_type:  'FAMILY_CREATED',
      entity_type: 'family',
      entity_id:   familyUuid,
      payload:     JSON.stringify({ family_id: family?.family_id, uuid: familyUuid }),
    })

    return { uuid: familyUuid, family_id: family?.family_id, head_member_id: memberUuid, address_id: addressId }
  }

  async update(uuid, updates, changedBy) {
    const oldData = await this.familyRepository.getById(uuid)
    if (!oldData) {
      return null
    }

    updates.updated_at = new Date().toISOString()
    await this.familyRepository.update(uuid, updates)
    const family = await this.familyRepository.getById(uuid)

    await this.familyRepository.logHistory({
      family_uuid: uuid,
      entity_type: 'family',
      entity_id:   uuid,
      action_type: 'update',
      changed_by:  changedBy,
      old_values:  JSON.stringify(oldData),
      new_values:  JSON.stringify(family),
      reason:      'Family updated',
    })

    if (updates.registration_status && updates.registration_status !== oldData.registration_status) {
      await this.familyRepository.publishEvent({
        event_type:  'FAMILY_STATUS_CHANGED',
        entity_type: 'family',
        entity_id:   uuid,
        payload:     JSON.stringify({
          old_status: oldData.registration_status,
          new_status: updates.registration_status,
        }),
      })
    }

    return family
  }

  async submit(uuid, changedBy) {
    const family = await this.familyRepository.getById(uuid)
    if (!family) {
      return null
    }
    if (family.registration_status !== 'draft') {
      throw new Error('Family is not in draft status')
    }

    const headMember = await this.familyRepository.getHeadMember(uuid)
    if (!headMember) {
      throw new Error('Family must have a head member')
    }
    if (!family.permanent_address_id) {
      throw new Error('Family must have a permanent address')
    }

    await this.familyRepository.update(uuid, {
      registration_status: 'pending_verification',
      submitted_at:        new Date().toISOString(),
      updated_at:          new Date().toISOString(),
    })
    const updated = await this.familyRepository.getById(uuid)

    await this.familyRepository.logHistory({
      family_uuid: uuid,
      entity_type: 'family',
      entity_id:   uuid,
      action_type: 'submit',
      changed_by:  changedBy,
      old_values:  JSON.stringify(family),
      new_values:  JSON.stringify(updated),
      reason:      'Family submitted for verification',
    })
    await this.familyRepository.publishEvent({
      event_type:  'FAMILY_SUBMITTED',
      entity_type: 'family',
      entity_id:   uuid,
      payload:     JSON.stringify({ family_id: family.family_id, submitted_at: updated?.submitted_at }),
    })

    return updated
  }

  async verify(uuid, changedBy) {
    const family = await this.familyRepository.getById(uuid)
    if (!family) {
      return null
    }
    if (family.registration_status !== 'pending_verification') {
      throw new Error('Family is not pending verification')
    }

    await this.familyRepository.update(uuid, {
      registration_status: 'verified',
      verified_at:         new Date().toISOString(),
      updated_at:          new Date().toISOString(),
    })
    const updated = await this.familyRepository.getById(uuid)

    await this.familyRepository.logHistory({
      family_uuid: uuid,
      entity_type: 'family',
      entity_id:   uuid,
      action_type: 'verify',
      changed_by:  changedBy,
      old_values:  JSON.stringify(family),
      new_values:  JSON.stringify(updated),
      reason:      'Family verified',
    })
    await this.familyRepository.publishEvent({
      event_type:  'FAMILY_VERIFIED',
      entity_type: 'family',
      entity_id:   uuid,
      payload:     JSON.stringify({ family_id: family.family_id, verified_at: updated?.verified_at }),
    })

    return updated
  }

  async reject(uuid, reason, changedBy) {
    if (!reason) {
      throw new Error('Rejection reason is required')
    }
    const family = await this.familyRepository.getById(uuid)
    if (!family) {
      return null
    }
    if (family.registration_status !== 'pending_verification') {
      throw new Error('Family is not pending verification')
    }

    await this.familyRepository.update(uuid, { registration_status: 'rejected', updated_at: new Date().toISOString() })
    const updated = await this.familyRepository.getById(uuid)

    await this.familyRepository.logHistory({
      family_uuid: uuid,
      entity_type: 'family',
      entity_id:   uuid,
      action_type: 'reject',
      changed_by:  changedBy,
      old_values:  JSON.stringify(family),
      new_values:  JSON.stringify(updated),
      reason,
    })
    await this.familyRepository.publishEvent({
      event_type:  'FAMILY_REJECTED',
      entity_type: 'family',
      entity_id:   uuid,
      payload:     JSON.stringify({ family_id: family.family_id, rejection_reason: reason }),
    })

    return updated
  }

  async history(uuid) {
    return await this.familyRepository.getHistory(uuid)
  }

  async remove(uuid, changedBy) {
    const family = await this.familyRepository.getById(uuid)
    if (!family) {
      return null
    }

    await this.familyRepository.update(uuid, { status: 'archived', updated_at: new Date().toISOString() })
    const updated = await this.familyRepository.getById(uuid)

    await this.familyRepository.logHistory({
      family_uuid: uuid,
      entity_type: 'family',
      entity_id:   uuid,
      action_type: 'delete',
      changed_by:  changedBy,
      old_values:  JSON.stringify(family),
      new_values:  JSON.stringify(updated),
      reason:      'Family archived',
    })
    await this.familyRepository.publishEvent({
      event_type:  'FAMILY_ARCHIVED',
      entity_type: 'family',
      entity_id:   uuid,
      payload:     JSON.stringify({ family_id: family.family_id }),
    })

    return updated
  }
}
