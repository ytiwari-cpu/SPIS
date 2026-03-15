import { RegistrationRepository } from './registrationRepository.js'
/**
 * Registration Service
 *
 * Business logic for the 9-step family registration wizard.
 * Delegates all DB operations to RegistrationRepository.
 * Imports historyService and eventService as shared domain utilities.
 */

import { BaseService } from '../../../../base/baseService.js'
import { ApplicationError } from '../../../../base/applicationError.js'
import {
  writeHistory,
  updateHistoryEntry,
  submitHistoryEntry,
} from '../../services/historyService.js'
import { publishEvent } from '../../services/eventService.js'

export class RegistrationService extends BaseService {
  constructor(context) {
    super(context)
    this.registrationRepository = new RegistrationRepository(context)
  }

  get userId() {
    return this.context.request?.headers?.['x-user-id'] || 'system'
  }

  // ─── FAMILY ──────────────────────────────────────────────

  async getFamilyForEditing(familyUuid) {
    const family = await this.registrationRepository.findFamilyByUuid(familyUuid)
    if (!family) {
      throw ApplicationError.notFound('Family not found.')
    }

    const [address, mailingAddress, houseServices, members] = await Promise.all([
      this.registrationRepository.findAddress('FAMILY', familyUuid, 'PERMANENT'),
      this.registrationRepository.findAddress('FAMILY', familyUuid, 'MAILING'),
      this.registrationRepository.findHouseServices(familyUuid),
      this.registrationRepository.findMembersByFamily(familyUuid),
    ])

    // Enrich members with their addresses
    const memberUuids = members.map(m => m.uuid)
    const memberAddresses = await this.registrationRepository.findAddressesByMembers(memberUuids)
    const addrByMember = {}
    for (const a of memberAddresses) {
      addrByMember[a.entity_id] = a
    }
    const enrichedMembers = members.map(m => ({
      ...m,
      current_address: addrByMember[m.uuid] || null,
    }))

    return { family, address, mailing_address: mailingAddress, house_services: houseServices, members: enrichedMembers }
  }

  async updateFamily(familyUuid, body) {
    const family = await this.registrationRepository.findFamilyByUuid(familyUuid)
    if (!family) {
      throw ApplicationError.notFound('Family not found.')
    }

    const updateData = {}
    const fields = [
      // Confirmed columns in family.family table
      'household_size', 'status', 'intake_channel',
      'head_first_name', 'head_last_name', 'head_middle_names',
      'head_alias', 'head_mothers_maiden_name',
      'phone', 'email', 'geo_code', 'vulnerability_flag',
      'registration_status',
      'programme', 'payment_option',
      'social_worker_zone', 'social_worker_code',
      'application_no', 'constituency_code',
      'mailing_address_different', 'directions_to_house',
      'submitted_at', 'verified_at',
    ]
    for (const f of fields) {
      if (body[f] !== undefined) {
        updateData[f] = body[f]
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw ApplicationError.badRequest('No fields to update.')
    }

    updateData.updated_at = new Date().toISOString()
    return this.registrationRepository.updateFamily(familyUuid, updateData)
  }

  async createFamily(body) {
    // Validate required fields
    if (!body.head_first_name?.trim()) {
      throw ApplicationError.badRequest('head_first_name is required')
    }
    if (!body.head_last_name?.trim()) {
      throw ApplicationError.badRequest('head_last_name is required')
    }

    // Validate NID if provided
    if (body.head_national_id) {
      const nid = body.head_national_id.replace(/\D/g, '')
      if (nid.length !== 14) {
        throw ApplicationError.badRequest('National ID must be 14 digits')
      }
      // Check uniqueness
      const existing = await this.registrationRepository.findMemberByNationalId(nid)
      if (existing) {
        throw ApplicationError.conflict('National ID is already registered')
      }
    }

    // Validate email if provided
    if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      throw ApplicationError.badRequest('Invalid email format')
    }

    // Generate family_id
    const familyId = await this.registrationRepository.generateFamilyId()

    const familyUuid = RegistrationService.generateUUID()

    // Build family_name from head name if not supplied
    const familyName = body.family_name?.trim() || `${body.head_first_name.trim()} ${body.head_last_name.trim()}`

    // Create placeholder permanent address first (family.permanent_address_id is NOT NULL FK)
    const addrId = RegistrationService.generateUUID()
    await this.registrationRepository.createAddress({
      address_id:   addrId,
      entity_type:  'FAMILY',
      entity_id:    familyUuid,
      address_type: 'PERMANENT',
    })

    const familyData = {
      uuid:                    familyUuid,
      family_id:               familyId,
      permanent_address_id:    addrId,
      household_size:          body.household_size || 1,
      status:                  'DRAFT',
      registration_status:     'DRAFT',
      // Head of household info (on family table)
      head_first_name:         body.head_first_name.trim(),
      head_last_name:          body.head_last_name.trim(),
      head_middle_names:       body.head_middle_names || null,
      head_alias:              body.head_alias || null,
      head_mothers_maiden_name: body.head_mothers_maiden_name || null,
      phone:                   body.phone || null,
      email:                   body.email || null,
      geo_code:                body.geo_code || null,
      vulnerability_flag:      body.vulnerability_flag || false,
      intake_channel:          body.intake_channel || null,
      programme:               body.programme || null,
      payment_option:          body.payment_option || null,
      social_worker_zone:      body.social_worker_zone || null,
      social_worker_code:      body.social_worker_code || null,
      mailing_address_different: body.mailing_address_different || false,
      directions_to_house:     body.directions_to_house || null,
    }

    await this.registrationRepository.createFamily(familyData)

    // Create head of household member
    const headUuid = RegistrationService.generateUUID()
    const headData = {
      uuid:                 headUuid,
      family_uuid:          familyUuid,
      member_id:            `${familyId}M001`,
      first_name:           body.head_first_name.trim(),
      last_name:            body.head_last_name.trim(),
      middle_names:         body.head_middle_names || null,
      national_id:          body.head_national_id?.replace(/\D/g, '') || null,
      date_of_birth:        body.head_date_of_birth || null,
      gender:               body.head_sex === 'M' ? 'male' : body.head_sex === 'F' ? 'female' : body.head_sex ? 'other' : null,
      phone:                body.phone || null,
      email:                body.email || null,
      relationship_to_head: 'head',
    }

    await this.registrationRepository.createMember(headData)

    // Update family with head_member_id
    await this.registrationRepository.updateFamily(familyUuid, { head_member_id: headUuid })

    // Fetch the created family for response
    const family = await this.registrationRepository.findFamilyByUuid(familyUuid)
    const head   = await this.registrationRepository.findMemberByUuid(headUuid)

    publishEvent('FAMILY_CREATED', {
      family_id:    familyUuid,
      entity_id:    familyUuid,
      entity_type:  'FAMILY',
      data:         { family_id: familyId, family_name: familyName },
      triggered_by: this.userId,
    })

    return { ...family, family_id: familyId, head_member: head }
  }

  // ─── ADDRESS ─────────────────────────────────────────────

  async updatePermanentAddress(familyUuid, address) {
    const existing = await this.registrationRepository.findAddress('FAMILY', familyUuid, 'PERMANENT')
    if (!existing) {
      throw ApplicationError.notFound('Permanent address not found.')
    }

    const updateData = {}
    const fields = [
      'line1', 'line2', 'parish', 'district', 'geo_code',
      'lot_apt', 'street_district', 'post_office', 'post_code', 'area_type',
    ]
    for (const f of fields) {
      if (address[f] !== undefined) {
        updateData[f] = address[f]
      }
    }
    return this.registrationRepository.updateAddress(existing.address_id, updateData)
  }

  async createPermanentAddress(familyUuid, body) {
    const family = await this.registrationRepository.findFamilyByUuid(familyUuid)
    if (!family) {
      throw ApplicationError.notFound('Family not found.')
    }

    if (!body.line1?.trim()) {
      throw ApplicationError.badRequest('line1 is required')
    }
    if (!body.parish?.trim()) {
      throw ApplicationError.badRequest('parish is required')
    }

    // If a placeholder address already exists (created during createFamily), update it
    const existing = await this.registrationRepository.findAddress('FAMILY', familyUuid, 'PERMANENT')
    if (existing) {
      const updateData = {
        line1:           body.line1.trim(),
        line2:           body.line2 || null,
        parish:          body.parish.trim(),
        district:        body.district || null,
        geo_code:        body.geo_code || null,
        lot_apt:         body.lot_apt || null,
        street_district: body.street_district || null,
        post_office:     body.post_office || null,
        post_code:       body.post_code || null,
        area_type:       body.area_type || null,
      }
      await this.registrationRepository.updateAddress(existing.address_id, updateData)
      return this.registrationRepository.findAddressById(existing.address_id)
    }

    const addrId = RegistrationService.generateUUID()
    const data = {
      address_id:      addrId,
      entity_type:     'FAMILY',
      entity_id:       familyUuid,
      address_type:    'PERMANENT',
      line1:           body.line1.trim(),
      line2:           body.line2 || null,
      parish:          body.parish.trim(),
      district:        body.district || null,
      geo_code:        body.geo_code || null,
      lot_apt:         body.lot_apt || null,
      street_district: body.street_district || null,
      post_office:     body.post_office || null,
      post_code:       body.post_code || null,
      area_type:       body.area_type || null,
    }

    await this.registrationRepository.createAddress(data)

    // Update family.permanent_address_id
    await this.registrationRepository.updateFamily(familyUuid, { permanent_address_id: addrId })

    publishEvent('ADDRESS_CREATED', {
      family_id:    familyUuid,
      entity_id:    addrId,
      entity_type:  'ADDRESS',
      data:         { address_type: 'PERMANENT' },
      triggered_by: this.userId,
    })

    return this.registrationRepository.findAddressById(addrId)
  }

  async createMemberAddress(memberUuid, body) {
    const member = await this.registrationRepository.findMemberWithFamily(memberUuid)
    if (!member) {
      throw ApplicationError.notFound('Member not found.')
    }

    const existing = await this.registrationRepository.findAddress('MEMBER', memberUuid, 'CURRENT')
    if (existing) {
      throw ApplicationError.conflict('Member current address already exists.')
    }

    let data
    const memberAddrId = RegistrationService.generateUUID()
    if (body.use_family_address) {
      // Copy from family's permanent address
      const familyAddr = await this.registrationRepository.findAddress('FAMILY', member.family_uuid, 'PERMANENT')
      if (!familyAddr) {
        throw ApplicationError.badRequest('Family has no permanent address to copy.')
      }
      data = {
        address_id:      memberAddrId,
        entity_type:     'MEMBER',
        entity_id:       memberUuid,
        address_type:    'CURRENT',
        line1:           familyAddr.line1,
        line2:           familyAddr.line2,
        parish:          familyAddr.parish,
        district:        familyAddr.district,
        geo_code:        familyAddr.geo_code,
        lot_apt:         familyAddr.lot_apt,
        street_district: familyAddr.street_district,
        post_office:     familyAddr.post_office,
        post_code:       familyAddr.post_code,
        area_type:       familyAddr.area_type,
      }
    } else {
      data = {
        address_id:      memberAddrId,
        entity_type:     'MEMBER',
        entity_id:       memberUuid,
        address_type:    'CURRENT',
        line1:           body.line1 || null,
        line2:           body.line2 || null,
        parish:          body.parish || null,
        district:        body.district || null,
        geo_code:        body.geo_code || null,
        lot_apt:         body.lot_apt || null,
        street_district: body.street_district || null,
        post_office:     body.post_office || null,
        post_code:       body.post_code || null,
        area_type:       body.area_type || null,
      }
    }

    await this.registrationRepository.createAddress(data)
    return this.registrationRepository.findAddressById(memberAddrId)
  }

  // ─── MAILING ADDRESS (M010) ──────────────────────────────

  async createMailingAddress(familyUuid, body) {
    const family = await this.registrationRepository.findFamilyByUuid(familyUuid)
    if (!family) {
      throw ApplicationError.notFound('Family not found.')
    }

    // Upsert: delete existing first
    await this.registrationRepository.deleteAddress('FAMILY', familyUuid, 'MAILING')

    let data
    const mailingId = RegistrationService.generateUUID()
    if (body.same_as_permanent) {
      const permanent = await this.registrationRepository.findAddress('FAMILY', familyUuid, 'PERMANENT')
      if (!permanent) {
        throw ApplicationError.badRequest('No permanent address to copy.')
      }
      data = {
        address_id:      mailingId,
        entity_type:     'FAMILY', entity_id: familyUuid, address_type: 'MAILING',
        line1:           permanent.line1,       line2:     permanent.line2,
        parish:          permanent.parish,      district:  permanent.district,
        geo_code:        permanent.geo_code,    lot_apt:   permanent.lot_apt,
        street_district: permanent.street_district,
        post_office:     permanent.post_office, post_code: permanent.post_code,
        area_type:       permanent.area_type,
      }
    } else {
      data = {
        address_id:      mailingId,
        entity_type:     'FAMILY', entity_id: familyUuid, address_type: 'MAILING',
        line1:           body.line1 || null,       line2:     body.line2 || null,
        parish:          body.parish || null,      district:  body.district || null,
        geo_code:        body.geo_code || null,    lot_apt:   body.lot_apt || null,
        street_district: body.street_district || null,
        post_office:     body.post_office || null, post_code: body.post_code || null,
        area_type:       body.area_type || null,
      }
    }

    await this.registrationRepository.createAddress(data)
    await this.registrationRepository.updateFamily(familyUuid, { mailing_address_different: !body.same_as_permanent })
    return this.registrationRepository.findAddressById(mailingId)
  }

  async getMailingAddress(familyUuid) {
    return await this.registrationRepository.findAddress('FAMILY', familyUuid, 'MAILING')
  }

  async updateMailingAddress(familyUuid, body) {
    const existing = await this.registrationRepository.findAddress('FAMILY', familyUuid, 'MAILING')
    if (!existing) {
      throw ApplicationError.notFound('Mailing address not found.')
    }

    const updateData = {}
    const fields = [
      'line1', 'line2', 'parish', 'district', 'geo_code',
      'lot_apt', 'street_district', 'post_office', 'post_code', 'area_type',
    ]
    for (const f of fields) {
      if (body[f] !== undefined) {
        updateData[f] = body[f]
      }
    }
    return this.registrationRepository.updateAddress(existing.address_id, updateData)
  }

  // ─── MEMBERS ─────────────────────────────────────────────

  async updateMember(familyUuid, memberUuid, body) {
    const member = await this.registrationRepository.findMemberByUuid(memberUuid)
    if (!member || member.family_uuid !== familyUuid) {
      throw ApplicationError.notFound('Member not found in this family.')
    }

    const updateData = {}
    const fields = [
      // Actual family_member table columns
      'first_name', 'last_name', 'middle_names', 'alias',
      'date_of_birth', 'gender', 'sex_code',
      'national_id', 'trn', 'nis_no',
      'id_type', 'id_number', 'birth_entry_number', 'mothers_maiden_name',
      'phone', 'contact_no_1', 'contact_no_2', 'email',
      'relationship_to_head', 'marital_status', 'union_status', 'alive_flag',
      'order_number', 'is_twin',
      'occupation',
      'last_school_completed', 'school_name', 'school_code', 'school_grade', 'school_class', 'school_shift',
      'pregnant', 'pregnancy_due_date',
      'is_disabled', 'is_mentally_ill', 'is_chronically_ill', 'is_shut_in',
      'is_nis_pensioner', 'pension_number',
      'clinic_name', 'clinic_code',
      'reg_doc_birth_cert', 'reg_doc_declaration', 'reg_doc_school_records', 'reg_doc_none',
    ]
    for (const f of fields) {
      if (body[f] !== undefined) {
        updateData[f] = body[f]
      }
    }
    updateData.updated_at = new Date().toISOString()
    return this.registrationRepository.updateMember(memberUuid, updateData)
  }

  async createMember(familyUuid, body) {
    const family = await this.registrationRepository.findFamilyByUuid(familyUuid)
    if (!family) {
      throw ApplicationError.notFound('Family not found.')
    }

    // Validate required fields
    if (!body.first_name?.trim()) {
      throw ApplicationError.badRequest('first_name is required')
    }
    if (!body.last_name?.trim()) {
      throw ApplicationError.badRequest('last_name is required')
    }
    if (!body.relationship_to_head?.trim()) {
      throw ApplicationError.badRequest('relationship_to_head is required')
    }

    // NID validation
    if (body.national_id) {
      const nid = body.national_id.replace(/\D/g, '')
      if (nid.length !== 14) {
        throw ApplicationError.badRequest('National ID must be 14 digits')
      }
    }

    // Check member count
    const memberCount = await this.registrationRepository.countMembersByFamily(familyUuid)
    if (memberCount >= family.household_size) {
      throw ApplicationError.badRequest(`Family already has ${memberCount} members (max: ${family.household_size})`)
    }

    // Generate member_id
    const memberId = `${family.family_id}M${String(memberCount + 1).padStart(3, '0')}`

    const memberUuid = RegistrationService.generateUUID()
    const memberData = {
      uuid:                 memberUuid,
      family_uuid:          familyUuid,
      member_id:            memberId,
      first_name:           body.first_name.trim(),
      last_name:            body.last_name.trim(),
      middle_names:         body.middle_names || null,
      alias:                body.alias || null,
      national_id:          body.national_id?.replace(/\D/g, '') || null,
      date_of_birth:        body.date_of_birth || null,
      gender:               body.gender || null,
      sex_code:             body.sex_code || null,
      phone:                body.phone || null,
      contact_no_1:         body.contact_no_1 || null,
      contact_no_2:         body.contact_no_2 || null,
      email:                body.email || null,
      relationship_to_head: body.relationship_to_head.trim(),
      marital_status:       body.marital_status || null,
      union_status:         body.union_status || null,
      alive_flag:           body.alive_flag !== undefined ? body.alive_flag : true,
      order_number:         body.order_number || null,
      occupation:           body.occupation || null,
      // Identification
      trn:                  body.trn || null,
      nis_no:               body.nis_no || null,
      id_type:              body.id_type || null,
      id_number:            body.id_number || null,
      birth_entry_number:   body.birth_entry_number || null,
      mothers_maiden_name:  body.mothers_maiden_name || null,
      is_twin:              body.is_twin || false,
      // Education
      last_school_completed: body.last_school_completed || null,
      school_name:          body.school_name || null,
      // Health
      pregnant:             body.pregnant || null,
      pregnancy_due_date:   body.pregnancy_due_date || null,
      is_disabled:          body.is_disabled || false,
      is_mentally_ill:      body.is_mentally_ill || false,
      is_chronically_ill:   body.is_chronically_ill || false,
      is_shut_in:           body.is_shut_in || false,
      // Financial
      is_nis_pensioner:     body.is_nis_pensioner || false,
      pension_number:       body.pension_number || null,
      // Medical
      clinic_name:          body.clinic_name || null,
      // Registration docs
      reg_doc_birth_cert:   body.reg_doc_birth_cert || false,
      reg_doc_declaration:  body.reg_doc_declaration || false,
      reg_doc_school_records: body.reg_doc_school_records || false,
      reg_doc_none:         body.reg_doc_none || false,
    }

    await this.registrationRepository.createMember(memberData)

    // Create current address if provided
    if (body.current_address || body.address) {
      const addr = body.current_address || body.address
      const addrId = RegistrationService.generateUUID()
      await this.registrationRepository.createAddress({
        address_id:   addrId,
        entity_type:  'MEMBER', entity_id: memberUuid, address_type: 'CURRENT',
        line1:        addr.line1 || null, line2:    addr.line2 || null,
        parish:       addr.parish || null, district: addr.district || null,
        geo_code:     addr.geo_code || null,
      })
    }

    // If head, update family head pointer
    if (body.relationship_to_head === 'head') {
      await this.registrationRepository.updateFamily(familyUuid, { head_member_id: memberUuid })
    }

    const member = await this.registrationRepository.findMemberByUuid(memberUuid)

    publishEvent('MEMBER_ADDED', {
      family_id:    familyUuid,
      entity_id:    memberUuid,
      entity_type:  'MEMBER',
      data:         { member_id: memberId, relationship: body.relationship_to_head },
      triggered_by: this.userId,
    })

    return member
  }

  async addMemberPostRegistration(familyUuid, body) {
    const family = await this.registrationRepository.findFamilyByUuid(familyUuid)
    if (!family) {
      throw ApplicationError.notFound('Family not found.')
    }

    if (!body.first_name?.trim()) {
      throw ApplicationError.badRequest('first_name is required')
    }
    if (!body.last_name?.trim()) {
      throw ApplicationError.badRequest('last_name is required')
    }

    const memberCount = await this.registrationRepository.countMembersByFamily(familyUuid)
    const memberId = `${family.family_id}M${String(memberCount + 1).padStart(3, '0')}`

    const memberUuid = RegistrationService.generateUUID()
    const memberData = {
      uuid:                 memberUuid,
      family_uuid:          familyUuid,
      member_id:            memberId,
      first_name:           body.first_name.trim(),
      last_name:            body.last_name.trim(),
      middle_names:         body.middle_names || body.middle_name || null,
      national_id:          body.national_id || body.national_id_number || null,
      date_of_birth:        body.date_of_birth || null,
      gender:               body.gender || body.sex || null,
      phone:                body.phone || body.phone_number || null,
      email:                body.email || null,
      relationship_to_head: body.relationship_to_head || null,
    }

    await this.registrationRepository.createMember(memberData)

    // Always increment household_size
    await this.registrationRepository.updateFamily(familyUuid, {
      household_size: (family.household_size || 0) + 1,
      updated_at:     new Date().toISOString(),
    })

    // Transfer log
    await this.registrationRepository.insertTransferLog({
      member_uuid:  memberUuid,
      family_uuid:  familyUuid,
      action:       'ADDED',
      reason:       body.reason_for_addition || 'Added post-registration',
      performed_by: this.userId,
    })

    const member = await this.registrationRepository.findMemberByUuid(memberUuid)

    publishEvent('MEMBER_ADDED', {
      family_id:    familyUuid,
      entity_id:    memberUuid,
      entity_type:  'MEMBER',
      data:         { member_id: memberId, reason: body.reason_for_addition },
      triggered_by: this.userId,
    })

    return member
  }

  async updateMemberStatus(familyUuid, memberUuid, body) {
    const member = await this.registrationRepository.findMemberByUuid(memberUuid)
    if (!member || member.family_uuid !== familyUuid) {
      throw ApplicationError.notFound('Member not found in this family.')
    }

    if (!body.status) {
      throw ApplicationError.badRequest('status is required')
    }

    // Death is permanent
    if (member.status === 'DECEASED') {
      throw ApplicationError.badRequest('Cannot change status of deceased member.')
    }

    const updateData = { status: body.status, updated_at: new Date().toISOString() }

    if (body.status === 'DECEASED') {
      updateData.alive_flag = false
      updateData.date_of_death = body.date_of_death || new Date().toISOString()
    }

    if (body.status === 'TRANSFERRED_OUT') {
      updateData.left_date = body.left_date || new Date().toISOString()
    }

    await this.registrationRepository.updateMember(memberUuid, updateData)

    // Adjust household_size if transitioning from ACTIVE
    if (member.status === 'ACTIVE' && ['DECEASED', 'TRANSFERRED_OUT'].includes(body.status)) {
      const family = await this.registrationRepository.findFamilyByUuid(familyUuid)
      if (family && family.household_size > 0) {
        await this.registrationRepository.updateFamily(familyUuid, {
          household_size: family.household_size - 1,
          updated_at:     new Date().toISOString(),
        })
      }
    }

    // Transfer log
    await this.registrationRepository.insertTransferLog({
      member_uuid:  memberUuid,
      family_uuid:  familyUuid,
      action:       body.status,
      reason:       body.reason || `Status changed to ${body.status}`,
      performed_by: this.userId,
    })

    publishEvent('MEMBER_STATUS_CHANGED', {
      family_id:    familyUuid,
      entity_id:    memberUuid,
      entity_type:  'MEMBER',
      data:         { old_status: member.status, new_status: body.status },
      triggered_by: this.userId,
    })

    return { success: true, member_uuid: memberUuid, new_status: body.status }
  }

  async deleteMember(familyUuid, memberUuid, body = {}) {
    const member = await this.registrationRepository.findMemberByUuid(memberUuid)
    if (!member || member.family_uuid !== familyUuid) {
      throw ApplicationError.notFound('Member not found in this family.')
    }

    const family = await this.registrationRepository.findFamilyByUuid(familyUuid)
    const isHardDelete = body.hard_delete || family?.status === 'DRAFT'

    if (isHardDelete) {
      await this.registrationRepository.deleteMemberHard(memberUuid)
    } else {
      await this.registrationRepository.updateMember(memberUuid, {
        status:     'TRANSFERRED_OUT',
        left_date:  new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      await this.registrationRepository.insertTransferLog({
        member_uuid:  memberUuid,
        family_uuid:  familyUuid,
        action:       'REMOVED',
        reason:       body.reason || 'Removed from family',
        performed_by: this.userId,
      })
    }

    // Decrement household_size
    if (family && family.household_size > 0) {
      await this.registrationRepository.updateFamily(familyUuid, {
        household_size: family.household_size - 1,
        updated_at:     new Date().toISOString(),
      })
    }

    return { success: true, action: isHardDelete ? 'hard_deleted' : 'soft_deleted' }
  }

  async getMemberHistory(familyUuid, memberUuid) {
    const member = await this.registrationRepository.findMemberByUuid(memberUuid)
    if (!member || member.family_uuid !== familyUuid) {
      throw ApplicationError.notFound('Member not found in this family.')
    }
    return this.registrationRepository.findTransferLog(memberUuid)
  }

  // ─── DOCUMENTS ───────────────────────────────────────────

  async createFamilyDocument(familyUuid, body) {
    const family = await this.registrationRepository.findFamilyByUuid(familyUuid)
    if (!family) {
      throw ApplicationError.notFound('Family not found.')
    }

    const docUuid = RegistrationService.generateUUID()
    await this.registrationRepository.createDocument({
      document_id:         docUuid,
      owner_type:          'FAMILY',
      owner_id:            familyUuid,
      document_type:       body.document_type || 'OTHER',
      document_name:       body.document_name || null,
      document_number:     body.document_number || null,
      issue_date:          body.issue_date || null,
      expiry_date:         body.expiry_date || null,
      issuing_authority:   body.issuing_authority || null,
      verification_status: body.verification_status || 'PENDING',
      notes:               body.notes || null,
      uploaded_by:         this.userId,
      created_by:          this.userId,
    })

    publishEvent('DOCUMENT_ADDED', {
      family_id:    familyUuid,
      entity_id:    docUuid,
      entity_type:  'DOCUMENT',
      data:         { owner_type: 'FAMILY', document_type: body.document_type },
      triggered_by: this.userId,
    })

    return { uuid: docUuid, owner_type: 'FAMILY', owner_id: familyUuid, document_type: body.document_type || 'OTHER' }
  }

  async createMemberDocument(memberUuid, body) {
    const member = await this.registrationRepository.findMemberWithFamily(memberUuid)
    if (!member) {
      throw ApplicationError.notFound('Member not found.')
    }

    const docUuid = RegistrationService.generateUUID()
    await this.registrationRepository.createDocument({
      document_id:         docUuid,
      owner_type:          'MEMBER',
      owner_id:            memberUuid,
      document_type:       body.document_type || 'OTHER',
      document_name:       body.document_name || null,
      document_number:     body.document_number || null,
      issue_date:          body.issue_date || null,
      expiry_date:         body.expiry_date || null,
      issuing_authority:   body.issuing_authority || null,
      verification_status: body.verification_status || 'PENDING',
      notes:               body.notes || null,
      uploaded_by:         this.userId,
      created_by:          this.userId,
    })

    publishEvent('DOCUMENT_ADDED', {
      family_id:    member.family_uuid,
      entity_id:    docUuid,
      entity_type:  'DOCUMENT',
      data:         { owner_type: 'MEMBER', document_type: body.document_type },
      triggered_by: this.userId,
    })

    return { uuid: docUuid, owner_type: 'MEMBER', owner_id: memberUuid, document_type: body.document_type || 'OTHER' }
  }

  // ─── HOUSE SERVICES ──────────────────────────────────────

  async createHouseServices(familyUuid, body) {
    const family = await this.registrationRepository.findFamilyByUuid(familyUuid)
    if (!family) {
      throw ApplicationError.notFound('Family not found.')
    }

    // Upsert: delete existing
    await this.registrationRepository.deleteHouseServices(familyUuid)
    const hsId = RegistrationService.generateUUID()
    await this.registrationRepository.createHouseServices({
      service_id: hsId, family_uuid: familyUuid, ...body,
    })
    return this.registrationRepository.findHouseServices(familyUuid)
  }

  async getHouseServices(familyUuid) {
    return await this.registrationRepository.findHouseServices(familyUuid)
  }

  async updateHouseServices(familyUuid, body) {
    const existing = await this.registrationRepository.findHouseServices(familyUuid)
    if (!existing) {
      throw ApplicationError.notFound('House services not found.')
    }
    const updateData = { ...body, updated_at: new Date().toISOString() }
    return this.registrationRepository.updateHouseServices(existing.service_id, updateData)
  }

  // ─── SUBMISSION / REVIEW ──────────────────────────────────

  async getReview(familyUuid) {
    const family = await this.registrationRepository.findFamilyByUuid(familyUuid)
    if (!family) {
      throw ApplicationError.notFound('Family not found.')
    }

    const [address, mailingAddress, houseServices, members] = await Promise.all([
      this.registrationRepository.findAddress('FAMILY', familyUuid, 'PERMANENT'),
      this.registrationRepository.findAddress('FAMILY', familyUuid, 'MAILING'),
      this.registrationRepository.findHouseServices(familyUuid),
      this.registrationRepository.findMembersByFamily(familyUuid),
    ])

    // Enrich members with addresses and documents
    const memberUuids = members.map(m => m.uuid)
    const [memberAddresses, familyDocs] = await Promise.all([
      this.registrationRepository.findAddressesByMembers(memberUuids),
      this.registrationRepository.findDocumentsByOwner('FAMILY', familyUuid),
    ])

    const addrByMember = {}
    for (const a of memberAddresses) {
      addrByMember[a.entity_id] = a
    }

    // Fetch member documents in batch
    const memberDocsPromises = memberUuids.map(uuid =>
      this.registrationRepository.findDocumentsByOwner('MEMBER', uuid))
    const memberDocsArrays = await Promise.all(memberDocsPromises)
    const docsByMember = {}
    memberUuids.forEach((uuid, i) => {
      docsByMember[uuid] = memberDocsArrays[i]
    })

    const enrichedMembers = members.map(m => ({
      ...m,
      current_address: addrByMember[m.uuid] || null,
      documents:       docsByMember[m.uuid] || [],
    }))

    // Validation
    const validation = {
      has_permanent_address: !!address,
      member_count_matches:  members.length >= 1 && members.length <= (family.household_size || 99),
      has_head_of_household: members.some(m => m.relationship_to_head === 'head'),
    }

    return {
      family, address, mailing_address: mailingAddress,
      house_services:  houseServices,
      members:         enrichedMembers, documents:       familyDocs,
      validation,
    }
  }

  async saveDraft(familyUuid, body) {
    const family = await this.registrationRepository.findFamilyByUuid(familyUuid)
    if (!family) {
      throw ApplicationError.notFound('Family not found.')
    }
    if (family.status !== 'DRAFT') {
      throw ApplicationError.badRequest('Can only save drafts for DRAFT families.')
    }

    writeHistory(updateHistoryEntry(familyUuid, 'FAMILY', familyUuid, {}, body, this.userId))
    return { success: true, message: 'Draft saved.' }
  }

  async submit(familyUuid) {
    const family = await this.registrationRepository.findFamilyByUuid(familyUuid)
    if (!family) {
      throw ApplicationError.notFound('Family not found.')
    }
    if (family.status !== 'DRAFT') {
      throw ApplicationError.badRequest('Only DRAFT families can be submitted.')
    }

    // Validation checks
    const address = await this.registrationRepository.findAddress('FAMILY', familyUuid, 'PERMANENT')
    if (!address) {
      throw ApplicationError.badRequest('Permanent address is required before submission.')
    }

    const memberCount = await this.registrationRepository.countMembersByFamily(familyUuid)
    if (memberCount < 1) {
      throw ApplicationError.badRequest('At least one member is required.')
    }

    const members = await this.registrationRepository.findMembersByFamily(familyUuid)
    const hasHead = members.some(m => m.relationship_to_head === 'head')
    if (!hasHead) {
      throw ApplicationError.badRequest('Head of household is required.')
    }

    // Status transition
    await this.registrationRepository.updateFamily(familyUuid, {
      status:         'SUBMITTED',
      household_size: memberCount,
      updated_at:     new Date().toISOString(),
    })

    writeHistory(submitHistoryEntry(familyUuid, 'FAMILY', familyUuid, { status: 'DRAFT' }, { status: 'SUBMITTED' }, this.userId))

    publishEvent('FAMILY_SUBMITTED', {
      family_id:    familyUuid,
      entity_id:    familyUuid,
      entity_type:  'FAMILY',
      data:         { member_count: memberCount },
      triggered_by: this.userId,
    })

    return { success: true, message: 'Registration submitted.' }
  }

  async getProgress(familyUuid) {
    const family = await this.registrationRepository.findFamilyByUuid(familyUuid)
    if (!family) {
      throw ApplicationError.notFound('Family not found.')
    }

    const [addressCount, memberCount, docCount] = await Promise.all([
      this.registrationRepository.findAddress('FAMILY', familyUuid, 'PERMANENT').then(a => a ? 1 : 0),
      this.registrationRepository.countMembersByFamily(familyUuid),
      this.registrationRepository.countDocumentsByOwner('FAMILY', familyUuid),
    ])

    return {
      step_1_family:         { complete: true, data: { family_name: `${family.head_first_name || ''} ${family.head_last_name || ''}`.trim() } },
      step_2_address:        { complete: addressCount > 0, count: addressCount },
      step_3_family_docs:    { complete: docCount > 0, count: docCount },
      step_4_account:        { complete: false, disabled: true },
      step_5_members:        { complete: memberCount > 0, count: memberCount, required: family.household_size },
      step_6_member_address: { complete: false, note: 'Check per member' },
      step_7_member_docs:    { complete: false, note: 'Check per member' },
      step_8_member_account: { complete: false, disabled: true },
      step_9_review:         { complete: family.status === 'SUBMITTED' },
    }
  }

  // ─── SAVE EDITS (Bulk) ───────────────────────────────────

  async saveEdits(familyUuid, body) {
    const family = await this.registrationRepository.findFamilyByUuid(familyUuid)
    if (!family) {
      throw ApplicationError.notFound('Family not found.')
    }

    // Snapshot old state
    const oldAddress = await this.registrationRepository.findAddress('FAMILY', familyUuid, 'PERMANENT')
    const oldMembers = await this.registrationRepository.findMembersByFamily(familyUuid)
    const oldState = { family, address: oldAddress, members: oldMembers }

    const errors = []

    // Apply family updates
    if (body.family && Object.keys(body.family).length > 0) {
      try {
        await this.updateFamily(familyUuid, body.family)
      } catch (e) {
        errors.push({ section: 'family', error: e.message })
      }
    }

    // Apply address updates
    if (body.address && Object.keys(body.address).length > 0) {
      try {
        await this.updatePermanentAddress(familyUuid, body.address)
      } catch (e) {
        errors.push({ section: 'address', error: e.message })
      }
    }

    // Apply member updates
    if (body.member_updates && Array.isArray(body.member_updates)) {
      for (const mu of body.member_updates) {
        if (!mu.member_uuid) {
          continue
        }
        try {
          await this.updateMember(familyUuid, mu.member_uuid, mu)
        } catch (e) {
          errors.push({ section: `member_${mu.member_uuid}`, error: e.message })
        }
      }
    }

    // Add new members
    if (body.added_members && Array.isArray(body.added_members)) {
      for (const am of body.added_members) {
        try {
          // Generate member_id
          const memberCount = await this.registrationRepository.countMembersByFamily(familyUuid)
          const f = await this.registrationRepository.findFamilyByUuid(familyUuid)
          const memberId = `${f.family_id}M${String(memberCount + 1).padStart(3, '0')}`
          await this.registrationRepository.createMember({
            uuid:        RegistrationService.generateUUID(),
            family_uuid: familyUuid,
            member_id:   memberId,
            first_name:  am.first_name?.trim() || null,
            last_name:   am.last_name?.trim() || null,
            middle_names: am.middle_names || am.middle_name || null,
            national_id: am.national_id || am.national_id_number || null,
            date_of_birth: am.date_of_birth || null,
            gender:      am.gender || am.sex || null,
            phone:       am.phone || am.phone_number || null,
            email:       am.email || null,
            relationship_to_head: am.relationship_to_head || null,
            status:      'ACTIVE',
          })
        } catch (e) {
          errors.push({ section: 'added_member', error: e.message })
        }
      }
    }

    // Remove members
    if (body.removed_members && Array.isArray(body.removed_members)) {
      for (const rm of body.removed_members) {
        try {
          await this.registrationRepository.updateMember(rm, {
            status:     'TRANSFERRED_OUT',
            left_date:  new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        } catch (e) {
          errors.push({ section: `removed_${rm}`, error: e.message })
        }
      }
    }

    // Status changes
    if (body.status_changes && Array.isArray(body.status_changes)) {
      for (const sc of body.status_changes) {
        if (!sc.member_uuid || !sc.new_status) {
          continue
        }
        try {
          const m = await this.registrationRepository.findMemberByUuid(sc.member_uuid)
          if (!m) {
            continue
          }
          if (m.status === 'DECEASED') {
            continue
          } // death is permanent

          const update = { status: sc.new_status, updated_at: new Date().toISOString() }
          if (sc.new_status === 'DECEASED') {
            update.alive_flag = false
            // Decrement household_size for death
            const fam = await this.registrationRepository.findFamilyByUuid(familyUuid)
            if (fam?.household_size > 0) {
              await this.registrationRepository.updateFamily(familyUuid, { household_size: fam.household_size - 1 })
            }
          }
          if (['BIRTH', 'MARRIAGE_IN', 'ADOPTION_IN'].includes(sc.reason)) {
            // Increment household_size for new arrivals
            const fam = await this.registrationRepository.findFamilyByUuid(familyUuid)
            await this.registrationRepository.updateFamily(familyUuid, {
              household_size: (fam?.household_size || 0) + 1,
            })
          }
          await this.registrationRepository.updateMember(sc.member_uuid, update)
        } catch (e) {
          errors.push({ section: `status_${sc.member_uuid}`, error: e.message })
        }
      }
    }

    // Snapshot new state
    const newFamily = await this.registrationRepository.findFamilyByUuid(familyUuid)
    const newAddress = await this.registrationRepository.findAddress('FAMILY', familyUuid, 'PERMANENT')
    const newMembers = await this.registrationRepository.findMembersByFamily(familyUuid)
    const newState = { family: newFamily, address: newAddress, members: newMembers }

    // Write history
    await this.registrationRepository.insertHistory({
      entity_type: 'FAMILY',
      entity_id:   familyUuid,
      change_type: 'modified',
      old_value:   oldState,
      new_value:   newState,
      changed_by:  body.changed_by || this.userId,
      reason:      body.reason || 'Edits saved',
    })

    publishEvent('FAMILY_UPDATED', {
      family_id:    familyUuid,
      entity_id:    familyUuid,
      entity_type:  'FAMILY',
      data:         { sections_updated: Object.keys(body).filter(k => body[k] && !['changed_by', 'reason'].includes(k)) },
      triggered_by: this.userId,
    })

    if (errors.length > 0) {
      return { partial: true, applied_changes: true, errors }
    }
    return { success: true }
  }

  // ─── CHECK NATIONAL ID ───────────────────────────────────

  async checkNationalId(nationalId) {
    const cleaned = nationalId.replace(/\D/g, '')
    if (cleaned.length !== 14) {
      throw ApplicationError.badRequest('National ID must be 14 digits')
    }

    const existing = await this.registrationRepository.findMemberByNationalId(cleaned)
    return {
      exists:      !!existing,
      national_id: cleaned,
    }
  }

  // ─── DISABLED PLACEHOLDERS ───────────────────────────────

  getAccountInfo() {
    return { message: 'Account information is disabled until benefits are approved.', disabled: true }
  }
}
