import { BaseService }      from '../../../../base/baseService.js'
/**
 * MemberService — business logic for the member feature
 */

import { publishEvent }     from '../../services/eventService.js'
import { MemberRepository } from './memberRepository.js'

function normalizeNationalId(value) {
  return value.replace(/\D/g, '')
}

export class MemberService extends BaseService {
  constructor(context) {
    super(context)
    this.memberRepository = new MemberRepository(context)
  }

  async listByFamily(familyUuid) {
    const family = await this.memberRepository.getFamilyById(familyUuid)
    if (!family) {
      return null
    }

    const members = await this.memberRepository.listByFamily(familyUuid)
    return members || []
  }

  async lookup(nationalIdRaw) {
    const nationalId = normalizeNationalId(nationalIdRaw || '')
    if (!nationalId || nationalId.length !== 14) {
      throw new Error('national_id must be exactly 14 digits')
    }
    const member = await this.memberRepository.lookupByNationalId(nationalId)
    return member || null
  }

  async get(uuid) {
    const member = await this.memberRepository.getById(uuid)
    return member || null
  }

  async create(body, changedBy) {
    const family = await this.memberRepository.getFamilyById(body.family_id)
    if (!family) {
      return { notFound: true }
    }

    if (body.relationship_to_head === 'head') {
      const existingHead = await this.memberRepository.getHeadByFamily(body.family_id)
      if (existingHead) {
        throw new Error('A head member already exists for this family')
      }
    }

    const memberUuid = MemberService.generateUUID()
    await this.memberRepository.create({
      uuid:                 memberUuid,
      family_uuid:          body.family_id,
      national_id:          body.national_id          || null,
      first_name:           body.first_name,
      last_name:            body.last_name,
      date_of_birth:        body.date_of_birth        || null,
      gender:               body.gender               || null,
      relationship_to_head: body.relationship_to_head,
      alive_flag:           body.alive_flag !== undefined ? body.alive_flag : true,
      marital_status:       body.marital_status       || null,
      phone:                body.phone                || null,
      email:                body.email                || null,
    })

    const member = await this.memberRepository.getById(memberUuid)

    await this.memberRepository.logHistory({
      family_uuid: body.family_id,
      entity_type: 'family_member',
      entity_id:   memberUuid,
      action_type: 'create',
      changed_by:  changedBy,
      old_values:  null,
      new_values:  JSON.stringify(member),
      reason:      'Member added',
    })
    await publishEvent('MEMBER_CREATED', 'family_member', memberUuid, { member_id: member?.member_id, family_uuid: body.family_id })

    return { member }
  }

  async update(uuid, updates, changedBy) {
    const oldData = await this.memberRepository.getById(uuid)
    if (!oldData) {
      return null
    }

    updates.updated_at = new Date().toISOString()
    await this.memberRepository.update(uuid, updates)
    const member = await this.memberRepository.getById(uuid)

    await this.memberRepository.logHistory({
      family_uuid: oldData.family_uuid,
      entity_type: 'family_member',
      entity_id:   uuid,
      action_type: 'update',
      changed_by:  changedBy,
      old_values:  JSON.stringify(oldData),
      new_values:  JSON.stringify(member),
      reason:      'Member updated',
    })
    return member
  }

  async remove(uuid, changedBy) {
    const member = await this.memberRepository.getById(uuid)
    if (!member) {
      return null
    }
    if (member.relationship_to_head === 'head') {
      throw new Error('Cannot delete head member')
    }

    await this.memberRepository.remove(uuid)

    await this.memberRepository.logHistory({
      family_uuid: member.family_uuid,
      entity_type: 'family_member',
      entity_id:   uuid,
      action_type: 'delete',
      changed_by:  changedBy,
      old_values:  JSON.stringify(member),
      new_values:  null,
      reason:      'Member removed',
    })
    return true
  }
}
