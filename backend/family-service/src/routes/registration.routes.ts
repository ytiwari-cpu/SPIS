/**
 * FAMILY REGISTRATION ROUTES - 9-STEP FLOW (V2 POLYMORPHIC)
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * FAMILY IS THE ROOT ENTITY - ALL RELATIONSHIPS POINT TO IT
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * MIGRATION 006 NAMING CONVENTION:
 *   - family.uuid: Internal UUID primary key
 *   - family.family_id: Human-readable code (F1, F2, F3...) - was family_code
 *   - family_member.uuid: Internal UUID primary key
 *   - family_member.family_uuid: FK to family.uuid - was family_id
 *   - family_member.member_id: Human-readable code (F1M001, F1M002...) - was member_code
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Step 1: Create Family (ROOT) → Returns family with uuid
 * Step 2: Create Permanent Address → Polymorphic: entity_type='FAMILY', entity_id=uuid, address_type='PERMANENT'
 * Step 3: Upload Family Documents (optional, repeatable)
 * Step 4: Family Account Details (DISABLED until benefits approved)
 * Step 5: Create Family Members → Must match household_size
 * Step 6: Member Current Address → Polymorphic: entity_type='MEMBER', entity_id=uuid, address_type='CURRENT'
 * Step 7: Upload Member Documents (optional, repeatable)
 * Step 8: Member Account Details (DISABLED until benefits approved)
 * Step 9: Review & Submit
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * POLYMORPHIC ADDRESS MODEL:
 *   - entity_type: 'FAMILY' | 'MEMBER' (UPPERCASE)
 *   - entity_id: family.uuid or family_member.uuid
 *   - address_type: 'PERMANENT' | 'CURRENT' (UPPERCASE)
 * ═══════════════════════════════════════════════════════════════════════════
 * POLYMORPHIC DOCUMENT MODEL:
 *   - owner_type: 'FAMILY' | 'MEMBER' (UPPERCASE)
 *   - owner_id: family.uuid or family_member.uuid
 * ═══════════════════════════════════════════════════════════════════════════
 * STATUS VALUES: DRAFT, SUBMITTED (UPPERCASE - only these two for now)
 * ═══════════════════════════════════════════════════════════════════════════
 * HISTORY: Every write MUST call historyService with family uuid as first param
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase.js'
import { 
  writeHistory, 
  createHistoryEntry, 
  updateHistoryEntry, 
  submitHistoryEntry 
} from '../services/historyService.js'
import { publishEvent } from '../services/eventService.js'

const router = Router()

const isUuid = (value?: string): boolean => {
  if (!value) return false
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(value)
}

// ═══════════════════════════════════════════════════════════════════════════
// GET FAMILY FOR EDITING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/registration/family/:familyUuid
 * 
 * Get family data for editing in the wizard.
 * Returns family details, address, and members.
 * Note: familyUuid is the internal UUID (was family_id before migration 006)
 */
router.get('/family/:familyUuid', async (req: Request, res: Response) => {
  try {
    const { familyUuid } = req.params

    // Get family by UUID
    const { data: family, error: familyError } = await supabase
      .from('family')
      .select('*')
      .eq('uuid', familyUuid)
      .single()

    if (familyError || !family) {
      return res.status(404).json({
        success: false,
        error: 'Family not found.',
      })
    }

    // Get permanent address (polymorphic - uses uuid)
    const { data: address } = await supabase
      .from('address')
      .select('*')
      .eq('entity_type', 'FAMILY')
      .eq('entity_id', familyUuid)
      .eq('address_type', 'PERMANENT')
      .single()

    // Get mailing address (Migration 010)
    const { data: mailingAddress } = await supabase
      .from('address')
      .select('*')
      .eq('entity_type', 'FAMILY')
      .eq('entity_id', familyUuid)
      .eq('address_type', 'MAILING')
      .single()

    // Get house services (Migration 010)
    const { data: houseServices } = await supabase
      .from('house_services')
      .select('*')
      .eq('family_uuid', familyUuid)
      .single()

    // Get members (family_uuid references family.uuid)
    const { data: members } = await supabase
      .from('family_member')
      .select('*')
      .eq('family_uuid', familyUuid)
      .order('created_at', { ascending: true })

    // Get member addresses (using member uuid)
    const memberUuids = (members || []).map(m => m.uuid)
    const { data: memberAddresses } = await supabase
      .from('address')
      .select('*')
      .eq('entity_type', 'MEMBER')
      .eq('address_type', 'CURRENT')
      .in('entity_id', memberUuids.length > 0 ? memberUuids : ['none'])

    // Create lookup
    const addressMap: Record<string, unknown> = {}
    for (const addr of memberAddresses || []) {
      addressMap[addr.entity_id] = addr
    }

    // Attach addresses to members
    const membersWithAddresses = (members || []).map(m => ({
      ...m,
      current_address: addressMap[m.uuid] || null,
      use_family_address: !addressMap[m.uuid],
    }))

    return res.json({
      success: true,
      data: {
        family,
        address,
        mailing_address: mailingAddress || null,
        house_services: houseServices || null,
        members: membersWithAddresses,
      },
    })
  } catch (error) {
    console.error('Get family error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch family data.',
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// UPDATE FAMILY (EDIT MODE)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * PUT /api/v1/registration/family/:familyUuid
 * 
 * Update family details (edit mode).
 * Note: familyUuid is the internal UUID (was family_id before migration 006)
 */
router.put('/family/:familyUuid', async (req: Request, res: Response) => {
  try {
    const { familyUuid } = req.params
    const {
      household_size,
      head_first_name,
      head_last_name,
      phone,
      email,
      vulnerability_flag,
    } = req.body

    // Verify family exists
    const { data: existingFamily, error: fetchError } = await supabase
      .from('family')
      .select('*')
      .eq('uuid', familyUuid)
      .single()

    if (fetchError || !existingFamily) {
      return res.status(404).json({
        success: false,
        error: 'Family not found.',
      })
    }

    // Build update object
    const updateData: Record<string, unknown> = {}
    if (household_size !== undefined) updateData.household_size = household_size
    if (head_first_name !== undefined) updateData.head_first_name = head_first_name
    if (head_last_name !== undefined) updateData.head_last_name = head_last_name
    if (phone !== undefined) updateData.phone = phone
    if (email !== undefined) updateData.email = email
    if (vulnerability_flag !== undefined) updateData.vulnerability_flag = vulnerability_flag
    // Migration 010: Extended family fields
    if (req.body.programme !== undefined) updateData.programme = req.body.programme
    if (req.body.payment_option !== undefined) updateData.payment_option = req.body.payment_option
    if (req.body.social_worker_zone !== undefined) updateData.social_worker_zone = req.body.social_worker_zone
    if (req.body.social_worker_code !== undefined) updateData.social_worker_code = req.body.social_worker_code
    if (req.body.application_no !== undefined) updateData.application_no = req.body.application_no
    if (req.body.constituency_code !== undefined) updateData.constituency_code = req.body.constituency_code
    if (req.body.head_middle_names !== undefined) updateData.head_middle_names = req.body.head_middle_names
    if (req.body.head_alias !== undefined) updateData.head_alias = req.body.head_alias
    if (req.body.head_mothers_maiden_name !== undefined) updateData.head_mothers_maiden_name = req.body.head_mothers_maiden_name
    if (req.body.mailing_address_different !== undefined) updateData.mailing_address_different = req.body.mailing_address_different
    if (req.body.directions_to_house !== undefined) updateData.directions_to_house = req.body.directions_to_house

    const { data: family, error: updateError } = await supabase
      .from('family')
      .update(updateData)
      .eq('uuid', familyUuid)
      .select()
      .single()

    if (updateError) {
      return res.status(500).json({
        success: false,
        error: `Failed to update family: ${updateError.message}`,
      })
    }

    return res.json({
      success: true,
      data: family,
      message: 'Family updated successfully.',
    })
  } catch (error) {
    console.error('Update family error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to update family.',
    })
  }
})

/**
 * PUT /api/v1/registration/family/:familyUuid/address
 * 
 * Update family's permanent address.
 * Note: familyUuid is the internal UUID (was family_id before migration 006)
 */
router.put('/family/:familyUuid/address', async (req: Request, res: Response) => {
  try {
    const { familyUuid } = req.params
    const { line1, line2, parish, district, geo_code } = req.body

    // Find existing address
    const { data: existingAddress, error: fetchError } = await supabase
      .from('address')
      .select('*')
      .eq('entity_type', 'FAMILY')
      .eq('entity_id', familyUuid)
      .eq('address_type', 'PERMANENT')
      .single()

    if (fetchError || !existingAddress) {
      return res.status(404).json({
        success: false,
        error: 'Address not found.',
      })
    }

    const updateData: Record<string, unknown> = {}
    if (line1 !== undefined) updateData.line1 = line1
    if (line2 !== undefined) updateData.line2 = line2
    if (parish !== undefined) updateData.parish = parish
    if (district !== undefined) updateData.district = district
    if (geo_code !== undefined) updateData.geo_code = geo_code
    // Migration 010: Extended address fields
    if (req.body.lot_apt !== undefined) updateData.lot_apt = req.body.lot_apt
    if (req.body.street_district !== undefined) updateData.street_district = req.body.street_district
    if (req.body.post_office !== undefined) updateData.post_office = req.body.post_office
    if (req.body.post_code !== undefined) updateData.post_code = req.body.post_code
    if (req.body.area_type !== undefined) updateData.area_type = req.body.area_type

    const { data: address, error: updateError } = await supabase
      .from('address')
      .update(updateData)
      .eq('address_id', existingAddress.address_id)
      .select()
      .single()

    if (updateError) {
      return res.status(500).json({
        success: false,
        error: `Failed to update address: ${updateError.message}`,
      })
    }

    return res.json({
      success: true,
      data: address,
      message: 'Address updated successfully.',
    })
  } catch (error) {
    console.error('Update address error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to update address.',
    })
  }
})

/**
 * PUT /api/v1/registration/family/:familyUuid/members/:memberUuid
 * 
 * Update a family member.
 * Note: familyUuid/memberUuid are internal UUIDs (was family_id/member_id before migration 006)
 */
router.put('/family/:familyUuid/members/:memberUuid', async (req: Request, res: Response) => {
  try {
    const { familyUuid, memberUuid } = req.params
    const {
      first_name,
      last_name,
      national_id,
      date_of_birth,
      gender,
      relationship_to_head,
      marital_status,
      alive_flag,
      phone,
      email,
    } = req.body

    // Verify member exists and belongs to family
    const { data: existingMember, error: fetchError } = await supabase
      .from('family_member')
      .select('*')
      .eq('uuid', memberUuid)
      .eq('family_uuid', familyUuid)
      .single()

    if (fetchError || !existingMember) {
      return res.status(404).json({
        success: false,
        error: 'Member not found.',
      })
    }

    const updateData: Record<string, unknown> = {}
    if (first_name !== undefined) updateData.first_name = first_name
    if (last_name !== undefined) updateData.last_name = last_name
    if (national_id !== undefined) updateData.national_id = national_id?.replace(/\D/g, '') || null
    if (date_of_birth !== undefined) updateData.date_of_birth = date_of_birth
    if (gender !== undefined) updateData.gender = gender
    if (relationship_to_head !== undefined) updateData.relationship_to_head = relationship_to_head
    if (marital_status !== undefined) updateData.marital_status = marital_status
    if (alive_flag !== undefined) updateData.alive_flag = alive_flag
    if (phone !== undefined) updateData.phone = phone
    if (email !== undefined) updateData.email = email
    // Migration 010: Extended member fields
    if (req.body.middle_names !== undefined) updateData.middle_names = req.body.middle_names
    if (req.body.alias !== undefined) updateData.alias = req.body.alias
    if (req.body.trn !== undefined) updateData.trn = req.body.trn
    if (req.body.nis_no !== undefined) updateData.nis_no = req.body.nis_no
    if (req.body.id_type !== undefined) updateData.id_type = req.body.id_type
    if (req.body.id_number !== undefined) updateData.id_number = req.body.id_number
    if (req.body.birth_entry_number !== undefined) updateData.birth_entry_number = req.body.birth_entry_number
    if (req.body.mothers_maiden_name !== undefined) updateData.mothers_maiden_name = req.body.mothers_maiden_name
    if (req.body.is_twin !== undefined) updateData.is_twin = req.body.is_twin
    if (req.body.order_number !== undefined) updateData.order_number = req.body.order_number
    if (req.body.occupation !== undefined) updateData.occupation = req.body.occupation
    if (req.body.contact_no_1 !== undefined) updateData.contact_no_1 = req.body.contact_no_1
    if (req.body.contact_no_2 !== undefined) updateData.contact_no_2 = req.body.contact_no_2
    if (req.body.union_status !== undefined) updateData.union_status = req.body.union_status
    if (req.body.last_school_completed !== undefined) updateData.last_school_completed = req.body.last_school_completed
    if (req.body.school_name !== undefined) updateData.school_name = req.body.school_name
    if (req.body.school_parish !== undefined) updateData.school_parish = req.body.school_parish
    if (req.body.school_attended_since !== undefined) updateData.school_attended_since = req.body.school_attended_since
    if (req.body.pregnant !== undefined) updateData.pregnant = req.body.pregnant
    if (req.body.pregnancy_due_date !== undefined) updateData.pregnancy_due_date = req.body.pregnancy_due_date
    if (req.body.health_condition_disability !== undefined) updateData.health_condition_disability = req.body.health_condition_disability
    if (req.body.health_visual_impairment !== undefined) updateData.health_visual_impairment = req.body.health_visual_impairment
    if (req.body.health_hiv_aids !== undefined) updateData.health_hiv_aids = req.body.health_hiv_aids
    if (req.body.health_other !== undefined) updateData.health_other = req.body.health_other
    if (req.body.health_other_specify !== undefined) updateData.health_other_specify = req.body.health_other_specify
    if (req.body.pension_number !== undefined) updateData.pension_number = req.body.pension_number
    if (req.body.clinic_name !== undefined) updateData.clinic_name = req.body.clinic_name
    if (req.body.clinic_parish !== undefined) updateData.clinic_parish = req.body.clinic_parish
    if (req.body.clinic_number !== undefined) updateData.clinic_number = req.body.clinic_number
    if (req.body.reg_doc_birth_certificate !== undefined) updateData.reg_doc_birth_certificate = req.body.reg_doc_birth_certificate
    if (req.body.reg_doc_id !== undefined) updateData.reg_doc_id = req.body.reg_doc_id
    if (req.body.reg_doc_other !== undefined) updateData.reg_doc_other = req.body.reg_doc_other
    if (req.body.reg_doc_other_specify !== undefined) updateData.reg_doc_other_specify = req.body.reg_doc_other_specify
    if (req.body.sex_code !== undefined) updateData.sex_code = req.body.sex_code

    const { data: member, error: updateError } = await supabase
      .from('family_member')
      .update(updateData)
      .eq('uuid', memberUuid)
      .select()
      .single()

    if (updateError) {
      return res.status(500).json({
        success: false,
        error: `Failed to update member: ${updateError.message}`,
      })
    }

    return res.json({
      success: true,
      data: member,
      message: 'Member updated successfully.',
    })
  } catch (error) {
    console.error('Update member error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to update member.',
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// SAVE ALL FAMILY EDITS WITH HISTORY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/registration/family/:familyUuid/save-edits
 * 
 * Save all family edits at once and record in family_history.
 * Note: familyUuid is the internal UUID (was family_id before migration 006)
 * This creates a single history entry with:
 *   - entity_type: 'FAMILY'
 *   - entity_id: familyUuid
 *   - change_type: 'modified'
 *   - old_value: JSON snapshot before changes
 *   - new_value: JSON snapshot after changes
 *   - changed_by: profile/member id who made changes
 *   - reason: combined reasons for all changes
 */
router.post('/family/:familyUuid/save-edits', async (req: Request, res: Response) => {
  try {
    const { familyUuid } = req.params
    const {
      family: familyUpdates,
      address: addressUpdates,
      members: memberUpdates,
      added_members,
      removed_members,
      status_changes,
      reason,
      changed_by,
    } = req.body

    // Get current state (OLD VALUE)
    const { data: oldFamily, error: familyFetchError } = await supabase
      .from('family')
      .select('*')
      .eq('uuid', familyUuid)
      .single()

    if (familyFetchError || !oldFamily) {
      return res.status(404).json({
        success: false,
        error: 'Family not found.',
      })
    }

    // Get old address (family-level)
    const { data: oldAddress } = await supabase
      .from('address')
      .select('*')
      .eq('entity_type', 'FAMILY')
      .eq('entity_id', familyUuid)
      .eq('address_type', 'PERMANENT')
      .single()

    // Get old members
    const { data: oldMembersRaw } = await supabase
      .from('family_member')
      .select('*')
      .eq('family_uuid', familyUuid)
      .order('created_at', { ascending: true })

    // Enrich members with their addresses and documents
    const enrichMembersWithData = async (members: any[]) => {
      if (!members || members.length === 0) return []
      
      const enrichedMembers = []
      for (const member of members) {
        // Get member's address (entity_id references member.uuid)
        const { data: memberAddress } = await supabase
          .from('address')
          .select('*')
          .eq('entity_type', 'MEMBER')
          .eq('entity_id', member.uuid)
          .single()

        // Get member's documents (owner_id references member.uuid)
        const { data: memberDocs } = await supabase
          .from('document')
          .select('document_id, document_type, file_name')
          .eq('owner_type', 'MEMBER')
          .eq('owner_id', member.uuid)

        enrichedMembers.push({
          ...member,
          address: memberAddress || null,
          documents: memberDocs?.map(d => d.document_id) || [],
        })
      }
      return enrichedMembers
    }

    const oldMembers = await enrichMembersWithData(oldMembersRaw || [])

    // Create old value snapshot (full family state)
    const oldValues = {
      family: oldFamily,
      address: oldAddress || null,
      members: oldMembers,
    }

    const errors: string[] = []
    const changeReasons: string[] = []

    // Apply family updates
    if (familyUpdates && Object.keys(familyUpdates).length > 0) {
      const { error: updateError } = await supabase
        .from('family')
        .update(familyUpdates)
        .eq('uuid', familyUuid)

      if (updateError) {
        errors.push(`Family update failed: ${updateError.message}`)
      } else {
        changeReasons.push('Family details updated')
      }
    }

    // Apply address updates
    if (addressUpdates && Object.keys(addressUpdates).length > 0 && oldAddress) {
      const { error: updateError } = await supabase
        .from('address')
        .update(addressUpdates)
        .eq('address_id', oldAddress.address_id)

      if (updateError) {
        errors.push(`Address update failed: ${updateError.message}`)
      } else {
        changeReasons.push('Address updated')
      }
    }

    // Apply member updates
    if (memberUpdates && Array.isArray(memberUpdates)) {
      for (const memberUpdate of memberUpdates) {
        // member_uuid is the internal UUID (was member_id before migration 006)
        if (!memberUpdate.member_uuid) continue
        
        const { member_uuid, ...updateData } = memberUpdate
        
        if (Object.keys(updateData).length > 0) {
          // Clean national_id if present
          if (updateData.national_id) {
            updateData.national_id = updateData.national_id.replace(/\D/g, '')
          }

          const { error: updateError } = await supabase
            .from('family_member')
            .update(updateData)
            .eq('uuid', member_uuid)
            .eq('family_uuid', familyUuid)

          if (updateError) {
            errors.push(`Member ${member_uuid} update failed: ${updateError.message}`)
          }
        }
      }
      if (memberUpdates.length > 0) {
        changeReasons.push(`${memberUpdates.length} member(s) updated`)
      }
    }

    // Handle added members
    if (added_members && Array.isArray(added_members) && added_members.length > 0) {
      const addedReasons: string[] = []
      let sizeIncrement = 0
      
      // Get family_id (human-readable code like F123) for member_id generation
      const familyCode = oldFamily.family_id || 'F0'
      
      // Count existing members to generate member_id codes
      const { count: existingMemberCount } = await supabase
        .from('family_member')
        .select('*', { count: 'exact', head: true })
        .eq('family_uuid', familyUuid)
      
      let memberCounter = (existingMemberCount || 0) + 1
      
      for (const newMember of added_members) {
        const changeType = newMember.change_type || 'OTHER'
        
        // Only increment household_size for BIRTH, MARRIAGE_IN, ADOPTION_IN
        // NOT for RELOCATION or OTHER
        if (['BIRTH', 'MARRIAGE_IN', 'ADOPTION_IN'].includes(changeType)) {
          sizeIncrement++
        }
        
        // Generate member_id (human-readable code): F123M001, F123M002, etc.
        const memberId = `${familyCode}M${String(memberCounter).padStart(3, '0')}`
        memberCounter++
        
        const memberData = {
          family_uuid: familyUuid,
          member_id: memberId,
          first_name: newMember.first_name,
          last_name: newMember.last_name,
          national_id: newMember.national_id?.replace(/\D/g, '') || null,
          date_of_birth: newMember.date_of_birth || null,
          gender: newMember.gender || null,
          relationship_to_head: newMember.relationship_to_head || 'other',
          marital_status: newMember.marital_status || null,
          phone: newMember.phone || null,
          email: newMember.email || null,
          alive_flag: true,
          member_status: 'ACTIVE',
          change_type: changeType,
          status_reason: newMember.status_reason || null,
          joined_date: newMember.joined_date || new Date().toISOString().split('T')[0],
          annual_income: newMember.annual_income || 0,
        }

        const { error: insertError } = await supabase
          .from('family_member')
          .insert(memberData)

        if (insertError) {
          errors.push(`Add member failed: ${insertError.message}`)
        } else {
          // Specific reason: "Member added: John Doe (BIRTH)"
          addedReasons.push(`Member added: ${newMember.first_name} ${newMember.last_name} (${changeType})`)
        }
      }
      
      // Update household_size only if there are qualifying additions
      if (sizeIncrement > 0) {
        await supabase
          .from('family')
          .update({ household_size: oldFamily.household_size + sizeIncrement })
          .eq('uuid', familyUuid)
      }

      changeReasons.push(...addedReasons)
    }

    // Handle removed members
    if (removed_members && Array.isArray(removed_members) && removed_members.length > 0) {
      const removedReasons: string[] = []
      let sizeDecrement = 0
      
      for (const removal of removed_members) {
        // Frontend sends { uuid, reason, change_type }
        const memberUuid = removal.uuid || removal.member_uuid
        
        // Find member name from old members list (using uuid)
        const memberInfo = oldMembersRaw?.find(m => m.uuid === memberUuid)
        const memberName = memberInfo ? `${memberInfo.first_name} ${memberInfo.last_name}` : 'Unknown'
        const changeType = removal.change_type || 'OTHER'
        
        // Only decrement household_size for DEATH
        // NOT for RELOCATION, MARRIAGE_OUT, or OTHER
        if (changeType === 'DEATH') {
          sizeDecrement++
        }
        
        // Set status based on change type (DEATH = DECEASED, others = TRANSFERRED_OUT)
        const newStatus = changeType === 'DEATH' ? 'DECEASED' : 'TRANSFERRED_OUT'
        const aliveFlag = changeType === 'DEATH' ? false : true
        
        const { error: updateError } = await supabase
          .from('family_member')
          .update({
            member_status: newStatus,
            alive_flag: aliveFlag,
            status_reason: removal.reason || changeType,
            change_type: changeType,
            left_date: new Date().toISOString().split('T')[0],
          })
          .eq('uuid', memberUuid)
          .eq('family_uuid', familyUuid)

        if (updateError) {
          errors.push(`Remove member failed: ${updateError.message}`)
        } else {
          // Specific reason: "Member removed: John Doe (DEATH)"
          removedReasons.push(`Member removed: ${memberName} (${changeType})`)
        }
      }

      // Update household_size only for DEATH
      if (sizeDecrement > 0) {
        await supabase
          .from('family')
          .update({ household_size: Math.max(0, oldFamily.household_size - sizeDecrement) })
          .eq('uuid', familyUuid)
      }

      changeReasons.push(...removedReasons)
    }

    // Handle status changes
    if (status_changes && Array.isArray(status_changes) && status_changes.length > 0) {
      const statusReasons: string[] = []
      let deathDecrement = 0
      let reactivatedCount = 0
      
      for (const statusChange of status_changes) {
        // Frontend sends { uuid, ... } but we also accept member_uuid
        const memberUuid = statusChange.uuid || statusChange.member_uuid
        
        // Find member info from old members list (using uuid)
        const memberInfo = oldMembersRaw?.find(m => m.uuid === memberUuid)
        const memberName = memberInfo ? `${memberInfo.first_name} ${memberInfo.last_name}` : 'Unknown'
        const oldStatus = memberInfo?.member_status || 'ACTIVE'
        
        // PREVENT changing FROM DECEASED - death is permanent
        if (oldStatus === 'DECEASED') {
          errors.push(`Cannot change status of deceased member: ${memberName}`)
          continue
        }
        
        const updateData: Record<string, unknown> = {
          member_status: statusChange.member_status,
          status_reason: statusChange.status_reason || null,
        }

        if (statusChange.member_status === 'DECEASED') {
          updateData.alive_flag = false
          updateData.left_date = statusChange.left_date || new Date().toISOString().split('T')[0]
          updateData.change_type = 'DEATH'
          // Decrement household_size for DECEASED status change
          deathDecrement++
        } else if (statusChange.member_status === 'TRANSFERRED_OUT') {
          updateData.left_date = statusChange.left_date || new Date().toISOString().split('T')[0]
          updateData.change_type = statusChange.change_type || 'OTHER'
          // Note: TRANSFERRED_OUT does NOT decrement household_size per user rules
        } else if (statusChange.member_status === 'ACTIVE') {
          // Reactivating a member - clear left_date and reset alive_flag
          updateData.alive_flag = true
          updateData.left_date = null
          updateData.change_type = 'REACTIVATED'
          // Track if coming back from TRANSFERRED_OUT (they weren't counted before)
          if (oldStatus === 'TRANSFERRED_OUT') {
            reactivatedCount++
          }
        } else if (statusChange.member_status === 'INACTIVE') {
          // INACTIVE keeps alive_flag true, no left_date needed
          updateData.alive_flag = true
          updateData.change_type = 'INACTIVE'
        }

        const { error: updateError } = await supabase
          .from('family_member')
          .update(updateData)
          .eq('uuid', memberUuid)
          .eq('family_uuid', familyUuid)

        if (updateError) {
          errors.push(`Status change failed: ${updateError.message}`)
        } else {
          // Specific reason: "Status changed: John Doe (ACTIVE → DECEASED)"
          statusReasons.push(`Status changed: ${memberName} (${oldStatus} → ${statusChange.member_status})`)
        }
      }
      
      // Update household_size for DECEASED status changes and reactivated members
      if (deathDecrement > 0 || reactivatedCount > 0) {
        // Get current household_size (might have been updated by added/removed members)
        const { data: currentFamily } = await supabase
          .from('family')
          .select('household_size')
          .eq('uuid', familyUuid)
          .single()
        
        const currentSize = currentFamily?.household_size || oldFamily.household_size
        // Subtract deceased, add reactivated (if they were TRANSFERRED_OUT)
        const newSize = Math.max(0, currentSize - deathDecrement + reactivatedCount)
        
        await supabase
          .from('family')
          .update({ household_size: newSize })
          .eq('uuid', familyUuid)
      }
      
      changeReasons.push(...statusReasons)
    }

    // Get NEW state after all changes
    const { data: newFamily } = await supabase
      .from('family')
      .select('*')
      .eq('uuid', familyUuid)
      .single()

    const { data: newAddress } = await supabase
      .from('address')
      .select('*')
      .eq('entity_type', 'FAMILY')
      .eq('entity_id', familyUuid)
      .eq('address_type', 'PERMANENT')
      .single()

    const { data: newMembersRaw } = await supabase
      .from('family_member')
      .select('*')
      .eq('family_uuid', familyUuid)
      .order('created_at', { ascending: true })

    // Enrich new members with their addresses and documents
    const newMembers = await enrichMembersWithData(newMembersRaw || [])

    // Create new value snapshot (full family state)
    const newValues = {
      family: newFamily || oldFamily,
      address: newAddress || oldAddress || null,
      members: newMembers,
    }

    // Combine all reasons
    const combinedReason = [
      ...(reason ? [reason] : []),
      ...changeReasons,
    ].join('; ')

    // Write to family_history with JSON snapshots
    // Actual columns: history_id, entity_type, entity_id, change_type, old_value, new_value, changed_by, changed_at, reason
    const { error: historyError } = await supabase
      .from('family_history')
      .insert({
        entity_type: 'FAMILY',
        entity_id: familyUuid,
        change_type: 'modified',
        old_value: oldValues,
        new_value: newValues,
        changed_by: changed_by || req.headers['x-user-id'] || 'system',
        reason: combinedReason || 'Family details modified',
      })

    if (historyError) {
      console.error('History write failed:', historyError)
      // Don't fail the request, just log
    }

    // Publish event
    await publishEvent('family.updated', {
      family_id: familyUuid,
      entity_id: familyUuid,
      entity_type: 'FAMILY',
      data: {
        changes: changeReasons,
        reason: combinedReason,
      },
      triggered_by: changed_by || req.headers['x-user-id'] as string || 'system',
    })

    if (errors.length > 0) {
      return res.status(207).json({
        success: true,
        partial: true,
        errors,
        data: newValues,
        message: `Saved with ${errors.length} warning(s).`,
      })
    }

    return res.json({
      success: true,
      data: newValues,
      message: 'All changes saved successfully.',
      history_recorded: !historyError,
    })

  } catch (err) {
    console.error('Save edits exception:', err)
    return res.status(500).json({
      success: false,
      error: 'Failed to save edits.',
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// STEP 1: CREATE FAMILY (ROOT ENTITY)
// Everything else links TO the family, not the other way around.
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// CHECK NATIONAL ID — used before family creation to prevent duplicates
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/registration/check-national-id/:nationalId
 *
 * Returns whether any family_member already has this national_id.
 * Used on the family registration page to block duplicates.
 */
router.get('/check-national-id/:nationalId', async (req: Request, res: Response) => {
  try {
    const { nationalId } = req.params
    const cleanNid = nationalId.replace(/\D/g, '')

    if (cleanNid.length !== 14) {
      return res.status(400).json({ success: false, error: 'National ID must be exactly 14 digits' })
    }

    const { data: existingMember } = await supabase
      .from('family_member')
      .select('uuid, first_name, last_name, family_uuid')
      .eq('national_id', cleanNid)
      .limit(1)
      .maybeSingle()

    if (existingMember) {
      return res.json({
        success: true,
        exists: true,
        message: 'A family member with this National ID already exists.',
      })
    }

    return res.json({ success: true, exists: false })
  } catch (err) {
    console.error('Check national_id error:', err)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * POST /api/v1/registration/family
 * 
 * Creates a new family record (the ROOT entity).
 * Returns family_id which is used for all subsequent operations.
 * Status: DRAFT (UPPERCASE)
 * 
 * Required: household_size, head_first_name, head_last_name, head_national_id
 * Optional: phone, email, intake_channel (defaults to 'web_portal')
 * 
 * NOTE: NO permanent_address_id - we use polymorphic address table
 * NOTE: NO history written during partial registration - only on SUBMIT
 */
router.post('/family', async (req: Request, res: Response) => {
  try {
    const { 
      household_size, 
      intake_channel,
      head_first_name,
      head_last_name,
      head_national_id,
      phone,
      email,
      geo_code,
      vulnerability_flag,
    } = req.body

    // Validation
    if (!household_size || household_size < 1) {
      return res.status(400).json({
        success: false,
        error: 'household_size is required and must be at least 1',
      })
    }

    if (!head_first_name || !head_last_name) {
      return res.status(400).json({
        success: false,
        error: 'head_first_name and head_last_name are required (primary contact)',
      })
    }

    // Head national_id is required and must be unique
    if (!head_national_id) {
      return res.status(400).json({
        success: false,
        error: 'head_national_id is required for the head of household',
      })
    }

    const cleanHeadNid = head_national_id.replace(/\D/g, '')
    if (cleanHeadNid.length !== 14) {
      return res.status(400).json({
        success: false,
        error: 'Head National ID must be exactly 14 digits',
      })
    }

    // Check if a member with this national_id already exists
    const { data: existingMember } = await supabase
      .from('family_member')
      .select('uuid, first_name, last_name, family_uuid')
      .eq('national_id', cleanHeadNid)
      .limit(1)
      .maybeSingle()

    if (existingMember) {
      return res.status(409).json({
        success: false,
        error: `A family already exists with a member using this National ID. Registration is not allowed.`,
      })
    }

    // Email validation (if provided)
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format',
      })
    }

    // Generate family_id (human-readable code) using sequence (F1, F2, F3, etc.)
    // Note: family_id is now the human-readable code (was family_code before migration 006)
    // First get the next sequence value
    const { data: seqResult, error: seqError } = await supabase
      .rpc('generate_family_id')  // Renamed from generate_family_code in migration 006
    
    // If the function doesn't exist yet (migration not run), fall back to counting
    let familyId = 'F1'
    if (seqError) {
      // Fallback: count existing families + 1
      const { count } = await supabase
        .from('family')
        .select('*', { count: 'exact', head: true })
      familyId = `F${(count || 0) + 1}`
    } else {
      familyId = seqResult || `F${Date.now()}`
    }

    // Create family record with status=DRAFT (UPPERCASE)
    // NO history during draft - only on SUBMIT
    const familyData: Record<string, unknown> = {
      household_size,
      family_id: familyId,  // human-readable code (was family_code before migration 006)
      intake_channel: intake_channel || 'web_portal',
      registration_status: 'DRAFT', // UPPERCASE per schema
      head_first_name,
      head_last_name,
      phone: phone || null,
      email: email || null,
      geo_code: geo_code || null,
      vulnerability_flag: vulnerability_flag || false,
      // Migration 010: Extended family fields
      programme: req.body.programme || null,
      payment_option: req.body.payment_option || null,
      social_worker_zone: req.body.social_worker_zone || null,
      social_worker_code: req.body.social_worker_code || null,
      application_no: req.body.application_no || null,
      constituency_code: req.body.constituency_code || null,
      head_middle_names: req.body.head_middle_names || null,
      head_alias: req.body.head_alias || null,
      head_mothers_maiden_name: req.body.head_mothers_maiden_name || null,
      mailing_address_different: req.body.mailing_address_different || false,
      directions_to_house: req.body.directions_to_house || null,
    }

    const { data: family, error: familyError } = await supabase
      .from('family')
      .insert(familyData)
      .select()
      .single()

    if (familyError) {
      console.error('Family creation error:', familyError)
      return res.status(500).json({
        success: false,
        error: `Failed to create family: ${familyError.message}`,
      })
    }

    // NOTE: NO history during DRAFT - history is written on SUBMIT only
    // This ensures no partial registration data pollutes the audit trail

    // Publish event to outbox (use uuid for internal references)
    await publishEvent('family.created', {
      family_id: family.uuid,  // uuid is the internal identifier
      data: {
        family_code: family.family_id,  // family_id is now the human-readable code
        household_size: family.household_size,
        intake_channel: family.intake_channel,
        registration_status: family.registration_status,
      },
      triggered_by: req.headers['x-user-id'] as string || 'system',
    })

    return res.status(201).json({
      success: true,
      data: family,
      message: 'Family created. Proceed to Step 2: Add permanent address.',
      next_step: {
        step: 2,
        name: 'permanent_address',
        endpoint: `/api/v1/registration/family/${family.uuid}/address`,
        method: 'POST',
      },
    })

  } catch (err) {
    console.error('Family creation exception:', err)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// STEP 2: CREATE PERMANENT ADDRESS (POLYMORPHIC)
// Uses entity_type='FAMILY', entity_id=family_id, address_type='PERMANENT'
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/registration/family/:familyUuid/address
 * 
 * Creates the family's permanent address using polymorphic model.
 * address_type='PERMANENT', entity_type='FAMILY', entity_id=familyUuid
 * Note: familyUuid is the internal UUID (was family_id before migration 006)
 */
router.post('/family/:familyUuid/address', async (req: Request, res: Response) => {
  try {
    const { familyUuid } = req.params
    const {
      line1,
      line2,
      parish,
      district,
      geo_code,
      valid_from,
    } = req.body

    // Verify family exists
    const { data: family, error: familyError } = await supabase
      .from('family')
      .select('*')
      .eq('uuid', familyUuid)
      .single()

    if (familyError || !family) {
      return res.status(404).json({
        success: false,
        error: 'Family not found. Complete Step 1 first.',
      })
    }

    // Check if family already has a permanent address
    const { data: existingAddress } = await supabase
      .from('address')
      .select('address_id')
      .eq('entity_type', 'FAMILY')
      .eq('entity_id', familyUuid)
      .eq('address_type', 'PERMANENT')
      .single()

    if (existingAddress) {
      return res.status(400).json({
        success: false,
        error: 'Family already has a permanent address. Use PATCH to update.',
        existing_address_id: existingAddress.address_id,
      })
    }

    // Validation
    if (!line1 || !district) {
      return res.status(400).json({
        success: false,
        error: 'line1 and district are required',
      })
    }

    // Create address record with POLYMORPHIC columns (UPPERCASE)
    const addressData: Record<string, unknown> = {
      entity_type: 'FAMILY',      // UPPERCASE
      entity_id: familyUuid,      // Links to family uuid
      address_type: 'PERMANENT',  // UPPERCASE
      line1,
      line2: line2 || null,
      parish: parish || null,
      district,
      geo_code: geo_code || null,
      lot_apt: req.body.lot_apt || null,
      street_district: req.body.street_district || null,
      post_office: req.body.post_office || null,
      post_code: req.body.post_code || null,
      area_type: req.body.area_type || null,
      valid_from: valid_from || new Date().toISOString(),
    }

    const { data: address, error: addressError } = await supabase
      .from('address')
      .insert(addressData)
      .select()
      .single()

    if (addressError) {
      console.error('Address creation error:', addressError)
      return res.status(500).json({
        success: false,
        error: `Failed to create address: ${addressError.message}`,
      })
    }

    // NOTE: NO history during DRAFT - only on SUBMIT

    // Publish event
    await publishEvent('address.created', {
      family_id: familyUuid,
      entity_id: address.address_id,
      entity_type: 'ADDRESS',
      data: { 
        ...address, 
        polymorphic: { entity_type: 'FAMILY', entity_id: familyUuid, address_type: 'PERMANENT' } 
      },
      triggered_by: req.headers['x-user-id'] as string || 'system',
    })

    return res.status(201).json({
      success: true,
      data: address,
      message: 'Permanent address created. Proceed to Step 3: Upload family documents.',
      next_step: {
        step: 3,
        name: 'family_documents',
        endpoint: `/api/v1/registration/family/${familyUuid}/documents`,
        method: 'POST',
      },
    })

  } catch (err) {
    console.error('Address creation exception:', err)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// STEP 3: FAMILY DOCUMENTS (POLYMORPHIC)
// Uses owner_type='FAMILY', owner_id=family_id
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/registration/family/:familyUuid/documents
 * 
 * Upload family-level documents.
 * owner_type='FAMILY', owner_id=familyUuid
 * Note: familyUuid is the internal UUID (was family_id before migration 006)
 */
router.post('/family/:familyUuid/documents', async (req: Request, res: Response) => {
  try {
    const { familyUuid } = req.params
    const { document_type, document_number, file_url } = req.body

    // Verify family exists
    const { data: family, error: familyError } = await supabase
      .from('family')
      .select('uuid')
      .eq('uuid', familyUuid)
      .single()

    if (familyError || !family) {
      return res.status(404).json({
        success: false,
        error: 'Family not found.',
      })
    }

    // Validation
    if (!document_type) {
      return res.status(400).json({
        success: false,
        error: 'document_type is required',
      })
    }

    // Create document record with POLYMORPHIC columns (UPPERCASE)
    const headerUserId = req.headers['x-user-id'] as string | undefined
    const documentData = {
      owner_type: 'FAMILY',       // UPPERCASE
      owner_id: familyUuid,       // Links to family uuid
      document_type,
      document_number: document_number || null,
      file_url: file_url || null, // Will be set by actual upload later
      status: 'PENDING',          // UPPERCASE
      uploaded_at: new Date().toISOString(),
      uploaded_by: isUuid(headerUserId) ? headerUserId : null,
    }

    const { data: document, error: docError } = await supabase
      .from('documents')
      .insert(documentData)
      .select()
      .single()

    if (docError) {
      console.error('Document creation error:', docError)
      return res.status(500).json({
        success: false,
        error: `Failed to create document: ${docError.message}`,
      })
    }

    // NOTE: NO history during DRAFT - only on SUBMIT

    // Publish event
    await publishEvent('document.uploaded', {
      family_id: familyUuid,
      entity_id: document.document_id,
      entity_type: 'DOCUMENT',
      data: { owner_type: 'FAMILY', document_type },
      triggered_by: req.headers['x-user-id'] as string || 'system',
    })

    return res.status(201).json({
      success: true,
      data: document,
      message: 'Document uploaded. Upload more or proceed to Step 5: Add family members.',
      next_step: {
        step: 5,
        name: 'family_members',
        endpoint: `/api/v1/registration/family/${familyUuid}/members`,
        method: 'POST',
        note: 'Step 4 (Account Details) is disabled until benefits are approved.',
      },
    })

  } catch (err) {
    console.error('Document upload exception:', err)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// STEP 4: FAMILY ACCOUNT DETAILS (DISABLED)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/registration/family/:familyUuid/account-info
 * 
 * Returns information about account details (disabled).
 */
router.get('/family/:familyUuid/account-info', async (req: Request, res: Response) => {
  return res.json({
    success: true,
    enabled: false,
    message: 'Account details will be requested when benefits are approved.',
    data: null,
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// STEP 5: CREATE FAMILY MEMBERS
// Number of members MUST equal household_size
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/registration/family/:familyUuid/members
 * 
 * Creates a family member.
 * The FIRST member with relationship_to_head='head' becomes the head.
 * 
 * Note: familyUuid is the internal UUID (was family_id before migration 006)
 * If use_family_address=true, member uses family's PERMANENT address as their CURRENT address.
 * This is handled by creating a reference in the polymorphic address query, NOT by copying.
 */
router.post('/family/:familyUuid/members', async (req: Request, res: Response) => {
  try {
    const { familyUuid } = req.params
    const {
      national_id,
      first_name,
      last_name,
      date_of_birth,
      gender,
      relationship_to_head,
      marital_status,
      alive_flag,
      phone,
      email,
      use_family_address, // If true, member shares family's permanent address (NO address row created)
    } = req.body

    // Verify family exists
    const { data: family, error: familyError } = await supabase
      .from('family')
      .select('*')
      .eq('uuid', familyUuid)
      .single()

    if (familyError || !family) {
      return res.status(404).json({
        success: false,
        error: 'Family not found.',
      })
    }

    // Check current member count
    const { count: memberCount } = await supabase
      .from('family_member')
      .select('*', { count: 'exact', head: true })
      .eq('family_uuid', familyUuid)

    if ((memberCount || 0) >= family.household_size) {
      return res.status(400).json({
        success: false,
        error: `Cannot add more members. Household size is ${family.household_size} and ${memberCount} members already exist.`,
        suggestion: 'Update household_size first if you need to add more members.',
      })
    }

    // Validation
    if (!first_name || !last_name) {
      return res.status(400).json({
        success: false,
        error: 'first_name and last_name are required',
      })
    }

    if (!relationship_to_head) {
      return res.status(400).json({
        success: false,
        error: 'relationship_to_head is required',
      })
    }

    // National ID validation: exactly 14 digits if provided
    if (national_id) {
      const cleanNid = national_id.replace(/\D/g, '')
      if (cleanNid.length !== 14) {
        return res.status(400).json({
          success: false,
          error: 'National ID must be exactly 14 digits',
        })
      }
    }

    // Email validation if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format',
      })
    }

    const validRelationships = ['head', 'spouse', 'child', 'parent', 'sibling', 'grandparent', 'grandchild', 'other']
    if (!validRelationships.includes(relationship_to_head)) {
      return res.status(400).json({
        success: false,
        error: `relationship_to_head must be one of: ${validRelationships.join(', ')}`,
      })
    }

    // Generate member_id (human-readable code): F123M001, F123M002, etc.
    // Note: family.family_id is now the human-readable code (was family_code before migration 006)
    const familyCode = family.family_id || 'F0'
    const memberId = `${familyCode}M${String((memberCount || 0) + 1).padStart(3, '0')}`

    // Create member record with new phone/email fields
    // NOTE: No current_address_id - polymorphic address table handles this
    const memberData: Record<string, unknown> = {
      family_uuid: familyUuid,
      member_id: memberId,  // human-readable code (was member_code before migration 006)
      national_id: national_id ? national_id.replace(/\D/g, '') : null, // Store digits only
      first_name,
      last_name,
      date_of_birth: date_of_birth || null,
      gender: gender || null,
      relationship_to_head,
      marital_status: marital_status || null,
      alive_flag: alive_flag !== false, // Default true
      phone: phone || null,
      email: email || null,
      annual_income: req.body.annual_income || 0,
      // Migration 010: Extended member fields
      middle_names: req.body.middle_names || null,
      alias: req.body.alias || null,
      order_number: req.body.order_number || ((memberCount || 0) + 1),
      trn: req.body.trn || null,
      nis_no: req.body.nis_no || null,
      id_type: req.body.id_type || null,
      id_number: req.body.id_number || null,
      birth_entry_number: req.body.birth_entry_number || null,
      mothers_maiden_name: req.body.mothers_maiden_name || null,
      is_twin: req.body.is_twin || false,
      occupation: req.body.occupation || null,
      contact_no_1: req.body.contact_no_1 || phone || null,
      contact_no_2: req.body.contact_no_2 || null,
      union_status: req.body.union_status || null,
      last_school_completed: req.body.last_school_completed || null,
      school_name: req.body.school_name || null,
      school_code: req.body.school_code || null,
      school_grade: req.body.school_grade || null,
      school_class: req.body.school_class || null,
      school_shift: req.body.school_shift || null,
      pregnant: req.body.pregnant || null,
      pregnancy_due_date: req.body.pregnancy_due_date || null,
      is_disabled: req.body.is_disabled || false,
      is_mentally_ill: req.body.is_mentally_ill || false,
      is_chronically_ill: req.body.is_chronically_ill || false,
      is_shut_in: req.body.is_shut_in || false,
      is_nis_pensioner: req.body.is_nis_pensioner || false,
      pension_number: req.body.pension_number || null,
      clinic_name: req.body.clinic_name || null,
      clinic_code: req.body.clinic_code || null,
      reg_doc_birth_cert: req.body.reg_doc_birth_cert || false,
      reg_doc_declaration: req.body.reg_doc_declaration || false,
      reg_doc_school_records: req.body.reg_doc_school_records || false,
      reg_doc_none: req.body.reg_doc_none || false,
      sex_code: req.body.sex_code || null,
    }

    const { data: member, error: memberError } = await supabase
      .from('family_member')
      .insert(memberData)
      .select()
      .single()

    if (memberError) {
      console.error('Member creation error:', memberError)
      return res.status(500).json({
        success: false,
        error: `Failed to create member: ${memberError.message}`,
      })
    }

    // Handle member address
    // If use_family_address=false and current_address is provided, create address record
    const { current_address } = req.body
    if (!use_family_address && current_address?.line1) {
      const addressData = {
        entity_type: 'MEMBER',
        entity_id: member.uuid,  // use uuid for polymorphic reference
        address_type: 'CURRENT',
        line1: current_address.line1,
        line2: current_address.line2 || null,
        parish: current_address.parish || null,
        district: current_address.district || null,
        geo_code: current_address.geo_code || null,
      }

      const { error: addressError } = await supabase
        .from('address')
        .insert(addressData)

      if (addressError) {
        console.error('Member address creation error:', addressError)
        // Don't fail the whole request, just log the error
      }
    }
    // If use_family_address=true, member implicitly uses family's PERMANENT address
    // NO address row created - queries will fall back to family's address
    
    // NOTE: NO history during DRAFT - only on SUBMIT

    // If this is the head, update family.head_member_uuid
    let updatedFamily = family
    if (relationship_to_head === 'head' && !family.head_member_uuid) {
      const { data: newFamily, error: updateError } = await supabase
        .from('family')
        .update({ head_member_uuid: member.uuid })
        .eq('uuid', familyUuid)
        .select()
        .single()

      if (!updateError && newFamily) {
        updatedFamily = newFamily
        // NOTE: NO history during DRAFT - only on SUBMIT
      }
    }

    // NOTE: NO history during DRAFT - only on SUBMIT
    // History will be written as a COMPLETE snapshot when registration is submitted

    // Publish event (events are OK during draft for real-time tracking)
    await publishEvent('member.added', {
      family_id: familyUuid,
      entity_id: member.uuid,
      entity_type: 'MEMBER',
      data: {
        national_id: member.national_id || null,
        email: member.email || null,
        phone: member.phone || null,
        first_name: member.first_name,
        last_name: member.last_name,
        relationship_to_head: member.relationship_to_head,
        is_head: relationship_to_head === 'head',
        used_family_address: use_family_address || false,
      },
      triggered_by: req.headers['x-user-id'] as string || 'system',
    })

    const currentMemberCount = (memberCount || 0) + 1
    const remainingMembers = family.household_size - currentMemberCount

    return res.status(201).json({
      success: true,
      data: member,
      family: updatedFamily,
      progress: {
        members_added: currentMemberCount,
        household_size: family.household_size,
        remaining: remainingMembers,
      },
      message: remainingMembers > 0
        ? `Member added. ${remainingMembers} more member(s) required.`
        : 'All members added. Proceed to Step 6: Member addresses (if different from family).',
      next_step: remainingMembers > 0
        ? {
            step: 5,
            name: 'add_more_members',
            endpoint: `/api/v1/registration/family/${familyUuid}/members`,
            method: 'POST',
          }
        : {
            step: 6,
            name: 'member_addresses',
            note: 'For members who did not use family address, create their current address.',
          },
    })

  } catch (err) {
    console.error('Member creation exception:', err)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// STEP 6: MEMBER CURRENT ADDRESS (POLYMORPHIC)
// For members who need a different address than family
// Uses entity_type='MEMBER', entity_id=member_id, address_type='CURRENT'
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/registration/member/:memberUuid/address
 * 
 * Creates a current address for a member (if different from family address).
 * entity_type='MEMBER', entity_id=memberUuid, address_type='CURRENT'
 * Note: memberUuid is the internal UUID (was member_id before migration 006)
 */
router.post('/member/:memberUuid/address', async (req: Request, res: Response) => {
  try {
    const { memberUuid } = req.params
    const {
      line1,
      line2,
      parish,
      district,
      geo_code,
      use_family_address, // If true, copy from family's permanent address
    } = req.body

    // Get member and family (family_uuid references family.uuid)
    const { data: member, error: memberError } = await supabase
      .from('family_member')
      .select('*, family:family_uuid(*)')
      .eq('uuid', memberUuid)
      .single()

    if (memberError || !member) {
      return res.status(404).json({
        success: false,
        error: 'Member not found.',
      })
    }

    const familyUuid = member.family_uuid

    // Check if member already has a current address
    const { data: existingAddress } = await supabase
      .from('address')
      .select('address_id')
      .eq('entity_type', 'MEMBER')
      .eq('entity_id', memberUuid)
      .eq('address_type', 'CURRENT')
      .single()

    if (existingAddress) {
      return res.status(400).json({
        success: false,
        error: 'Member already has a current address. Use PATCH to update.',
        existing_address_id: existingAddress.address_id,
      })
    }

    let addressData: Record<string, unknown>

    if (use_family_address) {
      // Get family's permanent address and copy it
      const { data: familyAddress } = await supabase
        .from('address')
        .select('*')
        .eq('entity_type', 'FAMILY')
        .eq('entity_id', familyUuid)
        .eq('address_type', 'PERMANENT')
        .single()

      if (!familyAddress) {
        return res.status(400).json({
          success: false,
          error: 'Family does not have a permanent address yet. Complete Step 2 first.',
        })
      }

      addressData = {
        entity_type: 'MEMBER',
        entity_id: memberUuid,
        address_type: 'CURRENT',
        line1: familyAddress.line1,
        line2: familyAddress.line2,
        parish: familyAddress.parish,
        district: familyAddress.district,
        geo_code: familyAddress.geo_code,
        valid_from: new Date().toISOString(),
      }
    } else {
      // Create new address with provided data
      if (!line1 || !district) {
        return res.status(400).json({
          success: false,
          error: 'line1 and district are required for new address',
        })
      }

      addressData = {
        entity_type: 'MEMBER',      // UPPERCASE
        entity_id: memberUuid,
        address_type: 'CURRENT',    // UPPERCASE
        line1,
        line2: line2 || null,
        parish: parish || null,
        district,
        geo_code: geo_code || null,
        valid_from: new Date().toISOString(),
      }
    }

    const { data: address, error: addressError } = await supabase
      .from('address')
      .insert(addressData)
      .select()
      .single()

    if (addressError) {
      console.error('Address creation error:', addressError)
      return res.status(500).json({
        success: false,
        error: `Failed to create address: ${addressError.message}`,
      })
    }

    // NOTE: NO history during DRAFT - only on SUBMIT

    return res.status(201).json({
      success: true,
      data: address,
      message: 'Member address created. Proceed to Step 7: Upload member documents.',
      next_step: {
        step: 7,
        name: 'member_documents',
        endpoint: `/api/v1/registration/member/${memberUuid}/documents`,
        method: 'POST',
      },
    })

  } catch (err) {
    console.error('Member address exception:', err)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// MAILING ADDRESS (Migration 010)
// Polymorphic: entity_type='FAMILY', entity_id=uuid, address_type='MAILING'
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/registration/family/:familyUuid/mailing-address
 * 
 * Create or replace family mailing address.
 * If mailing_address_different is false, copies from permanent address.
 */
router.post('/family/:familyUuid/mailing-address', async (req: Request, res: Response) => {
  try {
    const { familyUuid } = req.params
    const { same_as_permanent, line1, line2, parish, district, geo_code, lot_apt, street_district, post_office, post_code, area_type } = req.body

    // Verify family exists
    const { data: family, error: familyError } = await supabase
      .from('family')
      .select('uuid')
      .eq('uuid', familyUuid)
      .single()

    if (familyError || !family) {
      return res.status(404).json({ success: false, error: 'Family not found.' })
    }

    // Delete existing mailing address if any
    await supabase
      .from('address')
      .delete()
      .eq('entity_type', 'FAMILY')
      .eq('entity_id', familyUuid)
      .eq('address_type', 'MAILING')

    let addressData: Record<string, unknown>

    if (same_as_permanent) {
      // Copy from permanent address
      const { data: permanentAddr } = await supabase
        .from('address')
        .select('*')
        .eq('entity_type', 'FAMILY')
        .eq('entity_id', familyUuid)
        .eq('address_type', 'PERMANENT')
        .single()

      if (!permanentAddr) {
        return res.status(400).json({ success: false, error: 'No permanent address found to copy from.' })
      }

      addressData = {
        entity_type: 'FAMILY',
        entity_id: familyUuid,
        address_type: 'MAILING',
        line1: permanentAddr.line1,
        line2: permanentAddr.line2,
        parish: permanentAddr.parish,
        district: permanentAddr.district,
        geo_code: permanentAddr.geo_code,
        lot_apt: permanentAddr.lot_apt,
        street_district: permanentAddr.street_district,
        post_office: permanentAddr.post_office,
        post_code: permanentAddr.post_code,
        area_type: permanentAddr.area_type,
        valid_from: new Date().toISOString(),
      }

      // Update family flag
      await supabase
        .from('family')
        .update({ mailing_address_different: false })
        .eq('uuid', familyUuid)
    } else {
      addressData = {
        entity_type: 'FAMILY',
        entity_id: familyUuid,
        address_type: 'MAILING',
        line1: line1 || null,
        line2: line2 || null,
        parish: parish || null,
        district: district || null,
        geo_code: geo_code || null,
        lot_apt: lot_apt || null,
        street_district: street_district || null,
        post_office: post_office || null,
        post_code: post_code || null,
        area_type: area_type || null,
        valid_from: new Date().toISOString(),
      }

      // Update family flag
      await supabase
        .from('family')
        .update({ mailing_address_different: true })
        .eq('uuid', familyUuid)
    }

    const { data: address, error: addrError } = await supabase
      .from('address')
      .insert(addressData)
      .select()
      .single()

    if (addrError) {
      return res.status(500).json({ success: false, error: `Failed to create mailing address: ${addrError.message}` })
    }

    return res.status(201).json({
      success: true,
      data: address,
      message: 'Mailing address saved.',
    })
  } catch (err) {
    console.error('Mailing address exception:', err)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * GET /api/v1/registration/family/:familyUuid/mailing-address
 */
router.get('/family/:familyUuid/mailing-address', async (req: Request, res: Response) => {
  try {
    const { familyUuid } = req.params

    const { data: address } = await supabase
      .from('address')
      .select('*')
      .eq('entity_type', 'FAMILY')
      .eq('entity_id', familyUuid)
      .eq('address_type', 'MAILING')
      .single()

    return res.json({ success: true, data: address || null })
  } catch (err) {
    console.error('Get mailing address error:', err)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * PUT /api/v1/registration/family/:familyUuid/mailing-address
 */
router.put('/family/:familyUuid/mailing-address', async (req: Request, res: Response) => {
  try {
    const { familyUuid } = req.params

    const { data: existingAddr } = await supabase
      .from('address')
      .select('address_id')
      .eq('entity_type', 'FAMILY')
      .eq('entity_id', familyUuid)
      .eq('address_type', 'MAILING')
      .single()

    if (!existingAddr) {
      return res.status(404).json({ success: false, error: 'Mailing address not found. Use POST to create.' })
    }

    const updateData: Record<string, unknown> = {}
    const fields = ['line1', 'line2', 'parish', 'district', 'geo_code', 'lot_apt', 'street_district', 'post_office', 'post_code', 'area_type']
    for (const f of fields) {
      if (req.body[f] !== undefined) updateData[f] = req.body[f]
    }

    const { data: address, error: updateError } = await supabase
      .from('address')
      .update(updateData)
      .eq('address_id', existingAddr.address_id)
      .select()
      .single()

    if (updateError) {
      return res.status(500).json({ success: false, error: `Failed to update mailing address: ${updateError.message}` })
    }

    return res.json({ success: true, data: address, message: 'Mailing address updated.' })
  } catch (err) {
    console.error('Update mailing address error:', err)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// HOUSE SERVICES (Migration 010 - Section 3 of Jamaica Form)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/registration/family/:familyUuid/house-services
 * 
 * Create or replace house services record for a family.
 */
router.post('/family/:familyUuid/house-services', async (req: Request, res: Response) => {
  try {
    const { familyUuid } = req.params

    // Verify family exists
    const { data: family, error: familyError } = await supabase
      .from('family')
      .select('uuid')
      .eq('uuid', familyUuid)
      .single()

    if (familyError || !family) {
      return res.status(404).json({ success: false, error: 'Family not found.' })
    }

    // Delete existing house services if any (upsert behavior)
    await supabase
      .from('house_services')
      .delete()
      .eq('family_uuid', familyUuid)

    const hsData: Record<string, unknown> = {
      family_uuid: familyUuid,
      dwelling_tenure: req.body.dwelling_tenure || null,
      utilities_electricity: req.body.utilities_electricity ?? false,
      utilities_gas: req.body.utilities_gas ?? false,
      utilities_telephone: req.body.utilities_telephone ?? false,
      water_piped_internal: req.body.water_piped_internal ?? false,
      water_piped_external: req.body.water_piped_external ?? false,
      water_tank: req.body.water_tank ?? false,
      water_river_spring: req.body.water_river_spring ?? false,
      sanitation_wc_sewage: req.body.sanitation_wc_sewage ?? false,
      sanitation_wc_septic: req.body.sanitation_wc_septic ?? false,
      sanitation_pit_latrine: req.body.sanitation_pit_latrine ?? false,
      sanitation_other: req.body.sanitation_other ?? false,
      has_refrigerator: req.body.has_refrigerator ?? false,
      has_living_room_set: req.body.has_living_room_set ?? false,
      has_dining_room_set: req.body.has_dining_room_set ?? false,
      has_washing_machine: req.body.has_washing_machine ?? false,
      has_stove_gas: req.body.has_stove_gas ?? false,
      has_stove_electric: req.body.has_stove_electric ?? false,
      has_stove_kerosene: req.body.has_stove_kerosene ?? false,
      has_tv: req.body.has_tv ?? false,
      has_radio: req.body.has_radio ?? false,
      has_stereo: req.body.has_stereo ?? false,
      has_computer: req.body.has_computer ?? false,
      has_cable_tv: req.body.has_cable_tv ?? false,
      has_dvd_player: req.body.has_dvd_player ?? false,
      has_bed: req.body.has_bed ?? false,
      has_motor_vehicle: req.body.has_motor_vehicle ?? false,
      has_motorcycle: req.body.has_motorcycle ?? false,
      has_bicycle: req.body.has_bicycle ?? false,
      has_cellphone: req.body.has_cellphone ?? false,
      has_sewing_machine: req.body.has_sewing_machine ?? false,
      weekly_family_spending: req.body.weekly_family_spending ?? null,
      monthly_rent: req.body.monthly_rent ?? null,
      total_income: req.body.total_income ?? null,
      number_of_rooms: req.body.number_of_rooms ?? null,
      number_of_bedrooms: req.body.number_of_bedrooms ?? null,
    }

    const { data: houseServices, error: hsError } = await supabase
      .from('house_services')
      .insert(hsData)
      .select()
      .single()

    if (hsError) {
      return res.status(500).json({ success: false, error: `Failed to create house services: ${hsError.message}` })
    }

    return res.status(201).json({
      success: true,
      data: houseServices,
      message: 'House services saved.',
    })
  } catch (err) {
    console.error('House services create exception:', err)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * GET /api/v1/registration/family/:familyUuid/house-services
 */
router.get('/family/:familyUuid/house-services', async (req: Request, res: Response) => {
  try {
    const { familyUuid } = req.params

    const { data: houseServices } = await supabase
      .from('house_services')
      .select('*')
      .eq('family_uuid', familyUuid)
      .single()

    return res.json({ success: true, data: houseServices || null })
  } catch (err) {
    console.error('Get house services error:', err)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * PUT /api/v1/registration/family/:familyUuid/house-services
 */
router.put('/family/:familyUuid/house-services', async (req: Request, res: Response) => {
  try {
    const { familyUuid } = req.params

    const { data: existing } = await supabase
      .from('house_services')
      .select('id')
      .eq('family_uuid', familyUuid)
      .single()

    if (!existing) {
      return res.status(404).json({ success: false, error: 'House services not found. Use POST to create.' })
    }

    const updateData: Record<string, unknown> = {}
    const hsFields = [
      'dwelling_tenure', 'utilities_electricity', 'utilities_gas', 'utilities_telephone',
      'water_piped_internal', 'water_piped_external', 'water_tank', 'water_river_spring',
      'sanitation_wc_sewage', 'sanitation_wc_septic', 'sanitation_pit_latrine', 'sanitation_other',
      'has_refrigerator', 'has_living_room_set', 'has_dining_room_set', 'has_washing_machine',
      'has_stove_gas', 'has_stove_electric', 'has_stove_kerosene', 'has_tv', 'has_radio',
      'has_stereo', 'has_computer', 'has_cable_tv', 'has_dvd_player', 'has_bed',
      'has_motor_vehicle', 'has_motorcycle', 'has_bicycle', 'has_cellphone', 'has_sewing_machine',
      'weekly_family_spending', 'monthly_rent', 'total_income', 'number_of_rooms', 'number_of_bedrooms',
    ]
    for (const f of hsFields) {
      if (req.body[f] !== undefined) updateData[f] = req.body[f]
    }

    const { data: houseServices, error: updateError } = await supabase
      .from('house_services')
      .update(updateData)
      .eq('id', existing.id)
      .select()
      .single()

    if (updateError) {
      return res.status(500).json({ success: false, error: `Failed to update house services: ${updateError.message}` })
    }

    return res.json({ success: true, data: houseServices, message: 'House services updated.' })
  } catch (err) {
    console.error('Update house services error:', err)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// STEP 7: MEMBER DOCUMENTS (POLYMORPHIC)
// Uses owner_type='MEMBER', owner_id=member_id
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/registration/member/:memberUuid/documents
 * 
 * Upload member-level documents.
 * owner_type='MEMBER', owner_id=memberUuid
 * Note: memberUuid is the internal UUID (was member_id before migration 006)
 */
router.post('/member/:memberUuid/documents', async (req: Request, res: Response) => {
  try {
    const { memberUuid } = req.params
    const { document_type, document_number, file_url } = req.body

    // Verify member exists
    const { data: member, error: memberError } = await supabase
      .from('family_member')
      .select('uuid, family_uuid')
      .eq('uuid', memberUuid)
      .single()

    if (memberError || !member) {
      return res.status(404).json({
        success: false,
        error: 'Member not found.',
      })
    }

    if (!document_type) {
      return res.status(400).json({
        success: false,
        error: 'document_type is required',
      })
    }

    // Create document record with POLYMORPHIC columns (UPPERCASE)
    const headerUserId = req.headers['x-user-id'] as string | undefined
    const documentData = {
      owner_type: 'MEMBER',       // UPPERCASE
      owner_id: memberUuid,       // Links to member uuid
      document_type,
      document_number: document_number || null,
      file_url: file_url || null,
      status: 'PENDING',          // UPPERCASE
      uploaded_at: new Date().toISOString(),
      uploaded_by: isUuid(headerUserId) ? headerUserId : null,
    }

    const { data: document, error: docError } = await supabase
      .from('documents')
      .insert(documentData)
      .select()
      .single()

    if (docError) {
      console.error('Document creation error:', docError)
      return res.status(500).json({
        success: false,
        error: `Failed to create document: ${docError.message}`,
      })
    }

    // NOTE: NO history during DRAFT - only on SUBMIT

    // Publish event
    await publishEvent('document.uploaded', {
      family_id: member.family_uuid,
      entity_id: document.document_id,
      entity_type: 'DOCUMENT',
      data: { owner_type: 'MEMBER', member_uuid: memberUuid, document_type },
      triggered_by: req.headers['x-user-id'] as string || 'system',
    })

    return res.status(201).json({
      success: true,
      data: document,
      message: 'Document uploaded. Upload more or proceed to Step 9: Review & Submit.',
    })

  } catch (err) {
    console.error('Member document exception:', err)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// STEP 8: MEMBER ACCOUNT DETAILS (DISABLED)
// ═══════════════════════════════════════════════════════════════════════════

router.get('/member/:memberUuid/account-info', async (req: Request, res: Response) => {
  return res.json({
    success: true,
    enabled: false,
    message: 'Account details will be requested when benefits are approved.',
    data: null,
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// STEP 9: REVIEW & SUBMIT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/registration/family/:familyUuid/review
 * 
 * Get complete family data for review before submission.
 * Uses polymorphic address queries.
 * Note: familyUuid is the internal UUID (was family_id before migration 006)
 */
router.get('/family/:familyUuid/review', async (req: Request, res: Response) => {
  try {
    const { familyUuid } = req.params

    // Get family
    const { data: family, error: familyError } = await supabase
      .from('family')
      .select('*')
      .eq('uuid', familyUuid)
      .single()

    if (familyError || !family) {
      return res.status(404).json({
        success: false,
        error: 'Family not found.',
      })
    }

    // Get family's permanent address (POLYMORPHIC)
    const { data: permanentAddress } = await supabase
      .from('address')
      .select('*')
      .eq('entity_type', 'FAMILY')
      .eq('entity_id', familyUuid)
      .eq('address_type', 'PERMANENT')
      .single()

    // Get family's mailing address (POLYMORPHIC) - Migration 010
    const { data: mailingAddress } = await supabase
      .from('address')
      .select('*')
      .eq('entity_type', 'FAMILY')
      .eq('entity_id', familyUuid)
      .eq('address_type', 'MAILING')
      .single()

    // Get house services - Migration 010
    const { data: houseServices } = await supabase
      .from('house_services')
      .select('*')
      .eq('family_uuid', familyUuid)
      .single()

    // Get all members
    const { data: members } = await supabase
      .from('family_member')
      .select('*')
      .eq('family_uuid', familyUuid)
      .order('created_at', { ascending: true })

    // Get member addresses (POLYMORPHIC) - using member uuid
    const memberUuids = (members || []).map(m => m.uuid)
    const { data: memberAddresses } = await supabase
      .from('address')
      .select('*')
      .eq('entity_type', 'MEMBER')
      .eq('address_type', 'CURRENT')
      .in('entity_id', memberUuids.length > 0 ? memberUuids : ['none'])

    // Create member-address lookup
    const memberAddressMap: Record<string, unknown> = {}
    for (const addr of memberAddresses || []) {
      memberAddressMap[addr.entity_id] = addr
    }

    // Attach addresses to members
    const membersWithAddresses = (members || []).map(m => ({
      ...m,
      current_address: memberAddressMap[m.uuid] || null,
    }))

    // Get family documents (POLYMORPHIC)
    const { data: familyDocuments } = await supabase
      .from('documents')
      .select('*')
      .eq('owner_type', 'FAMILY')
      .eq('owner_id', familyUuid)

    // Get member documents (POLYMORPHIC)
    const { data: memberDocuments } = await supabase
      .from('documents')
      .select('*')
      .eq('owner_type', 'MEMBER')
      .in('owner_id', memberUuids.length > 0 ? memberUuids : ['none'])

    // Validation checks
    const validationErrors: string[] = []

    if (!permanentAddress) {
      validationErrors.push('Missing family permanent address')
    }

    if ((members || []).length !== family.household_size) {
      validationErrors.push(`Member count (${(members || []).length}) does not match household_size (${family.household_size})`)
    }

    const hasHead = (members || []).some(m => m.relationship_to_head === 'head')
    if (!hasHead) {
      validationErrors.push('No head of household designated')
    }

    return res.json({
      success: true,
      data: {
        family,
        permanent_address: permanentAddress,
        mailing_address: mailingAddress || null,
        house_services: houseServices || null,
        members: membersWithAddresses,
        family_documents: familyDocuments || [],
        member_documents: memberDocuments || [],
      },
      validation: {
        is_valid: validationErrors.length === 0,
        errors: validationErrors,
      },
      can_submit: validationErrors.length === 0,
    })

  } catch (err) {
    console.error('Review exception:', err)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
})

/**
 * POST /api/v1/registration/family/:familyUuid/save-draft
 * 
 * Save current progress as draft.
 * Note: familyUuid is the internal UUID (was family_id before migration 006)
 */
router.post('/family/:familyUuid/save-draft', async (req: Request, res: Response) => {
  try {
    const { familyUuid } = req.params

    const { data: family, error: familyError } = await supabase
      .from('family')
      .select('*')
      .eq('uuid', familyUuid)
      .single()

    if (familyError || !family) {
      return res.status(404).json({
        success: false,
        error: 'Family not found.',
      })
    }

    // Ensure status is DRAFT
    if (family.registration_status !== 'DRAFT') {
      return res.status(400).json({
        success: false,
        error: `Cannot save draft. Current status is: ${family.registration_status}`,
      })
    }

    // Write history - familyUuid first
    await writeHistory(updateHistoryEntry(
      familyUuid,
      'FAMILY',
      familyUuid,
      { registration_status: 'DRAFT' },
      { registration_status: 'DRAFT', _action: 'save_draft', _saved_at: new Date().toISOString() },
      req.headers['x-user-id'] as string || 'system'
    ))

    return res.json({
      success: true,
      message: 'Draft saved successfully.',
      data: family,
    })

  } catch (err) {
    console.error('Save draft exception:', err)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
})

/**
 * POST /api/v1/registration/family/:familyUuid/submit
 * 
 * Submit family registration.
 * Status changes from DRAFT to SUBMITTED (UPPERCASE).
 * Note: familyUuid is the internal UUID (was family_id before migration 006)
 */
router.post('/family/:familyUuid/submit', async (req: Request, res: Response) => {
  try {
    const { familyUuid } = req.params

    // Get family with validation
    const { data: family, error: familyError } = await supabase
      .from('family')
      .select('*')
      .eq('uuid', familyUuid)
      .single()

    if (familyError || !family) {
      return res.status(404).json({
        success: false,
        error: 'Family not found.',
      })
    }

    if (family.registration_status !== 'DRAFT') {
      return res.status(400).json({
        success: false,
        error: `Cannot submit. Current status is: ${family.registration_status}`,
      })
    }

    // Validate: Family must have permanent address (POLYMORPHIC)
    const { data: permanentAddress } = await supabase
      .from('address')
      .select('address_id')
      .eq('entity_type', 'FAMILY')
      .eq('entity_id', familyUuid)
      .eq('address_type', 'PERMANENT')
      .single()

    if (!permanentAddress) {
      return res.status(400).json({
        success: false,
        error: 'Cannot submit. Family does not have a permanent address.',
      })
    }

    // Validate member count — auto-update household_size to actual count
    const { count: memberCount } = await supabase
      .from('family_member')
      .select('*', { count: 'exact', head: true })
      .eq('family_uuid', familyUuid)

    if ((memberCount || 0) < 1) {
      return res.status(400).json({
        success: false,
        error: 'Cannot submit. At least one family member is required.',
      })
    }

    // Validate head exists
    const { data: head } = await supabase
      .from('family_member')
      .select('uuid')
      .eq('family_uuid', familyUuid)
      .eq('relationship_to_head', 'head')
      .single()

    if (!head) {
      return res.status(400).json({
        success: false,
        error: 'Cannot submit. No head of household designated.',
      })
    }

    // Update to SUBMITTED (UPPERCASE) and sync household_size to actual member count
    const oldStatus = family.registration_status
    const submittedAt = new Date().toISOString()
    const actualMemberCount = memberCount || 1
    
    const { data: updatedFamily, error: updateError } = await supabase
      .from('family')
      .update({
        registration_status: 'SUBMITTED', // UPPERCASE
        submitted_at: submittedAt,
        household_size: actualMemberCount,  // Sync to actual members
      })
      .eq('uuid', familyUuid)
      .select()
      .single()

    if (updateError) {
      console.error('Submit error:', updateError)
      return res.status(500).json({
        success: false,
        error: `Failed to submit: ${updateError.message}`,
      })
    }

    // Write history - using submitHistoryEntry for SUBMIT action
    await writeHistory(submitHistoryEntry(
      familyUuid,
      'FAMILY',
      familyUuid,
      { registration_status: oldStatus },
      { registration_status: 'SUBMITTED', submitted_at: submittedAt },
      req.headers['x-user-id'] as string || 'system'
    ))

    // Publish event
    await publishEvent('family.submitted', {
      family_id: familyUuid,
      data: {
        submitted_at: submittedAt,
        household_size: family.household_size,
        member_count: memberCount,
        previous_status: oldStatus,
        new_status: 'SUBMITTED',
      },
      triggered_by: req.headers['x-user-id'] as string || 'system',
    })

    return res.json({
      success: true,
      message: 'Registration submitted successfully.',
      data: updatedFamily,
    })

  } catch (err) {
    console.error('Submit exception:', err)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY: Get registration progress
// ═══════════════════════════════════════════════════════════════════════════

router.get('/family/:familyUuid/progress', async (req: Request, res: Response) => {
  try {
    const { familyUuid } = req.params

    const { data: family } = await supabase
      .from('family')
      .select('*')
      .eq('uuid', familyUuid)
      .single()

    if (!family) {
      return res.status(404).json({
        success: false,
        error: 'Family not found.',
      })
    }

    // Check for permanent address (POLYMORPHIC)
    const { data: permanentAddress } = await supabase
      .from('address')
      .select('address_id')
      .eq('entity_type', 'FAMILY')
      .eq('entity_id', familyUuid)
      .eq('address_type', 'PERMANENT')
      .single()

    const { count: memberCount } = await supabase
      .from('family_member')
      .select('*', { count: 'exact', head: true })
      .eq('family_uuid', familyUuid)

    const { count: familyDocCount } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('owner_type', 'FAMILY')
      .eq('owner_id', familyUuid)

    const steps = [
      { step: 1, name: 'family_details', completed: true }, // Always true if family exists
      { step: 2, name: 'permanent_address', completed: !!permanentAddress },
      { step: 3, name: 'family_documents', completed: (familyDocCount || 0) > 0 },
      { step: 4, name: 'family_account', completed: true, disabled: true }, // Always "complete" (disabled)
      { step: 5, name: 'family_members', completed: (memberCount || 0) === family.household_size },
      { step: 6, name: 'member_addresses', completed: true }, // Assumed complete after members
      { step: 7, name: 'member_documents', completed: true }, // Optional
      { step: 8, name: 'member_accounts', completed: true, disabled: true },
      { step: 9, name: 'review_submit', completed: family.registration_status !== 'DRAFT' },
    ]

    const currentStep = steps.find(s => !s.completed && !s.disabled)?.step || 9

    return res.json({
      success: true,
      data: {
        family_uuid: familyUuid,
        registration_status: family.registration_status,
        current_step: currentStep,
        steps,
        summary: {
          household_size: family.household_size,
          members_added: memberCount || 0,
          has_address: !!permanentAddress,
          family_documents: familyDocCount || 0,
        },
      },
    })

  } catch (err) {
    console.error('Progress exception:', err)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// MEMBER MANAGEMENT (EDIT MODE) - Add/Update/Remove Members
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/registration/family/:familyUuid/members/add
 * 
 * Add a new member to an existing family (after initial registration).
 * Use cases: Birth, Marriage (spouse joins), Adoption, etc.
 * Note: familyUuid is the internal UUID (was family_id before migration 006)
 */
router.post('/family/:familyUuid/members/add', async (req: Request, res: Response) => {
  try {
    const { familyUuid } = req.params
    const {
      first_name,
      last_name,
      national_id,
      date_of_birth,
      gender,
      relationship_to_head,
      marital_status,
      phone,
      email,
      change_type, // BIRTH, MARRIAGE_IN, ADOPTION_IN, OTHER
      status_reason,
      joined_date,
    } = req.body

    // Verify family exists
    const { data: family, error: familyError } = await supabase
      .from('family')
      .select('*')
      .eq('uuid', familyUuid)
      .single()

    if (familyError || !family) {
      return res.status(404).json({
        success: false,
        error: 'Family not found.',
      })
    }

    // Validation
    if (!first_name || !last_name) {
      return res.status(400).json({
        success: false,
        error: 'first_name and last_name are required',
      })
    }

    // Valid change types for adding a member
    const validChangeTypes = ['BIRTH', 'MARRIAGE_IN', 'ADOPTION_IN', 'RELOCATION', 'OTHER']
    if (change_type && !validChangeTypes.includes(change_type)) {
      return res.status(400).json({
        success: false,
        error: `change_type must be one of: ${validChangeTypes.join(', ')}`,
      })
    }

    // Create member with new fields
    const memberData = {
      family_uuid: familyUuid,
      first_name,
      last_name,
      national_id: national_id ? national_id.replace(/\D/g, '') : null,
      date_of_birth: date_of_birth || null,
      gender: gender || null,
      relationship_to_head: relationship_to_head || 'other',
      marital_status: marital_status || null,
      phone: phone || null,
      email: email || null,
      alive_flag: true,
      member_status: 'ACTIVE',
      change_type: change_type || 'OTHER',
      status_reason: status_reason || null,
      joined_date: joined_date || new Date().toISOString().split('T')[0],
    }

    const { data: member, error: memberError } = await supabase
      .from('family_member')
      .insert(memberData)
      .select()
      .single()

    if (memberError) {
      console.error('Member add error:', memberError)
      return res.status(500).json({
        success: false,
        error: `Failed to add member: ${memberError.message}`,
      })
    }

    // Update family household_size
    const { error: updateError } = await supabase
      .from('family')
      .update({ household_size: family.household_size + 1 })
      .eq('uuid', familyUuid)

    if (updateError) {
      console.error('Household size update error:', updateError)
    }

    // Log the transfer/addition
    await supabase.from('member_transfer_log').insert({
      member_uuid: member.uuid,
      family_uuid: familyUuid,
      action: 'JOINED',
      old_status: null,
      new_status: 'ACTIVE',
      change_type: change_type || 'OTHER',
      reason: status_reason || `New member added: ${change_type || 'Manual addition'}`,
      effective_date: joined_date || new Date().toISOString().split('T')[0],
      recorded_by: req.headers['x-user-id'] as string || 'system',
    })

    // Publish event
    await publishEvent('member.added', {
      family_id: familyUuid,
      entity_id: member.uuid,
      entity_type: 'MEMBER',
      data: {
        national_id: member.national_id || null,
        email: member.email || null,
        phone: member.phone || null,
        first_name: member.first_name,
        last_name: member.last_name,
        change_type: change_type || 'OTHER',
        is_post_registration: true,
      },
      triggered_by: req.headers['x-user-id'] as string || 'system',
    })

    return res.status(201).json({
      success: true,
      data: member,
      message: `Member ${first_name} ${last_name} added successfully.`,
    })

  } catch (err) {
    console.error('Member add exception:', err)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
})

/**
 * PATCH /api/v1/registration/family/:familyUuid/members/:memberUuid/status
 * 
 * Update member status (ACTIVE, INACTIVE, DECEASED, TRANSFERRED_OUT).
 * This is for changing status AFTER initial registration.
 * Note: familyUuid/memberUuid are internal UUIDs (was family_id/member_id before migration 006)
 */
router.patch('/family/:familyUuid/members/:memberUuid/status', async (req: Request, res: Response) => {
  try {
    const { familyUuid, memberUuid } = req.params
    const {
      member_status, // ACTIVE, INACTIVE, DECEASED, TRANSFERRED_OUT
      status_reason,
      change_type, // DEATH, MARRIAGE_OUT, ADOPTION_OUT, RELOCATION, OTHER
      left_date,
    } = req.body

    // Verify member exists and belongs to family
    const { data: existingMember, error: fetchError } = await supabase
      .from('family_member')
      .select('*')
      .eq('uuid', memberUuid)
      .eq('family_uuid', familyUuid)
      .single()

    if (fetchError || !existingMember) {
      return res.status(404).json({
        success: false,
        error: 'Member not found.',
      })
    }

    const validStatuses = ['ACTIVE', 'INACTIVE', 'DECEASED', 'TRANSFERRED_OUT']
    if (!validStatuses.includes(member_status)) {
      return res.status(400).json({
        success: false,
        error: `member_status must be one of: ${validStatuses.join(', ')}`,
      })
    }

    const oldStatus = existingMember.member_status || 'ACTIVE'

    // Build update data
    const updateData: Record<string, unknown> = {
      member_status,
      status_reason: status_reason || null,
    }

    // If deceased or transferred out, set alive_flag and left_date
    if (member_status === 'DECEASED') {
      updateData.alive_flag = false
      updateData.left_date = left_date || new Date().toISOString().split('T')[0]
      updateData.change_type = 'DEATH'
    } else if (member_status === 'TRANSFERRED_OUT') {
      updateData.left_date = left_date || new Date().toISOString().split('T')[0]
      updateData.change_type = change_type || 'OTHER'
    } else if (member_status === 'ACTIVE') {
      updateData.alive_flag = true
      updateData.left_date = null
    }

    const { data: member, error: updateError } = await supabase
      .from('family_member')
      .update(updateData)
      .eq('uuid', memberUuid)
      .select()
      .single()

    if (updateError) {
      return res.status(500).json({
        success: false,
        error: `Failed to update member status: ${updateError.message}`,
      })
    }

    // Update household_size if member is leaving
    if ((member_status === 'DECEASED' || member_status === 'TRANSFERRED_OUT') && oldStatus === 'ACTIVE') {
      const { data: family } = await supabase
        .from('family')
        .select('household_size')
        .eq('uuid', familyUuid)
        .single()

      if (family && family.household_size > 0) {
        await supabase
          .from('family')
          .update({ household_size: family.household_size - 1 })
          .eq('uuid', familyUuid)
      }
    }

    // Log the status change
    await supabase.from('member_transfer_log').insert({
      member_uuid: memberUuid,
      family_uuid: familyUuid,
      action: member_status === 'DECEASED' ? 'DEATH' : 'STATUS_CHANGE',
      old_status: oldStatus,
      new_status: member_status,
      change_type: change_type || updateData.change_type || 'OTHER',
      reason: status_reason,
      effective_date: left_date || new Date().toISOString().split('T')[0],
      recorded_by: req.headers['x-user-id'] as string || 'system',
    })

    // Publish event
    await publishEvent('member.status_changed', {
      family_id: familyUuid,
      entity_id: memberUuid,
      entity_type: 'MEMBER',
      data: {
        old_status: oldStatus,
        new_status: member_status,
        change_type,
        reason: status_reason,
      },
      triggered_by: req.headers['x-user-id'] as string || 'system',
    })

    return res.json({
      success: true,
      data: member,
      message: `Member status updated to ${member_status}.`,
    })

  } catch (err) {
    console.error('Member status update exception:', err)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
})

/**
 * DELETE /api/v1/registration/family/:familyUuid/members/:memberUuid
 * 
 * Soft-delete a member (sets status to TRANSFERRED_OUT).
 * Hard delete only for DRAFT families or if explicitly requested.
 * Note: familyUuid/memberUuid are internal UUIDs (was family_id/member_id before migration 006)
 */
router.delete('/family/:familyUuid/members/:memberUuid', async (req: Request, res: Response) => {
  try {
    const { familyUuid, memberUuid } = req.params
    const { hard_delete, reason, change_type } = req.body || {}

    // Verify member exists
    const { data: member, error: fetchError } = await supabase
      .from('family_member')
      .select('*')
      .eq('uuid', memberUuid)
      .eq('family_uuid', familyUuid)
      .single()

    if (fetchError || !member) {
      return res.status(404).json({
        success: false,
        error: 'Member not found.',
      })
    }

    // Get family to check status
    const { data: family } = await supabase
      .from('family')
      .select('registration_status, household_size')
      .eq('uuid', familyUuid)
      .single()

    // Hard delete only allowed for DRAFT families or explicit request
    if (hard_delete || family?.registration_status === 'DRAFT') {
      // Actually delete the member
      const { error: deleteError } = await supabase
        .from('family_member')
        .delete()
        .eq('uuid', memberUuid)

      if (deleteError) {
        return res.status(500).json({
          success: false,
          error: `Failed to delete member: ${deleteError.message}`,
        })
      }

      // Update household_size
      if (family && family.household_size > 0) {
        await supabase
          .from('family')
          .update({ household_size: family.household_size - 1 })
          .eq('uuid', familyUuid)
      }

      return res.json({
        success: true,
        message: 'Member permanently deleted.',
        deleted: true,
      })

    } else {
      // Soft delete - set status to TRANSFERRED_OUT
      const { data: updatedMember, error: updateError } = await supabase
        .from('family_member')
        .update({
          member_status: 'TRANSFERRED_OUT',
          status_reason: reason || 'Member removed from household',
          change_type: change_type || 'OTHER',
          left_date: new Date().toISOString().split('T')[0],
        })
        .eq('uuid', memberUuid)
        .select()
        .single()

      if (updateError) {
        return res.status(500).json({
          success: false,
          error: `Failed to remove member: ${updateError.message}`,
        })
      }

      // Log the removal
      await supabase.from('member_transfer_log').insert({
        member_uuid: memberUuid,
        family_uuid: familyUuid,
        action: 'LEFT',
        old_status: member.member_status || 'ACTIVE',
        new_status: 'TRANSFERRED_OUT',
        change_type: change_type || 'OTHER',
        reason: reason || 'Member removed from household',
        effective_date: new Date().toISOString().split('T')[0],
        recorded_by: req.headers['x-user-id'] as string || 'system',
      })

      // Update household_size
      if (family && family.household_size > 0) {
        await supabase
          .from('family')
          .update({ household_size: family.household_size - 1 })
          .eq('uuid', familyUuid)
      }

      return res.json({
        success: true,
        data: updatedMember,
        message: 'Member marked as transferred out.',
        soft_deleted: true,
      })
    }

  } catch (err) {
    console.error('Member delete exception:', err)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
})

/**
 * GET /api/v1/registration/family/:familyUuid/members/:memberUuid/history
 * 
 * Get transfer/status change history for a member.
 * Note: familyUuid/memberUuid are internal UUIDs (was family_id/member_id before migration 006)
 */
router.get('/family/:familyUuid/members/:memberUuid/history', async (req: Request, res: Response) => {
  try {
    const { familyUuid, memberUuid } = req.params

    // Verify member exists
    const { data: member, error: fetchError } = await supabase
      .from('family_member')
      .select('*')
      .eq('uuid', memberUuid)
      .eq('family_uuid', familyUuid)
      .single()

    if (fetchError || !member) {
      return res.status(404).json({
        success: false,
        error: 'Member not found.',
      })
    }

    // Get transfer log
    const { data: history, error: historyError } = await supabase
      .from('member_transfer_log')
      .select('*')
      .eq('member_uuid', memberUuid)
      .order('created_at', { ascending: false })

    if (historyError) {
      return res.status(500).json({
        success: false,
        error: `Failed to fetch history: ${historyError.message}`,
      })
    }

    return res.json({
      success: true,
      data: {
        member,
        history: history || [],
      },
    })

  } catch (err) {
    console.error('Member history exception:', err)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
})

export { router as registrationRouter }
