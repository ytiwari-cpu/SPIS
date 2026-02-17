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
import { useAuthStore } from '@/store/authStore'
import { authFetch } from '@/services/authFetch'

// Database-aligned types (post-migration 006)
interface FamilyDB {
  uuid: string                              // Internal UUID
  family_id: string                         // Human-readable: F123
  household_size: number
  head_first_name: string | null
  head_last_name: string | null
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

export default function MyFamily() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  
  const [family, setFamily] = useState<FamilyDB | null>(null)
  const [members, setMembers] = useState<MemberDB[]>([])
  const [address, setAddress] = useState<AddressDB | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchFamilyData = async () => {
      if (!user?.uuid) {
        setIsLoading(false)
        setError('No family associated with this account')
        return
      }

      try {
        setIsLoading(true)
        setError(null)

        // Fetch family with all related data (members, address, documents)
        // Use uuid for API calls (internal identifier)
        const familyRes = await authFetch(`/families/${user.uuid}`)
        const familyData = await familyRes.json()
        
        if (!familyData.success) {
          throw new Error(familyData.error || 'Failed to fetch family')
        }
        
        // The API returns family with members, address, documents embedded
        const { members, address, ...familyOnly } = familyData.data
        setFamily(familyOnly)
        setMembers(members || [])
        setAddress(address || null)

      } catch (err) {
        console.error('Error fetching family data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load family data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchFamilyData()
  }, [user?.uuid])

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
              onClick={() => navigate('/registration')}
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
                {family.head_first_name} {family.head_last_name}
              </p>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Phone</p>
              <p className="text-gray-900 dark:text-white text-sm">{family.phone || 'Not provided'}</p>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Email</p>
              <p className="text-gray-900 dark:text-white text-sm">{family.email || 'Not provided'}</p>
            </div>
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
            <div className="flex justify-between items-center py-2">
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Registration Status</p>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                {statusInfo.text}
              </span>
            </div>
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
                          {member.first_name} {member.last_name}
                        </h3>
                        {member.member_id && (
                          <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs font-mono rounded">
                            {member.member_id}
                          </span>
                        )}
                      </div>
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
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white mb-1">
                    {address.address_type} Address
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {address.line1}
                    {address.line2 && `, ${address.line2}`}
                  </p>
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
              onClick={() => navigate(`/registration?family=${family.uuid}`)}
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
