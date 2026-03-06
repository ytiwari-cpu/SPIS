/**
 * MemberService — business logic for the member feature
 */

import { publishEvent } from '../../../services/eventService.js'

function normalizeNationalId(value) {
  return value.replace(/\D/g, '')
}

export class MemberService {
  /** @param {import('./memberRepository.js').MemberRepository} repo */
  constructor(repo) {
    this.repo = repo
  }

  async listByFamily(familyUuid) {
    const { data: family, error: familyError } = await this.repo.getFamilyById(familyUuid)
    if (familyError || !family) return null

    const { data, error } = await this.repo.listByFamily(familyUuid)
    if (error) throw new Error(error.message)
    return data || []
  }

  async lookup(nationalIdRaw) {
    const nationalId = normalizeNationalId(nationalIdRaw || '')
    if (!nationalId || nationalId.length !== 14) throw new Error('national_id must be exactly 14 digits')
    const { data: member } = await this.repo.lookupByNationalId(nationalId)
    return member || null
  }

  async get(uuid) {
    const { data: member, error } = await this.repo.getById(uuid)
    if (error || !member) return null
    return member
  }

  async create(body, changedBy) {
    const { data: family, error: familyError } = await this.repo.getFamilyById(body.family_id)
    if (familyError || !family) return { notFound: true }

    if (body.relationship_to_head === 'head') {
      const { data: existingHead } = await this.repo.getHeadByFamily(body.family_id)
      if (existingHead) throw new Error('A head member already exists for this family')
    }

    const { data: member, error } = await this.repo.create({
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
    if (error) throw new Error(error.message)

    await this.repo.logHistory(body.family_id, 'create', changedBy, null, member, 'Member added')
    await publishEvent('MEMBER_CREATED', 'family_member', member.uuid, { member_id: member.member_id, family_uuid: body.family_id })

    return { member }
  }

  async update(uuid, updates, changedBy) {
    const { data: oldData, error: fetchError } = await this.repo.getById(uuid)
    if (fetchError || !oldData) return null

    const { data: member, error: updateError } = await this.repo.update(uuid, updates)
    if (updateError) throw new Error(updateError.message)

    await this.repo.logHistory(oldData.family_uuid, 'update', changedBy, oldData, member, 'Member updated')
    return member
  }

  async remove(uuid, changedBy) {
    const { data: member, error: fetchError } = await this.repo.getById(uuid)
    if (fetchError || !member) return null
    if (member.relationship_to_head === 'head') throw new Error('Cannot delete head member')

    const { error } = await this.repo.remove(uuid)
    if (error) throw new Error(error.message)

    await this.repo.logHistory(member.family_uuid, 'delete', changedBy, member, null, 'Member removed')
    return true
  }
}
