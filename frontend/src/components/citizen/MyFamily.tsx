/**
 * MY FAMILY PAGE - Real Data from API
 * 
 * NO MOCK DATA - Fetches real family, members, and address from database
 * Uses logged-in family uuid from auth store
 * 
 * Post-migration 006: uuid is internal, family_id/member_id are human-readable codes
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFamilyUuid } from '@/store/authStore'
import { authFetch, extractApiError } from '@/services/authFetch'

// Database-aligned types (post-migration 006 + 010)
interface FamilyDB {
  uuid: string                              // Internal UUID
  family_id: string                         // Human-readable: F123
  household_size: number
  head_first_name: string | null
  head_last_name: string | null
  head_national_id: string | null
  phone: string | null
  email: string | null
  geo_code: string | null
  vulnerability_flag: boolean
  status: string
  registration_status: string
  intake_channel: string
  head_member_id: string | null
  submitted_at: string | null
  verified_at: string | null
  created_at: string
  updated_at: string
  // Migration 010 fields
  programme: string | null
  payment_option: string | null
  social_worker_zone: string | null
  social_worker_code: string | null
  application_no: string | null
  constituency_code: string | null
  head_middle_names: string | null
  head_alias: string | null
  head_mothers_maiden_name: string | null
  mailing_address_different: boolean
  directions_to_house: string | null
}

interface MemberDB {
  uuid: string                              // Internal UUID
  member_id: string                         // Human-readable: F123M001
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
  phone: string | null
  email: string | null
  annual_income?: number | null
  created_at: string
  updated_at: string
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
  entity_type: string
  entity_id: string
  address_type: string
  line1: string
  line2: string | null
  parish: string | null
  district: string | null
  geo_code: string | null
  created_at: string
  updated_at: string
  // Migration 010 fields
  lot_apt: string | null
  street_district: string | null
  post_office: string | null
  post_code: string | null
  area_type: string | null
}

interface HouseServicesDB {
  id: string
  family_uuid: string
  dwelling_tenure: string | null
  utilities: string | null
  water: string | null
  sanitation: string | null
  has_stove: boolean
  has_fridge: boolean
  has_bed: boolean
  has_chair: boolean
  has_table: boolean
  has_radio: boolean
  has_tv: boolean
  has_cable: boolean
  has_phone: boolean
  has_computer: boolean
  has_internet: boolean
  has_washing_machine: boolean
  has_vehicle: boolean
  has_bicycle: boolean
  has_land: boolean
  has_livestock: boolean
  weekly_family_spending: number | null
  monthly_rent: number | null
  total_income: number | null
  number_of_rooms: number | null
  number_of_bedrooms: number | null
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
  return `${age}`
}

const formatGender = (gender: string | null): string => {
  if (!gender) return 'N/A'
  return gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase()
}

const formatStatus = (status: string): { text: string; color: string } => {
  const statusMap: Record<string, { text: string; color: string }> = {
    'DRAFT': { text: 'Draft', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
    'SUBMITTED': { text: 'Submitted', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    'PENDING_VERIFICATION': { text: 'Pending Verification', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    'VERIFIED': { text: 'Verified', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    'REJECTED': { text: 'Rejected', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  }
  return statusMap[status.toUpperCase()] || { text: status, color: 'bg-gray-100 text-gray-700' }
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
    // Head first, then by name
    if (a.relationship_to_head === 'head') return -1
    if (b.relationship_to_head === 'head') return 1
    return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
  })
}

export default function MyFamilyContent() {
  const navigate = useNavigate()
  const familyUuid = useFamilyUuid()
  
  const [family, setFamily] = useState<FamilyDB | null>(null)
  const [members, setMembers] = useState<MemberDB[]>([])
  const [address, setAddress] = useState<AddressDB | null>(null)
  const [mailingAddress, setMailingAddress] = useState<AddressDB | null>(null)
  const [houseServices, setHouseServices] = useState<HouseServicesDB | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchFamilyData = async () => {
      if (!familyUuid) {
        setIsLoading(false)
        setError('No family associated with this account')
        return
      }

      try {
        setIsLoading(true)
        setError(null)

        // Fetch family with all related data (members, address, documents)
        // Use uuid for API calls (internal identifier)
        const familyRes = await authFetch(`/families/${familyUuid}`)
        const familyData = await familyRes.json()
        
        if (!familyData.success) {
          throw new Error(extractApiError(familyData.error, 'Failed to fetch family'))
        }
        
        // The API returns family with members, address, documents embedded
        const { members, address, mailing_address, house_services, ...familyOnly } = familyData.data
        setFamily(familyOnly)
        setMembers(members || [])
        setAddress(address || null)
        setMailingAddress(mailing_address || null)
        setHouseServices(house_services || null)

      } catch (err) {
        console.error('Error fetching family data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load family data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchFamilyData()
  }, [familyUuid])

  if (isLoading) {
    return (
      <div className="p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
          <div className="h-40 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse" />
          <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse" />
        </div>
      </div>
    )
  }

  if (error || !family) {
    return (
      <div className="p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-center">
            <span className="material-symbols-outlined text-4xl text-amber-500 mb-3">family_restroom</span>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              {error || 'No Family Found'}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              You don't have a family registration yet. Would you like to register one?
            </p>
            <button
              onClick={() => navigate('/register')}
              className="px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 flex items-center gap-2 mx-auto"
            >
              <span className="material-symbols-outlined">add</span>
              Register Family
            </button>
          </div>
        </div>
      </div>
    )
  }

  const statusInfo = formatStatus(family.registration_status)

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Family Details</h1>
          <button 
            onClick={() => navigate(`/family/edit?id=${family.uuid}`)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">edit</span>
            <span className="hidden sm:inline">Edit Family</span>
          </button>
        </header>

        {/* Family Summary */}
        <section className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm mb-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Family Summary</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Family ID</p>
              <p className="text-gray-900 dark:text-white text-sm font-bold font-mono">{family.family_id}</p>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Primary Contact</p>
              <p className="text-gray-900 dark:text-white text-sm font-bold">
                {family.head_first_name} {family.head_middle_names ? `${family.head_middle_names} ` : ''}{family.head_last_name}
              </p>
            </div>
            {family.head_alias && (
              <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Alias</p>
                <p className="text-gray-900 dark:text-white text-sm">{family.head_alias}</p>
              </div>
            )}
            <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Phone</p>
              <p className="text-gray-900 dark:text-white text-sm">{family.phone || 'Not provided'}</p>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Email</p>
              <p className="text-gray-900 dark:text-white text-sm">{family.email || 'Not provided'}</p>
            </div>
            {family.programme && (
              <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Programme</p>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  {family.programme}
                </span>
              </div>
            )}
            {family.payment_option && (
              <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Payment Option</p>
                <p className="text-gray-900 dark:text-white text-sm capitalize">{family.payment_option.replace(/_/g, ' ')}</p>
              </div>
            )}
            <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Household Size</p>
              <p className="text-gray-900 dark:text-white text-sm font-bold">{family.household_size} Members</p>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Members Registered</p>
              <p className="text-gray-900 dark:text-white text-sm font-bold">{members.length} Members</p>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Vulnerable Household</p>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                family.vulnerability_flag 
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' 
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
              }`}>
                {family.vulnerability_flag ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Registration Status</p>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                {statusInfo.text}
              </span>
            </div>
            {(family.social_worker_zone || family.social_worker_code) && (
              <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Social Worker</p>
                <p className="text-gray-900 dark:text-white text-sm">
                  {[family.social_worker_zone, family.social_worker_code].filter(Boolean).join(' / ')}
                </p>
              </div>
            )}
            {family.directions_to_house && (
              <div className="flex justify-between items-start py-2">
                <p className="text-gray-500 dark:text-gray-400 text-sm font-medium shrink-0 mr-4">Directions to House</p>
                <p className="text-gray-900 dark:text-white text-sm text-right">{family.directions_to_house}</p>
              </div>
            )}
          </div>
        </section>

        {/* Family Members */}
        <section className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Family Members ({members.length})</h2>
          </div>
          
          {members.length === 0 ? (
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6 text-center">
              <span className="material-symbols-outlined text-3xl text-gray-400 mb-2">person_off</span>
              <p className="text-gray-600 dark:text-gray-400">No members registered yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortMembers(members).map((member) => (
                <div
                  key={member.member_id}
                  className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 shadow-sm"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-gray-900 dark:text-white text-base">
                          {member.first_name} {member.middle_names ? `${member.middle_names} ` : ''}{member.last_name}
                        </h3>
                        {member.member_id && (
                          <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs font-mono rounded">
                            {member.member_id}
                          </span>
                        )}
                      </div>
                      {member.alias && (
                        <p className="text-xs text-gray-400 italic mb-0.5">a.k.a. {member.alias}</p>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                        {member.relationship_to_head === 'head' ? 'Head of Household' : member.relationship_to_head}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {member.member_status && member.member_status !== 'ACTIVE' && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          member.member_status === 'DECEASED' ? 'bg-gray-100 text-gray-600' :
                          member.member_status === 'INACTIVE' ? 'bg-yellow-100 text-yellow-700' :
                          member.member_status === 'TRANSFERRED_OUT' ? 'bg-red-100 text-red-600' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {member.member_status.replace('_', ' ')}
                        </span>
                      )}
                      <span className={`material-symbols-outlined text-sm ${
                        member.alive_flag ? 'text-green-500' : 'text-gray-400'
                      }`}>
                        {member.alive_flag ? 'check_circle' : 'cancel'}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                    <div className="flex flex-col">
                      <span className="text-gray-400">Age/Gender</span>
                      <span className="text-gray-900 dark:text-white">
                        {calculateAge(member.date_of_birth)} / {formatGender(member.gender)}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-gray-400">Status</span>
                      <span className={`font-medium ${
                        !member.member_status || member.member_status === 'ACTIVE' ? 'text-green-600' :
                        member.member_status === 'INACTIVE' ? 'text-yellow-600' :
                        member.member_status === 'DECEASED' ? 'text-gray-500' :
                        'text-red-600'
                      }`}>
                        {member.member_status || 'ACTIVE'}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-gray-400">National ID</span>
                      <span className="text-gray-900 dark:text-white font-mono text-xs">
                        {member.national_id ? `****${member.national_id.slice(-4)}` : 'Not provided'}
                      </span>
                    </div>
                  </div>
                  {member.status_reason && (
                    <div className="mt-2 text-xs text-gray-500 italic">
                      Note: {member.status_reason}
                    </div>
                  )}
                  {(member.phone || member.email) && (
                    <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs">
                      <div className="flex flex-col">
                        <span className="text-gray-400">Phone</span>
                        <span className="text-gray-900 dark:text-white">{member.phone || '-'}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-gray-400">Email</span>
                        <span className="text-gray-900 dark:text-white truncate">{member.email || '-'}</span>
                      </div>
                    </div>
                  )}
                  {/* Extended Jamaica form fields */}
                  {(member.trn || member.occupation || member.union_status || member.is_disabled || member.is_chronically_ill || member.last_school_completed) && (
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        {member.trn && (
                          <div className="flex flex-col">
                            <span className="text-gray-400">TRN</span>
                            <span className="text-gray-900 dark:text-white font-mono">{member.trn}</span>
                          </div>
                        )}
                        {member.occupation && (
                          <div className="flex flex-col">
                            <span className="text-gray-400">Occupation</span>
                            <span className="text-gray-900 dark:text-white">{member.occupation}</span>
                          </div>
                        )}
                        {member.union_status && (
                          <div className="flex flex-col">
                            <span className="text-gray-400">Union Status</span>
                            <span className="text-gray-900 dark:text-white capitalize">{member.union_status.replace(/_/g, ' ')}</span>
                          </div>
                        )}
                      </div>
                      {member.last_school_completed && (
                        <div className="grid grid-cols-3 gap-2">
                          <div className="flex flex-col">
                            <span className="text-gray-400">Last School</span>
                            <span className="text-gray-900 dark:text-white capitalize">{member.last_school_completed.replace(/_/g, ' ')}</span>
                          </div>
                          {member.school_name && (
                            <div className="flex flex-col col-span-2">
                              <span className="text-gray-400">School Name</span>
                              <span className="text-gray-900 dark:text-white">{member.school_name}</span>
                            </div>
                          )}
                        </div>
                      )}
                      {(member.is_disabled || member.is_chronically_ill || member.is_mentally_ill || member.is_shut_in) && (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {member.is_disabled && (
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded-full text-xs">Disabled</span>
                          )}
                          {member.is_chronically_ill && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full text-xs">Chronically Ill</span>
                          )}
                          {member.is_mentally_ill && (
                            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 rounded-full text-xs">Mentally Ill</span>
                          )}
                          {member.is_shut_in && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full text-xs">Shut-In</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Address */}
        <section className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Permanent Address</h2>
          {address ? (
            <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary">location_on</span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 dark:text-white mb-1">
                    {address.address_type} Address
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {address.lot_apt && `${address.lot_apt}, `}
                    {address.line1}
                    {address.line2 && `, ${address.line2}`}
                  </p>
                  {address.street_district && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Street/District: {address.street_district}
                    </p>
                  )}
                  {address.parish && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Parish: {address.parish}
                    </p>
                  )}
                  {address.district && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      District: {address.district}
                    </p>
                  )}
                  <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                    {address.post_office && (
                      <div>
                        <span className="text-gray-400">Post Office</span>
                        <p className="text-gray-900 dark:text-white">{address.post_office}</p>
                      </div>
                    )}
                    {address.post_code && (
                      <div>
                        <span className="text-gray-400">Post Code</span>
                        <p className="text-gray-900 dark:text-white">{address.post_code}</p>
                      </div>
                    )}
                    {address.area_type && (
                      <div>
                        <span className="text-gray-400">Area Type</span>
                        <p className="text-gray-900 dark:text-white capitalize">{address.area_type}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6 text-center">
              <span className="material-symbols-outlined text-3xl text-gray-400 mb-2">location_off</span>
              <p className="text-gray-600 dark:text-gray-400">No address registered yet</p>
            </div>
          )}
        </section>

        {/* Mailing Address */}
        {mailingAddress && (
          <section className="mb-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Mailing Address</h2>
            <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="size-12 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-indigo-600 dark:text-indigo-400">mail</span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 dark:text-white mb-1">Mailing Address</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {mailingAddress.lot_apt && `${mailingAddress.lot_apt}, `}
                    {mailingAddress.line1}
                    {mailingAddress.line2 && `, ${mailingAddress.line2}`}
                  </p>
                  {mailingAddress.parish && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">Parish: {mailingAddress.parish}</p>
                  )}
                  {mailingAddress.post_office && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">Post Office: {mailingAddress.post_office}</p>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* House Services & Assets */}
        {houseServices && (
          <section className="mb-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Housing & Services</h2>
            <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
              {/* Dwelling Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                {houseServices.dwelling_tenure && (
                  <div>
                    <p className="text-gray-400 text-xs">Dwelling Tenure</p>
                    <p className="text-gray-900 dark:text-white capitalize">{houseServices.dwelling_tenure.replace(/_/g, ' ')}</p>
                  </div>
                )}
                {houseServices.number_of_rooms != null && (
                  <div>
                    <p className="text-gray-400 text-xs">Rooms</p>
                    <p className="text-gray-900 dark:text-white">{houseServices.number_of_rooms}</p>
                  </div>
                )}
                {houseServices.number_of_bedrooms != null && (
                  <div>
                    <p className="text-gray-400 text-xs">Bedrooms</p>
                    <p className="text-gray-900 dark:text-white">{houseServices.number_of_bedrooms}</p>
                  </div>
                )}
                {houseServices.monthly_rent != null && (
                  <div>
                    <p className="text-gray-400 text-xs">Monthly Rent</p>
                    <p className="text-gray-900 dark:text-white">J${houseServices.monthly_rent.toLocaleString()}</p>
                  </div>
                )}
              </div>

              {/* Utilities */}
              <div className="grid grid-cols-3 gap-3 text-sm">
                {houseServices.utilities && (
                  <div>
                    <p className="text-gray-400 text-xs">Utilities</p>
                    <p className="text-gray-900 dark:text-white capitalize">{houseServices.utilities}</p>
                  </div>
                )}
                {houseServices.water && (
                  <div>
                    <p className="text-gray-400 text-xs">Water</p>
                    <p className="text-gray-900 dark:text-white capitalize">{houseServices.water}</p>
                  </div>
                )}
                {houseServices.sanitation && (
                  <div>
                    <p className="text-gray-400 text-xs">Sanitation</p>
                    <p className="text-gray-900 dark:text-white capitalize">{houseServices.sanitation}</p>
                  </div>
                )}
              </div>

              {/* Assets */}
              <div>
                <p className="text-gray-400 text-xs mb-2">Household Assets</p>
                <div className="flex flex-wrap gap-1.5">
                  {houseServices.has_stove && <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full text-xs">Stove</span>}
                  {houseServices.has_fridge && <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full text-xs">Fridge</span>}
                  {houseServices.has_bed && <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full text-xs">Bed</span>}
                  {houseServices.has_chair && <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full text-xs">Chair</span>}
                  {houseServices.has_table && <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full text-xs">Table</span>}
                  {houseServices.has_radio && <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full text-xs">Radio</span>}
                  {houseServices.has_tv && <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full text-xs">TV</span>}
                  {houseServices.has_cable && <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full text-xs">Cable</span>}
                  {houseServices.has_phone && <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full text-xs">Phone</span>}
                  {houseServices.has_computer && <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full text-xs">Computer</span>}
                  {houseServices.has_internet && <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full text-xs">Internet</span>}
                  {houseServices.has_washing_machine && <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full text-xs">Washing Machine</span>}
                  {houseServices.has_vehicle && <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full text-xs">Vehicle</span>}
                  {houseServices.has_bicycle && <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full text-xs">Bicycle</span>}
                  {houseServices.has_land && <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full text-xs">Land</span>}
                  {houseServices.has_livestock && <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full text-xs">Livestock</span>}
                </div>
              </div>

              {/* Income */}
              <div className="grid grid-cols-2 gap-3 text-sm pt-3 border-t border-gray-100 dark:border-gray-800">
                {houseServices.weekly_family_spending != null && (
                  <div>
                    <p className="text-gray-400 text-xs">Weekly Spending</p>
                    <p className="text-gray-900 dark:text-white font-medium">J${houseServices.weekly_family_spending.toLocaleString()}</p>
                  </div>
                )}
                {houseServices.total_income != null && (
                  <div>
                    <p className="text-gray-400 text-xs">Total Income</p>
                    <p className="text-gray-900 dark:text-white font-medium">J${houseServices.total_income.toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Registration Info */}
        <section className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 mb-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Registration Information</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500 dark:text-gray-400 mb-1">Registered On</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {new Date(family.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 mb-1">Registration Channel</p>
              <p className="font-medium text-gray-900 dark:text-white capitalize">
                {family.intake_channel.replace(/_/g, ' ')}
              </p>
            </div>
            {family.submitted_at && (
              <div>
                <p className="text-gray-500 dark:text-gray-400 mb-1">Submitted On</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {new Date(family.submitted_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            )}
            {family.verified_at && (
              <div>
                <p className="text-gray-500 dark:text-gray-400 mb-1">Verified On</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {new Date(family.verified_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Update Button */}
        {family.registration_status === 'DRAFT' && (
          <div className="mt-6">
            <button 
              onClick={() => navigate(`/register?family=${family.uuid}`)}
              className="w-full bg-primary text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
            >
              <span className="material-symbols-outlined">edit</span>
              Continue Registration
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
