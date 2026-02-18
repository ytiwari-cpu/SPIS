/**
 * MY PROFILE PAGE - Real Data from API
 * 
 * NO MOCK DATA - Fetches real user profile from database
 * Shows: Name, Email, Phone, National ID (from head member)
 */

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { authFetch } from '@/services/authFetch'

const API_BASE = 'http://localhost:3001/api/v1'

interface MemberDB {
  member_id: string
  family_id: string
  national_id: string | null
  first_name: string
  last_name: string
  middle_names: string | null
  alias: string | null
  trn: string | null
  phone: string | null
  email: string | null
  relationship_to_head: string
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
  family_id: string
  head_first_name: string | null
  head_last_name: string | null
  head_middle_names: string | null
  head_alias: string | null
  phone: string | null
  email: string | null
  programme: string | null
  payment_option: string | null
  members: MemberDB[]
  address: AddressDB | null
}

export default function MyProfile() {
  const { user } = useAuthStore()
  const [family, setFamily] = useState<FamilyWithDetails | null>(null)
  const [headMember, setHeadMember] = useState<MemberDB | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.uuid) {
        setIsLoading(false)
        return
      }

      try {
        // Use uuid for API calls (internal identifier)
        const res = await authFetch(`/families/${user.uuid}`)
        const data = await res.json()

        if (data.success && data.data) {
          setFamily(data.data)
          // Find head member
          const head = data.data.members?.find(
            (m: MemberDB) => m.relationship_to_head === 'head'
          )
          setHeadMember(head || null)
        }
      } catch (err) {
        console.error('Failed to fetch profile:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchProfile()
  }, [user?.uuid])

  // Get display values from family or head member
  const displayName = family?.head_first_name && family?.head_last_name
    ? `${family.head_first_name}${family.head_middle_names ? ' ' + family.head_middle_names : ''} ${family.head_last_name}`
    : headMember
      ? `${headMember.first_name}${headMember.middle_names ? ' ' + headMember.middle_names : ''} ${headMember.last_name}`
      : user?.name || 'N/A'

  const displayAlias = family?.head_alias || headMember?.alias || null
  const displayEmail = family?.email || headMember?.email || user?.email || 'N/A'
  const displayPhone = family?.phone || headMember?.phone || 'N/A'
  const displayNationalId = headMember?.national_id
    ? `****-****-${headMember.national_id.slice(-4)}`
    : 'Not registered'
  const displayTrn = headMember?.trn || null

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

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Account</h1>
        </header>

        {/* Profile Card */}
        <section className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm mb-6">
          {/* Avatar & Name */}
          <div className="flex items-center gap-4 mb-6">
            <div className="size-16 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center overflow-hidden border border-gray-300 dark:border-gray-700">
              <span className="material-symbols-outlined text-gray-400 text-4xl">account_circle</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">{displayName}</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Citizen Applicant</p>
            </div>
          </div>

          {/* Profile Fields */}
          <div className="space-y-4">
            <div className="flex flex-col border-b border-gray-100 dark:border-gray-800 pb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Full Name</p>
              <p className="text-base font-medium text-gray-900 dark:text-white">{displayName}</p>
            </div>
            {displayAlias && (
              <div className="flex flex-col border-b border-gray-100 dark:border-gray-800 pb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Alias</p>
                <p className="text-base font-medium text-gray-900 dark:text-white">{displayAlias}</p>
              </div>
            )}
            <div className="flex flex-col border-b border-gray-100 dark:border-gray-800 pb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Email Address</p>
              <p className="text-base font-medium text-gray-900 dark:text-white">{displayEmail}</p>
            </div>
            <div className="flex flex-col border-b border-gray-100 dark:border-gray-800 pb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Phone Number</p>
              <p className="text-base font-medium text-gray-900 dark:text-white">{displayPhone}</p>
            </div>
            <div className="flex flex-col border-b border-gray-100 dark:border-gray-800 pb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">National ID</p>
              <p className="text-base font-medium text-gray-900 dark:text-white">{displayNationalId}</p>
            </div>
            {displayTrn && (
              <div className="flex flex-col border-b border-gray-100 dark:border-gray-800 pb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">TRN</p>
                <p className="text-base font-medium text-gray-900 dark:text-white font-mono">{displayTrn}</p>
              </div>
            )}
            {family?.programme && (
              <div className="flex flex-col border-b border-gray-100 dark:border-gray-800 pb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Programme</p>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 w-fit">
                  {family.programme}
                </span>
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
            <button className="w-full bg-primary text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-primary-dark transition-colors">
              <span className="material-symbols-outlined text-xl">edit</span>
              Edit Profile
            </button>
            <button className="w-full bg-primary/10 text-primary font-bold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-primary/20 transition-colors">
              <span className="material-symbols-outlined text-xl">lock_reset</span>
              Change Password
            </button>
          </div>
        </section>

        {/* Biometric Enrollment Status - Shows actual status when available */}
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

        {/* Family ID */}
        {family?.family_id && (
          <section className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-5 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">
                  Family ID
                </p>
                <p className="text-lg font-bold font-mono text-blue-900 dark:text-blue-100">
                  {family.family_id}
                </p>
              </div>
              <span className="material-symbols-outlined text-blue-500 text-3xl">qr_code</span>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
