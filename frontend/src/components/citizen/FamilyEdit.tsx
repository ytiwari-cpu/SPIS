/**
 * FAMILY EDIT PAGE - Comprehensive Family & Member Management (V2)
 * 
 * Features:
 * - Edit family details (head name, phone, email, vulnerability)
 * - Edit each member's details
 * - Change member status (ACTIVE, INACTIVE, DECEASED, TRANSFERRED_OUT)
 * - Add new members (birth, marriage, adoption)
 * - Remove members (death, transfer out, marriage)
 * - Address editing
 * - Single SAVE ALL button with reason field
 * - Changes saved to family_history in JSON format
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { authFetch, extractApiError } from '@/services/authFetch'

// Types - Post-migration 006: uuid is internal, family_id/member_id are human-readable
interface FamilyDB {
  uuid: string                              // Internal UUID
  family_id: string                         // Human-readable ID: F123
  household_size: number
  head_first_name: string | null
  head_last_name: string | null
  phone: string | null
  email: string | null
  vulnerability_flag: boolean
  status: string
  registration_status: string
  intake_channel: string
  head_member_id: string | null
}

interface MemberDB {
  uuid: string                              // Internal UUID
  member_id: string                         // Human-readable ID: F123M001
  family_uuid: string                       // FK to family.uuid
  national_id: string | null
  first_name: string
  last_name: string
  date_of_birth: string | null
  gender: string | null
  relationship_to_head: string
  marital_status: string | null
  alive_flag: boolean
  member_status?: string
  status_reason?: string | null
  change_type?: string | null
  joined_date?: string | null
  left_date?: string | null
  phone: string | null
  email: string | null
  annual_income?: number
}

interface AddressDB {
  address_id: string
  entity_type: string
  entity_id: string
  address_type: string
  line1: string
  line2: string | null
  parish: string | null
  district: string | null
}

// Pending changes tracking - uses uuid for API operations
interface PendingChanges {
  family: Partial<FamilyDB> | null
  address: Partial<AddressDB> | null
  members: Array<{ uuid: string } & Partial<MemberDB>>
  added_members: Array<Partial<MemberDB> & { change_type: string; status_reason?: string }>
  removed_members: Array<{ uuid: string; reason: string; change_type: string }>
  status_changes: Array<{ uuid: string; member_status: string; status_reason?: string; change_type?: string; left_date?: string }>
}

// Status options
const MEMBER_STATUSES = [
  { value: 'ACTIVE', label: 'Active', color: 'bg-green-100 text-green-700' },
  { value: 'INACTIVE', label: 'Inactive', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'DECEASED', label: 'Deceased', color: 'bg-gray-100 text-gray-700' },
  { value: 'TRANSFERRED_OUT', label: 'Transferred Out', color: 'bg-red-100 text-red-700' },
]

const CHANGE_TYPES = {
  add: [
    { value: 'BIRTH', label: 'Birth' },
    { value: 'MARRIAGE_IN', label: 'Marriage (joined family)' },
    { value: 'ADOPTION_IN', label: 'Adoption' },
    { value: 'RELOCATION', label: 'Relocation' },
    { value: 'OTHER', label: 'Other' },
  ],
  remove: [
    { value: 'DEATH', label: 'Death' },
    { value: 'MARRIAGE_OUT', label: 'Marriage (left family)' },
    { value: 'ADOPTION_OUT', label: 'Adopted Out' },
    { value: 'RELOCATION', label: 'Relocation' },
    { value: 'OTHER', label: 'Other' },
  ],
}

const RELATIONSHIPS = [
  'head', 'spouse', 'child', 'parent', 'sibling', 'grandparent', 'grandchild', 'other'
]

const GENDERS = ['male', 'female', 'other']

const MARITAL_STATUSES = ['single', 'married', 'divorced', 'widowed', 'separated']

// Sort members: ACTIVE first, then TRANSFERRED_OUT/INACTIVE, then DECEASED
const sortMembers = (members: MemberDB[]): MemberDB[] => {
  const statusOrder: Record<string, number> = {
    'ACTIVE': 0,
    'INACTIVE': 1,
    'TRANSFERRED_OUT': 2,
    'DECEASED': 3,
  }

  return [...members].sort((a, b) => {
    const aOrder = statusOrder[a.member_status || 'ACTIVE'] ?? 1
    const bOrder = statusOrder[b.member_status || 'ACTIVE'] ?? 1
    if (aOrder !== bOrder) return aOrder - bOrder
    // Head first, then by name
    if (a.relationship_to_head === 'head') return -1
    if (b.relationship_to_head === 'head') return 1
    return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
  })
}

export default function FamilyEditContent() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuthStore()

  // Get family UUID from URL params or auth (uses uuid for API routing)
  const familyUuidParam = searchParams.get('id') || searchParams.get('family')
  const familyId = familyUuidParam || user?.familyUUID

  // Original data (for comparison)
  const [originalFamily, setOriginalFamily] = useState<FamilyDB | null>(null)
  const [originalAddress, setOriginalAddress] = useState<AddressDB | null>(null)
  const [originalMembers, setOriginalMembers] = useState<MemberDB[]>([])

  // Editable data
  const [family, setFamily] = useState<FamilyDB | null>(null)
  const [members, setMembers] = useState<MemberDB[]>([])
  const [address, setAddress] = useState<AddressDB | null>(null)

  // Pending changes
  const [pendingChanges, setPendingChanges] = useState<PendingChanges>({
    family: null,
    address: null,
    members: [],
    added_members: [],
    removed_members: [],
    status_changes: [],
  })

  // UI state
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [saveReason, setSaveReason] = useState('')

  // Modal states
  const [editingMember, setEditingMember] = useState<MemberDB | null>(null)
  const [showAddMember, setShowAddMember] = useState(false)
  const [showStatusChange, setShowStatusChange] = useState<MemberDB | null>(null)

  // Check if there are pending changes
  const hasChanges =
    pendingChanges.family !== null ||
    pendingChanges.address !== null ||
    pendingChanges.members.length > 0 ||
    pendingChanges.added_members.length > 0 ||
    pendingChanges.removed_members.length > 0 ||
    pendingChanges.status_changes.length > 0

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!familyId) {
      setIsLoading(false)
      setError('No family ID provided')
      return
    }

    try {
      setIsLoading(true)
      const response = await authFetch(`/families/${familyId}`)
      const data = await response.json()

      if (!data.success) {
        throw new Error(extractApiError(data.error, 'Failed to fetch family'))
      }

      const { members: memberList, address: addr, ...familyOnly } = data.data

      // Store original data
      setOriginalFamily(familyOnly)
      setOriginalAddress(addr || null)
      setOriginalMembers(memberList || [])

      // Set editable data
      setFamily(familyOnly)
      setMembers(memberList || [])
      setAddress(addr || null)

      // Clear pending changes
      setPendingChanges({
        family: null,
        address: null,
        members: [],
        added_members: [],
        removed_members: [],
        status_changes: [],
      })

      setError(null)
    } catch (err) {
      console.error('Fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }, [familyId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Update family locally (pending)
  const handleFamilyChange = (updates: Partial<FamilyDB>) => {
    setFamily(prev => prev ? { ...prev, ...updates } : prev)
    setPendingChanges(prev => ({
      ...prev,
      family: { ...(prev.family || {}), ...updates },
    }))
  }

  // Update address locally (pending)
  const handleAddressChange = (updates: Partial<AddressDB>) => {
    setAddress(prev => prev ? { ...prev, ...updates } : prev)
    setPendingChanges(prev => ({
      ...prev,
      address: { ...(prev.address || {}), ...updates },
    }))
  }

  // Update member locally (pending) - uses uuid for tracking
  const handleMemberChange = (memberUuid: string, updates: Partial<MemberDB>) => {
    setMembers(prev => prev.map(m =>
      m.uuid === memberUuid ? { ...m, ...updates } : m
    ))
    setPendingChanges(prev => {
      const existingIdx = prev.members.findIndex(m => m.uuid === memberUuid)
      const updatedMembers = [...prev.members]
      if (existingIdx >= 0) {
        updatedMembers[existingIdx] = { ...updatedMembers[existingIdx], ...updates }
      } else {
        updatedMembers.push({ uuid: memberUuid, ...updates })
      }
      return { ...prev, members: updatedMembers }
    })
    setEditingMember(null)
  }

  // Add member locally (pending)
  const handleAddMember = (newMember: Partial<MemberDB> & { change_type: string; status_reason?: string }) => {
    // Add to local display with temp UUID
    const tempMember: MemberDB = {
      uuid: `temp_${Date.now()}`,
      member_id: 'NEW',                      // Will be generated by backend
      family_uuid: familyId || '',
      first_name: newMember.first_name || '',
      last_name: newMember.last_name || '',
      national_id: newMember.national_id || null,
      date_of_birth: newMember.date_of_birth || null,
      gender: newMember.gender || null,
      relationship_to_head: newMember.relationship_to_head || 'other',
      marital_status: newMember.marital_status || null,
      alive_flag: true,
      member_status: 'ACTIVE',
      status_reason: newMember.status_reason || null,
      change_type: newMember.change_type,
      phone: newMember.phone || null,
      email: newMember.email || null,
    }

    setMembers(prev => [...prev, tempMember])
    setPendingChanges(prev => ({
      ...prev,
      added_members: [...prev.added_members, newMember],
    }))
    setShowAddMember(false)
  }

  // Remove member locally (pending) - uses uuid for tracking
  const handleRemoveMember = (memberUuid: string, reason: string, changeType: string) => {
    // Set status based on change type: DEATH = DECEASED, others = TRANSFERRED_OUT
    const newStatus = changeType === 'DEATH' ? 'DECEASED' : 'TRANSFERRED_OUT'

    setMembers(prev => prev.map(m =>
      m.uuid === memberUuid
        ? { ...m, member_status: newStatus, status_reason: reason }
        : m
    ))
    setPendingChanges(prev => ({
      ...prev,
      removed_members: [...prev.removed_members, { uuid: memberUuid, reason, change_type: changeType }],
    }))
  }

  // Status change locally (pending) - uses uuid for tracking
  const handleStatusChange = (memberUuid: string, data: {
    member_status: string
    status_reason?: string
    change_type?: string
    left_date?: string
  }) => {
    setMembers(prev => prev.map(m =>
      m.uuid === memberUuid
        ? { ...m, member_status: data.member_status, status_reason: data.status_reason || null }
        : m
    ))
    setPendingChanges(prev => ({
      ...prev,
      status_changes: [...prev.status_changes.filter(s => s.uuid !== memberUuid), { uuid: memberUuid, ...data }],
    }))
    setShowStatusChange(null)
  }

  // SAVE ALL CHANGES
  const handleSaveAll = async () => {
    if (!familyId || !hasChanges) return

    setIsSaving(true)
    setError(null)

    try {
      const response = await authFetch(`/registration/family/${familyId}/save-edits`, {
        method: 'POST',
        body: JSON.stringify({
          ...pendingChanges,
          reason: saveReason,
          changed_by: user?.user_id || null,
        }),
      })

      const result = await response.json()

      if (result.success) {
        setSaveSuccess(result.message || 'All changes saved!')
        setSaveReason('')
        await fetchData() // Refresh data
        setTimeout(() => setSaveSuccess(null), 5000)
      } else {
        setError(extractApiError(result.error, 'Failed to save changes'))
      }
    } catch (err) {
      console.error('Save error:', err)
      setError('Failed to save changes. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  // Discard all changes and navigate back
  const handleDiscardChanges = () => {
    navigate(-1)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
      </div>
    )
  }

  if (error && !family) {
    return (
      <div className="p-8 text-center">
        <span className="material-symbols-outlined text-4xl text-red-500 mb-4">error</span>
        <p className="text-red-600 mb-4">{error}</p>
        <button onClick={() => navigate('/family')} className="px-4 py-2 bg-primary text-white rounded-lg">
          Back to Family
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto pb-32">
      {/* Header */}
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/family')} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Family</h1>
            <p className="text-sm text-gray-500">{family?.family_id}</p>
          </div>
        </div>
        {hasChanges && (
          <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
            Unsaved Changes
          </span>
        )}
      </header>

      {/* Success/Error Messages */}
      {saveSuccess && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 flex items-center gap-2">
          <span className="material-symbols-outlined">check_circle</span>
          {saveSuccess}
        </div>
      )}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined">error</span>
          {error}
          <button onClick={() => setError(null)} className="ml-auto">✕</button>
        </div>
      )}

      {/* Family Details Section */}
      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined">family_restroom</span>
          Family Details
          {pendingChanges.family && <span className="text-xs text-amber-600">(modified)</span>}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Head First Name</label>
            <input
              type="text"
              value={family?.head_first_name || ''}
              onChange={e => handleFamilyChange({ head_first_name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Head Last Name</label>
            <input
              type="text"
              value={family?.head_last_name || ''}
              onChange={e => handleFamilyChange({ head_last_name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Phone</label>
            <input
              type="tel"
              value={family?.phone || ''}
              onChange={e => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
                handleFamilyChange({ phone: digits })
              }}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={family?.email || ''}
              onChange={e => handleFamilyChange({ email: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
          <div className="flex items-center gap-2 md:col-span-2">
            <input
              type="checkbox"
              id="vulnerability"
              checked={family?.vulnerability_flag || false}
              onChange={e => handleFamilyChange({ vulnerability_flag: e.target.checked })}
              className="w-4 h-4"
            />
            <label htmlFor="vulnerability" className="text-sm">Vulnerable Household</label>
          </div>
        </div>
      </section>

      {/* Address Section */}
      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined">location_on</span>
          Permanent Address
          {pendingChanges.address && <span className="text-xs text-amber-600">(modified)</span>}
        </h2>

        {address ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Address Autocomplete */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Search Address (Jamaica)</label>
              <AddressAutocomplete
                onSelect={(data) => {
                  handleAddressChange({
                    line1: data.line1 || address.line1,
                    parish: data.parish || address.parish,
                    district: data.district || address.district,
                  })
                }}
                placeholder="Search to auto-fill address..."
                defaultValue=""
              />
              <p className="text-xs text-gray-500 mt-1">Select an address to auto-fill fields below</p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Address Line 1</label>
              <input
                type="text"
                value={address.line1 || ''}
                onChange={e => handleAddressChange({ line1: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 dark:bg-gray-800 dark:border-gray-700"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Address Line 2</label>
              <input
                type="text"
                value={address.line2 || ''}
                onChange={e => handleAddressChange({ line2: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 dark:bg-gray-800 dark:border-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Parish</label>
              <input
                type="text"
                value={address.parish || ''}
                onChange={e => handleAddressChange({ parish: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 dark:bg-gray-800 dark:border-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">District</label>
              <input
                type="text"
                value={address.district || ''}
                onChange={e => handleAddressChange({ district: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 dark:bg-gray-800 dark:border-gray-700"
              />
            </div>
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No address registered</p>
        )}
      </section>

      {/* Members Section */}
      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span className="material-symbols-outlined">group</span>
            Family Members ({members.filter(m => m.member_status !== 'TRANSFERRED_OUT' && m.member_status !== 'DECEASED').length} active)
            {(pendingChanges.members.length > 0 || pendingChanges.added_members.length > 0 || pendingChanges.removed_members.length > 0) &&
              <span className="text-xs text-amber-600">(modified)</span>
            }
          </h2>
          <button
            onClick={() => setShowAddMember(true)}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm flex items-center gap-2 hover:bg-primary/90"
          >
            <span className="material-symbols-outlined text-base">person_add</span>
            Add Member
          </button>
        </div>

        <div className="space-y-4">
          {sortMembers(members).map((member) => (
            <MemberCard
              key={member.uuid}
              member={member}
              isModified={pendingChanges.members.some(m => m.uuid === member.uuid)}
              isNew={member.uuid.startsWith('temp_')}
              onEdit={() => setEditingMember(member)}
              onChangeStatus={() => setShowStatusChange(member)}
              onRemove={(reason, changeType) => handleRemoveMember(member.uuid, reason, changeType)}
            />
          ))}
        </div>
      </section>

      {/* Reason and Save Section - Always Visible */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm mb-12">
        <div className="space-y-6">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">save_as</span>
            Confirm & Save
            {hasChanges && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                {[pendingChanges.family ? 1 : 0, pendingChanges.address ? 1 : 0, pendingChanges.members.length, pendingChanges.added_members.length, pendingChanges.removed_members.length, pendingChanges.status_changes.length].reduce((a, b) => a + b, 0)} pending
              </span>
            )}
          </h3>

          {/* Reason Input */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <label className="block text-sm font-medium mb-2">
              Reason for changes <span className="text-gray-500 font-normal">(Required for audit logs)</span>
            </label>
            <input
              type="text"
              value={saveReason}
              onChange={e => setSaveReason(e.target.value)}
              placeholder="e.g., Updated phone number, Added newborn child, Member married and moved out..."
              className="w-full px-4 py-3 border border-blue-200 dark:border-blue-800 rounded-lg focus:ring-2 focus:ring-primary/20 dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          {/* Pending Changes Summary — only when there are changes */}
          {hasChanges && (
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Summary of Changes:</p>
              <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
                {pendingChanges.family && <li>Updated family details</li>}
                {pendingChanges.address && <li>Updated permanent address</li>}
                {pendingChanges.members.length > 0 && <li>{pendingChanges.members.length} member(s) modified</li>}
                {pendingChanges.added_members.length > 0 && <li>{pendingChanges.added_members.length} new member(s) added</li>}
                {pendingChanges.removed_members.length > 0 && <li>{pendingChanges.removed_members.length} member(s) removed</li>}
                {pendingChanges.status_changes.length > 0 && <li>{pendingChanges.status_changes.length} status change(s)</li>}
              </ul>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4 pt-2">
            <button
              onClick={handleSaveAll}
              disabled={isSaving || !hasChanges || !saveReason.trim()}
              className="px-8 py-3 bg-primary text-white font-bold rounded-lg flex items-center gap-2 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20 transition-all active:scale-95"
            >
              {isSaving ? (
                <>
                  <span className="material-symbols-outlined animate-spin">progress_activity</span>
                  Saving...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">save</span>
                  Save All Changes
                </>
              )}
            </button>
            <button
              onClick={handleDiscardChanges}
              disabled={isSaving}
              className="px-6 py-3 text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
            >
              Discard Changes
            </button>
          </div>
        </div>
      </div>

      {/* Edit Member Modal */}
      {editingMember && (
        <MemberEditModal
          member={editingMember}
          familyAddress={address}
          onSave={(data) => handleMemberChange(editingMember.uuid, data)}
          onClose={() => setEditingMember(null)}
        />
      )}

      {/* Add Member Modal */}
      {showAddMember && (
        <AddMemberModal
          onAdd={handleAddMember}
          onClose={() => setShowAddMember(false)}
        />
      )}

      {/* Status Change Modal */}
      {showStatusChange && (
        <StatusChangeModal
          member={showStatusChange}
          onSave={(data) => handleStatusChange(showStatusChange.uuid, data)}
          onClose={() => setShowStatusChange(null)}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function MemberCard({
  member,
  isModified,
  isNew,
  onEdit,
  onChangeStatus,
  onRemove,
}: {
  member: MemberDB
  isModified: boolean
  isNew: boolean
  onEdit: () => void
  onChangeStatus: () => void
  onRemove: (reason: string, changeType: string) => void
}) {
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)
  const [removeReason, setRemoveReason] = useState('')
  const [removeType, setRemoveType] = useState('OTHER')

  const status = MEMBER_STATUSES.find(s => s.value === member.member_status) || MEMBER_STATUSES[0]
  const isInactive = member.member_status === 'DECEASED' || member.member_status === 'TRANSFERRED_OUT'

  return (
    <div className={`border rounded-lg p-4 ${isNew ? 'border-green-300 bg-green-50 dark:bg-green-900/20' :
      isModified ? 'border-amber-300 bg-amber-50 dark:bg-amber-900/20' :
        isInactive ? 'opacity-60 bg-gray-50 dark:bg-gray-800/50' :
          'bg-white dark:bg-gray-800'
      }`}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <h3 className="font-bold text-gray-900 dark:text-white">
              {member.first_name} {member.last_name}
            </h3>
            {member.member_id && !member.member_id.startsWith('NEW') && (
              <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs font-mono">
                {member.member_id}
              </span>
            )}
            {isNew && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">NEW</span>}
            {isModified && !isNew && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs">MODIFIED</span>}
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
              {status.label}
            </span>
            {member.relationship_to_head === 'head' && (
              <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium">
                Head
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm text-gray-600 dark:text-gray-400">
            <div><span className="text-gray-400">Relationship:</span> {member.relationship_to_head}</div>
            <div><span className="text-gray-400">Gender:</span> {member.gender || 'N/A'}</div>
            <div><span className="text-gray-400">DOB:</span> {member.date_of_birth || 'N/A'}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={onEdit}
            className="p-2 text-gray-500 hover:text-primary hover:bg-primary/10 rounded-lg"
            title="Edit Details"
          >
            <span className="material-symbols-outlined text-base">edit</span>
          </button>
          <button
            onClick={onChangeStatus}
            className="p-2 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg"
            title="Change Status"
          >
            <span className="material-symbols-outlined text-base">swap_horiz</span>
          </button>
          {!isInactive && member.relationship_to_head !== 'head' && !isNew && (
            <button
              onClick={() => setShowRemoveDialog(true)}
              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
              title="Remove Member"
            >
              <span className="material-symbols-outlined text-base">person_remove</span>
            </button>
          )}
        </div>
      </div>

      {/* Remove Dialog */}
      {showRemoveDialog && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h4 className="font-medium text-red-800 mb-2">Remove Member</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-sm mb-1">Reason for leaving:</label>
              <select
                value={removeType}
                onChange={e => setRemoveType(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                {CHANGE_TYPES.remove.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Additional details:</label>
              <input
                type="text"
                value={removeReason}
                onChange={e => setRemoveReason(e.target.value)}
                placeholder="Optional notes..."
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onRemove(removeReason || CHANGE_TYPES.remove.find(t => t.value === removeType)?.label || 'Removed', removeType)
                  setShowRemoveDialog(false)
                }}
                className="px-3 py-1 bg-red-600 text-white rounded-lg text-sm"
              >
                Remove
              </button>
              <button
                onClick={() => setShowRemoveDialog(false)}
                className="px-3 py-1 bg-gray-200 rounded-lg text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MemberEditModal({
  member,
  familyAddress,
  onSave,
  onClose,
}: {
  member: MemberDB
  familyAddress: AddressDB | null
  onSave: (data: Partial<MemberDB> & { memberAddress?: Partial<AddressDB> | null }) => void
  onClose: () => void
}) {
  const [formData, setFormData] = useState({
    first_name: member.first_name,
    last_name: member.last_name,
    national_id: member.national_id || '',
    date_of_birth: member.date_of_birth || '',
    gender: member.gender || '',
    relationship_to_head: member.relationship_to_head,
    marital_status: member.marital_status || '',
    phone: member.phone || '',
    email: member.email || '',
    annual_income: (member as MemberDB & { annual_income?: number }).annual_income || 0,
  })

  const [useFamilyAddress, setUseFamilyAddress] = useState(true)
  const [memberAddress, setMemberAddress] = useState({
    line1: '',
    line2: '',
    parish: '',
    district: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      ...formData,
      memberAddress: useFamilyAddress ? null : memberAddress,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Edit Member</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
          </div>

          {/* Member ID Badge */}
          {member.member_id && !member.member_id.startsWith('NEW') && (
            <div className="bg-primary/5 rounded-lg p-2 mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-sm">badge</span>
              <span className="text-sm font-mono font-bold text-primary">
                {member.member_id}
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">First Name *</label>
                <input
                  type="text"
                  required
                  value={formData.first_name}
                  onChange={e => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Last Name *</label>
                <input
                  type="text"
                  required
                  value={formData.last_name}
                  onChange={e => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">National ID</label>
                <input
                  type="text"
                  value={formData.national_id}
                  onChange={e => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 14)
                    setFormData(prev => ({ ...prev, national_id: digits }))
                  }}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                  placeholder="14 digits"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={formData.date_of_birth}
                  onChange={e => setFormData(prev => ({ ...prev, date_of_birth: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Gender</label>
                <select
                  value={formData.gender}
                  onChange={e => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                >
                  <option value="">Select...</option>
                  {GENDERS.map(g => <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Relationship</label>
                <select
                  value={formData.relationship_to_head}
                  onChange={e => setFormData(prev => ({ ...prev, relationship_to_head: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                >
                  {RELATIONSHIPS.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Marital Status</label>
                <select
                  value={formData.marital_status}
                  onChange={e => setFormData(prev => ({ ...prev, marital_status: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                >
                  <option value="">Select...</option>
                  {MARITAL_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={e => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
                    setFormData(prev => ({ ...prev, phone: digits }))
                  }}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Annual Income (JMD)</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={formData.annual_income}
                  onChange={e => setFormData(prev => ({ ...prev, annual_income: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Address Section */}
            <div className="border-t pt-4 mt-4">
              <label className="flex items-center gap-2 mb-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useFamilyAddress}
                  onChange={e => setUseFamilyAddress(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm font-medium">Same as Permanent Address</span>
              </label>

              {useFamilyAddress && familyAddress && (
                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg text-sm text-gray-600 dark:text-gray-400">
                  <span className="material-symbols-outlined text-sm align-middle mr-1">location_on</span>
                  {familyAddress.line1}{familyAddress.line2 ? `, ${familyAddress.line2}` : ''}, {familyAddress.parish || ''} {familyAddress.district || ''}
                </div>
              )}

              {!useFamilyAddress && (
                <div className="grid grid-cols-2 gap-3">
                  {/* Address Autocomplete for Member */}
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1">Search Address</label>
                    <AddressAutocomplete
                      onSelect={(data) => {
                        setMemberAddress(prev => ({
                          ...prev,
                          line1: data.line1 || prev.line1,
                          parish: data.parish || prev.parish,
                          district: data.district || prev.district,
                        }))
                      }}
                      placeholder="Search address..."
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1">Address Line 1 *</label>
                    <input
                      type="text"
                      required={!useFamilyAddress}
                      value={memberAddress.line1}
                      onChange={e => setMemberAddress(prev => ({ ...prev, line1: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1">Address Line 2</label>
                    <input
                      type="text"
                      value={memberAddress.line2}
                      onChange={e => setMemberAddress(prev => ({ ...prev, line2: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Parish</label>
                    <input
                      type="text"
                      value={memberAddress.parish}
                      onChange={e => setMemberAddress(prev => ({ ...prev, parish: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">District</label>
                    <input
                      type="text"
                      value={memberAddress.district}
                      onChange={e => setMemberAddress(prev => ({ ...prev, district: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4">
              <button type="submit" className="flex-1 px-4 py-2 bg-primary text-white rounded-lg">Apply Changes</button>
              <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

function AddMemberModal({
  onAdd,
  onClose,
}: {
  onAdd: (data: Partial<MemberDB> & { change_type: string; status_reason?: string; annual_income?: number }) => void
  onClose: () => void
}) {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    national_id: '',
    date_of_birth: '',
    gender: '',
    relationship_to_head: 'child',
    marital_status: '',
    phone: '',
    email: '',
    change_type: 'BIRTH',
    status_reason: '',
    annual_income: 0,
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Add New Member</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); onAdd(formData); }} className="space-y-4">
            {/* Reason for adding */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-4">
              <label className="block text-sm font-medium mb-2">Why is this member joining? *</label>
              <select
                value={formData.change_type}
                onChange={e => setFormData(prev => ({ ...prev, change_type: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                required
              >
                {CHANGE_TYPES.add.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <input
                type="text"
                value={formData.status_reason}
                onChange={e => setFormData(prev => ({ ...prev, status_reason: e.target.value }))}
                placeholder="Additional details (optional)"
                className="w-full px-3 py-2 border rounded-lg mt-2 dark:bg-gray-800 dark:border-gray-700"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">First Name *</label>
                <input
                  type="text"
                  required
                  value={formData.first_name}
                  onChange={e => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Last Name *</label>
                <input
                  type="text"
                  required
                  value={formData.last_name}
                  onChange={e => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">National ID</label>
                <input
                  type="text"
                  value={formData.national_id}
                  onChange={e => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 14)
                    setFormData(prev => ({ ...prev, national_id: digits }))
                  }}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                  placeholder="14 digits"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={formData.date_of_birth}
                  onChange={e => setFormData(prev => ({ ...prev, date_of_birth: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Gender</label>
                <select
                  value={formData.gender}
                  onChange={e => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                >
                  <option value="">Select...</option>
                  {GENDERS.map(g => <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Relationship *</label>
                <select
                  required
                  value={formData.relationship_to_head}
                  onChange={e => setFormData(prev => ({ ...prev, relationship_to_head: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                >
                  {RELATIONSHIPS.filter(r => r !== 'head').map(r => (
                    <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Annual Income (JMD)</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={formData.annual_income}
                  onChange={e => setFormData(prev => ({ ...prev, annual_income: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <button type="submit" className="flex-1 px-4 py-2 bg-primary text-white rounded-lg">Add Member</button>
              <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

function StatusChangeModal({
  member,
  onSave,
  onClose,
}: {
  member: MemberDB
  onSave: (data: { member_status: string; status_reason?: string; change_type?: string; left_date?: string }) => void
  onClose: () => void
}) {
  const [formData, setFormData] = useState({
    member_status: member.member_status || 'ACTIVE',
    status_reason: '',
    change_type: 'OTHER',
    left_date: new Date().toISOString().split('T')[0],
  })

  // DECEASED members cannot have their status changed
  const isDeceased = member.member_status === 'DECEASED'
  const showDateAndReason = formData.member_status === 'DECEASED' || formData.member_status === 'TRANSFERRED_OUT'

  // If deceased, show a message and only allow closing
  if (isDeceased) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-md">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Status Cannot Be Changed</h2>
              <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
            </div>

            <div className="text-center py-6">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">⚠️</span>
              </div>
              <p className="text-gray-600 mb-2">
                <strong>{member.first_name} {member.last_name}</strong> is marked as <strong className="text-red-600">DECEASED</strong>.
              </p>
              <p className="text-sm text-gray-500">
                Status of deceased members cannot be changed.
              </p>
            </div>

            <div className="flex justify-center pt-4">
              <button type="button" onClick={onClose} className="px-6 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">Close</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-md">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Change Member Status</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
          </div>

          <p className="text-gray-600 mb-4">
            Changing status for <strong>{member.first_name} {member.last_name}</strong>
          </p>

          <form onSubmit={(e) => { e.preventDefault(); onSave(formData); }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">New Status</label>
              <div className="grid grid-cols-2 gap-2">
                {MEMBER_STATUSES.map(status => (
                  <button
                    key={status.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, member_status: status.value }))}
                    className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${formData.member_status === status.value
                      ? 'border-primary bg-primary/10'
                      : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    {status.label}
                  </button>
                ))}
              </div>
            </div>

            {showDateAndReason && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">Reason/Type</label>
                  <select
                    value={formData.change_type}
                    onChange={e => setFormData(prev => ({ ...prev, change_type: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                  >
                    {(formData.member_status === 'DECEASED'
                      ? [{ value: 'DEATH', label: 'Death' }]
                      : CHANGE_TYPES.remove
                    ).map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Date</label>
                  <input
                    type="date"
                    value={formData.left_date}
                    onChange={e => setFormData(prev => ({ ...prev, left_date: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Additional Notes</label>
                  <textarea
                    value={formData.status_reason}
                    onChange={e => setFormData(prev => ({ ...prev, status_reason: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                    rows={2}
                    placeholder="Optional details..."
                  />
                </div>
              </>
            )}

            <div className="flex gap-2 pt-4">
              <button type="submit" className="flex-1 px-4 py-2 bg-primary text-white rounded-lg">Apply Status</button>
              <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
