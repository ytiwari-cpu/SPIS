/**
 * MEMBER'S PROFILE PAGE - View any family member's profile
 * 
 * Features:
 * - Dropdown to switch between family members
 * - Default to logged-in user or Head of Household
 * - Display member_id and family_id (human-readable codes)
 * - Show annual_income and calculate total family income
 * 
 * Post-migration 006: uuid is internal, member_id/family_id are human-readable
 */

import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { authFetch } from '@/services/authFetch'

interface MemberDB {
  uuid: string                              // Internal UUID
  member_id: string                         // Human-readable: F123M001
  family_uuid: string                       // FK to family.uuid
  national_id: string | null
  first_name: string
  last_name: string
  date_of_birth: string | null
  gender: string | null
  phone: string | null
  email: string | null
  relationship_to_head: string
  marital_status: string | null
  member_status: string
  alive_flag: boolean
  annual_income: number | null
  // Migration 010 fields
  middle_names: string | null
  alias: string | null
  trn: string | null
  nis_no: string | null
  id_type: string | null
  id_number: string | null
  birth_entry_number: string | null
  mothers_maiden_name: string | null
  is_twin: boolean
  order_number: number | null
  occupation: string | null
  contact_no_1: string | null
  contact_no_2: string | null
  union_status: string | null
  last_school_completed: string | null
  school_name: string | null
  school_code: string | null
  school_grade: string | null
  school_class: string | null
  school_shift: string | null
  pregnant: string | null
  pregnancy_due_date: string | null
  is_disabled: boolean
  is_mentally_ill: boolean
  is_chronically_ill: boolean
  is_shut_in: boolean
  is_nis_pensioner: boolean
  pension_number: string | null
  clinic_name: string | null
  clinic_code: string | null
  sex_code: string | null
}

interface AddressDB {
  address_id: string
  line1: string
  line2: string | null
  parish: string | null
  district: string | null
  lot_apt: string | null
  street_district: string | null
  post_office: string | null
  post_code: string | null
  area_type: string | null
}

interface FamilyWithDetails {
  uuid: string                              // Internal UUID
  family_id: string                         // Human-readable: F123
  head_first_name: string | null
  head_last_name: string | null
  phone: string | null
  email: string | null
  household_size: number
  members: MemberDB[]
  address: AddressDB | null
}

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
    // Secondary sort: head first, then by name
    if (a.relationship_to_head === 'head') return -1
    if (b.relationship_to_head === 'head') return 1
    return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
  })
}

const calculateAge = (dob: string | null): string => {
  if (!dob) return 'N/A'
  const birthDate = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  return `${age} years`
}

const formatCurrency = (amount: number | null): string => {
  if (amount === null || amount === undefined) return 'N/A'
  return new Intl.NumberFormat('en-JM', {
    style: 'currency',
    currency: 'JMD',
    minimumFractionDigits: 0,
  }).format(amount)
}

export default function MemberProfileContent() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [family, setFamily] = useState<FamilyWithDetails | null>(null)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [noFamily, setNoFamily] = useState(false)
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null)

  // Fetch family data
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.uuid) {
        setNoFamily(true)
        setIsLoading(false)
        return
      }

      try {
        // Use uuid for API calls (internal identifier)
        const res = await authFetch(`/families/${user.uuid}`)
        const data = await res.json()

        if (res.status === 404 || (data && !data.success)) {
          setNoFamily(true)
        } else if (data.success && data.data) {
          setFamily(data.data)
          
          // Default to head of household
          const head = data.data.members?.find(
            (m: MemberDB) => m.relationship_to_head === 'head'
          )
          setSelectedMemberId(head?.member_id || data.data.members?.[0]?.member_id || null)
        } else {
          setNoFamily(true)
        }
      } catch (err) {
        console.error('Failed to fetch profile:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchProfile()
  }, [user?.uuid])

  // Fetch profile photo when selected member changes
  useEffect(() => {
    const fetchProfilePhoto = async () => {
      setProfilePhotoUrl(null)
      if (!selectedMemberId || !family?.members) return
      
      const member = family.members.find(m => m.member_id === selectedMemberId)
      if (!member) return
      
      try {
        const res = await authFetch(`/documents/member/${member.uuid}`)
        const data = await res.json()
        if (data.success && Array.isArray(data.data)) {
          const photo = data.data.find((d: { document_type: string; file_url?: string }) => d.document_type === 'profile_photo')
          if (photo?.file_url) {
            setProfilePhotoUrl(photo.file_url)
          }
        }
      } catch {
        // ignore - just don't show photo
      }
    }

    fetchProfilePhoto()
  }, [selectedMemberId, family?.members])

  // Sorted members for dropdown
  const sortedMembers = useMemo(() => {
    return family?.members ? sortMembers(family.members) : []
  }, [family?.members])

  // Selected member
  const selectedMember = useMemo(() => {
    return sortedMembers.find(m => m.member_id === selectedMemberId) || null
  }, [sortedMembers, selectedMemberId])

  // Calculate total family income (active members only)
  const totalFamilyIncome = useMemo(() => {
    if (!family?.members) return 0
    return family.members
      .filter(m => m.member_status === 'ACTIVE' || !m.member_status)
      .reduce((sum, m) => sum + (m.annual_income || 0), 0)
  }, [family?.members])

  // Display values
  const displayAddress = family?.address
    ? [
        family.address.lot_apt,
        family.address.line1,
        family.address.line2,
        family.address.street_district,
        family.address.parish,
        family.address.district,
        family.address.post_office && `P.O. ${family.address.post_office}`,
      ].filter(Boolean).join(', ')
    : 'Not registered'

  if (isLoading) {
    return (
      <div className="p-4 md:p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
          <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse" />
        </div>
      </div>
    )
  }

  if (noFamily || !family) {
    return (
      <div className="p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-center">
            <span className="material-symbols-outlined text-4xl text-amber-500 mb-3 block">person_off</span>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No Profile Found</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              You don't have a family registration yet.
            </p>
            <button
              onClick={() => navigate('/register')}
              className="px-5 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 inline-flex items-center gap-2"
            >
              <span className="material-symbols-outlined">add</span>
              Register Family
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Member's Profile</h1>
        </header>

        {/* Member Selector */}
        <section className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 shadow-sm mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Family Member
          </label>
          <select
            value={selectedMemberId || ''}
            onChange={(e) => setSelectedMemberId(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            {sortedMembers.map(member => (
              <option key={member.member_id} value={member.member_id}>
                {member.first_name} {member.middle_names ? `${member.middle_names} ` : ''}{member.last_name} 
                {member.relationship_to_head === 'head' ? ' (Head)' : ` (${member.relationship_to_head})`}
                {member.member_status !== 'ACTIVE' && member.member_status ? ` - ${member.member_status}` : ''}
              </option>
            ))}
          </select>
        </section>

        {selectedMember && (
          <>
            {/* Profile Card */}
            <section className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm mb-6">
              {/* Avatar & Name */}
              <div className="flex items-center gap-4 mb-6">
                <div className={`size-16 rounded-full flex items-center justify-center overflow-hidden border-2 ${
                  selectedMember.member_status === 'DECEASED' 
                    ? 'bg-gray-100 border-gray-300' 
                    : selectedMember.member_status === 'TRANSFERRED_OUT'
                      ? 'bg-red-50 border-red-200'
                      : 'bg-primary/10 border-primary/30'
                }`}>
                  {profilePhotoUrl ? (
                    <img
                      src={profilePhotoUrl}
                      alt={`${selectedMember.first_name} ${selectedMember.last_name}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className={`material-symbols-outlined text-4xl ${
                      selectedMember.member_status === 'DECEASED' ? 'text-gray-400' : 
                      selectedMember.member_status === 'TRANSFERRED_OUT' ? 'text-red-400' : 'text-primary'
                    }`}>
                      {selectedMember.gender === 'female' ? 'face_3' : 'face'}
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {selectedMember.first_name} {selectedMember.middle_names ? `${selectedMember.middle_names} ` : ''}{selectedMember.last_name}
                  </h3>
                  {selectedMember.alias && (
                    <p className="text-gray-400 dark:text-gray-500 text-xs italic">a.k.a. {selectedMember.alias}</p>
                  )}
                  <p className="text-gray-500 dark:text-gray-400 text-sm capitalize">
                    {selectedMember.relationship_to_head === 'head' ? 'Head of Household' : selectedMember.relationship_to_head}
                  </p>
                  {selectedMember.member_status && selectedMember.member_status !== 'ACTIVE' && (
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      selectedMember.member_status === 'DECEASED' ? 'bg-gray-100 text-gray-600' :
                      selectedMember.member_status === 'INACTIVE' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-600'
                    }`}>
                      {selectedMember.member_status.replace('_', ' ')}
                    </span>
                  )}
                </div>
              </div>

              {/* Member ID Badge */}
              {selectedMember.member_id && (
                <div className="bg-primary/5 rounded-lg p-3 mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-0.5">Member ID</p>
                    <p className="text-lg font-bold font-mono text-primary">{selectedMember.member_id}</p>
                  </div>
                  <span className="material-symbols-outlined text-primary/50 text-2xl">badge</span>
                </div>
              )}

              {/* Profile Fields */}
              <div className="space-y-4">
                <div className="flex flex-col border-b border-gray-100 dark:border-gray-800 pb-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Full Name</p>
                  <p className="text-base font-medium text-gray-900 dark:text-white">
                    {selectedMember.first_name} {selectedMember.middle_names ? `${selectedMember.middle_names} ` : ''}{selectedMember.last_name}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 border-b border-gray-100 dark:border-gray-800 pb-3">
                  <div className="flex flex-col">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Age</p>
                    <p className="text-base font-medium text-gray-900 dark:text-white">
                      {calculateAge(selectedMember.date_of_birth)}
                    </p>
                  </div>
                  <div className="flex flex-col">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Gender</p>
                    <p className="text-base font-medium text-gray-900 dark:text-white capitalize">
                      {selectedMember.gender || 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col border-b border-gray-100 dark:border-gray-800 pb-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Email Address</p>
                  <p className="text-base font-medium text-gray-900 dark:text-white">
                    {selectedMember.email || 'Not provided'}
                  </p>
                </div>
                
                <div className="flex flex-col border-b border-gray-100 dark:border-gray-800 pb-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Phone Number</p>
                  <p className="text-base font-medium text-gray-900 dark:text-white">
                    {selectedMember.phone || 'Not provided'}
                  </p>
                </div>

                {(selectedMember.contact_no_1 || selectedMember.contact_no_2) && (
                  <div className="grid grid-cols-2 gap-4 border-b border-gray-100 dark:border-gray-800 pb-3">
                    {selectedMember.contact_no_1 && (
                      <div className="flex flex-col">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Contact No. 1</p>
                        <p className="text-base font-medium text-gray-900 dark:text-white">{selectedMember.contact_no_1}</p>
                      </div>
                    )}
                    {selectedMember.contact_no_2 && (
                      <div className="flex flex-col">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Contact No. 2</p>
                        <p className="text-base font-medium text-gray-900 dark:text-white">{selectedMember.contact_no_2}</p>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="flex flex-col border-b border-gray-100 dark:border-gray-800 pb-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">National ID</p>
                  <p className="text-base font-medium text-gray-900 dark:text-white font-mono">
                    {selectedMember.national_id 
                      ? `****-****-${selectedMember.national_id.slice(-4)}`
                      : 'Not registered'}
                  </p>
                </div>

                {selectedMember.trn && (
                  <div className="flex flex-col border-b border-gray-100 dark:border-gray-800 pb-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">TRN</p>
                    <p className="text-base font-medium text-gray-900 dark:text-white font-mono">{selectedMember.trn}</p>
                  </div>
                )}

                {selectedMember.nis_no && (
                  <div className="flex flex-col border-b border-gray-100 dark:border-gray-800 pb-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">NIS No.</p>
                    <p className="text-base font-medium text-gray-900 dark:text-white font-mono">{selectedMember.nis_no}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 border-b border-gray-100 dark:border-gray-800 pb-3">
                  <div className="flex flex-col">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Marital Status</p>
                    <p className="text-base font-medium text-gray-900 dark:text-white capitalize">
                      {selectedMember.marital_status || 'N/A'}
                    </p>
                  </div>
                  {selectedMember.union_status && (
                    <div className="flex flex-col">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Union Status</p>
                      <p className="text-base font-medium text-gray-900 dark:text-white capitalize">
                        {selectedMember.union_status.replace(/_/g, ' ')}
                      </p>
                    </div>
                  )}
                </div>

                {selectedMember.occupation && (
                  <div className="flex flex-col border-b border-gray-100 dark:border-gray-800 pb-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Occupation</p>
                    <p className="text-base font-medium text-gray-900 dark:text-white">{selectedMember.occupation}</p>
                  </div>
                )}

                <div className="flex flex-col border-b border-gray-100 dark:border-gray-800 pb-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Annual Income</p>
                  <p className="text-base font-medium text-gray-900 dark:text-white">
                    {formatCurrency(selectedMember.annual_income)}
                  </p>
                </div>

                {/* Education */}
                {selectedMember.last_school_completed && (
                  <div className="border-b border-gray-100 dark:border-gray-800 pb-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Education</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-400 text-xs">Last School Level</span>
                        <p className="text-gray-900 dark:text-white capitalize">{selectedMember.last_school_completed.replace(/_/g, ' ')}</p>
                      </div>
                      {selectedMember.school_name && (
                        <div>
                          <span className="text-gray-400 text-xs">School Name</span>
                          <p className="text-gray-900 dark:text-white">{selectedMember.school_name}</p>
                        </div>
                      )}
                      {selectedMember.school_grade && (
                        <div>
                          <span className="text-gray-400 text-xs">Grade</span>
                          <p className="text-gray-900 dark:text-white">{selectedMember.school_grade}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Health Flags */}
                {(selectedMember.is_disabled || selectedMember.is_chronically_ill || selectedMember.is_mentally_ill || selectedMember.is_shut_in || selectedMember.pregnant === 'yes') && (
                  <div className="border-b border-gray-100 dark:border-gray-800 pb-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Health</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedMember.is_disabled && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded-full text-xs">Disabled</span>
                      )}
                      {selectedMember.is_chronically_ill && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full text-xs">Chronically Ill</span>
                      )}
                      {selectedMember.is_mentally_ill && (
                        <span className="px-2 py-0.5 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 rounded-full text-xs">Mentally Ill</span>
                      )}
                      {selectedMember.is_shut_in && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full text-xs">Shut-In</span>
                      )}
                      {selectedMember.pregnant === 'yes' && (
                        <span className="px-2 py-0.5 bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400 rounded-full text-xs">
                          Pregnant{selectedMember.pregnancy_due_date ? ` (Due: ${new Date(selectedMember.pregnancy_due_date).toLocaleDateString()})` : ''}
                        </span>
                      )}
                    </div>
                    {selectedMember.clinic_name && (
                      <p className="text-xs text-gray-500 mt-2">Clinic: {selectedMember.clinic_name}</p>
                    )}
                  </div>
                )}

                {/* Pension */}
                {selectedMember.is_nis_pensioner && (
                  <div className="flex flex-col border-b border-gray-100 dark:border-gray-800 pb-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">NIS Pensioner</p>
                    <p className="text-base font-medium text-gray-900 dark:text-white">
                      Yes{selectedMember.pension_number ? ` — #${selectedMember.pension_number}` : ''}
                    </p>
                  </div>
                )}
                
                <div className="flex flex-col pb-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Residential Address</p>
                  <p className="text-base font-medium text-gray-900 dark:text-white leading-relaxed">
                    {displayAddress}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-8 flex flex-col gap-3">
                <button 
                  onClick={() => navigate(`/family/edit?id=${family.uuid}&member=${selectedMember.uuid}`)}
                  className="w-full bg-primary text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
                  disabled={selectedMember.member_status === 'DECEASED'}
                >
                  <span className="material-symbols-outlined text-xl">edit</span>
                  Edit Profile
                </button>
              </div>
            </section>

            {/* Biometric Enrollment Status */}
            <section className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 dark:text-white">Biometric Enrollment</h3>
                <span className="material-symbols-outlined text-gray-400">fingerprint</span>
              </div>
              <div className="text-center py-4">
                <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">pending</span>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Biometric enrollment will be available after registration is verified.
                </p>
              </div>
            </section>
          </>
        )}

        {/* Family Summary */}
        <section className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-5 border border-blue-200 dark:border-blue-800 mb-6">
          <h3 className="font-bold text-gray-900 dark:text-white mb-4">Family Summary</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-3">
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">
                Family ID
              </p>
              <p className="text-lg font-bold font-mono text-blue-900 dark:text-blue-100">
                {family.family_id || 'N/A'}
              </p>
            </div>
            
            <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-3">
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">
                Household Size
              </p>
              <p className="text-lg font-bold text-blue-900 dark:text-blue-100">
                {family.household_size} Members
              </p>
            </div>
            
            <div className="col-span-2 bg-white/60 dark:bg-gray-800/60 rounded-lg p-3">
              <p className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider mb-1">
                Total Family Income (Active Members)
              </p>
              <p className="text-xl font-bold text-green-700 dark:text-green-300">
                {formatCurrency(totalFamilyIncome)}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
