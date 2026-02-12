import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore, useFamilyUuid, useFamilyId } from '@/store/authStore'
import { familyApi } from '@/services/familyApi'
import type { DbFamilyWithDetails, RegistrationStatus } from '@/types/database'

const getStatusBadge = (status: RegistrationStatus) => {
  const styles: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    pending_verification: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    verified: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  }
  return styles[status] || styles.draft
}

export default function Dashboard() {
  const { session, headMember } = useAuthStore()
  const familyUuid = useFamilyUuid()  // UUID for API calls
  const familyId = useFamilyId()      // Human-readable for display
  const [familyData, setFamilyData] = useState<DbFamilyWithDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (familyUuid) {
      loadFamilyData()
    }
  }, [familyUuid])

  const loadFamilyData = async () => {
    if (!familyUuid) return
    
    setIsLoading(true)
    setError(null)
    try {
      const response = await familyApi.getById(familyUuid)  // Use UUID for API
      if (response.success && response.data) {
        setFamilyData(response.data)
      } else {
        setError('Failed to load family data')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load family data')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="h-8 w-64 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
            <span className="material-symbols-outlined text-red-500 text-4xl mb-4">error</span>
            <h2 className="text-lg font-bold text-red-700 dark:text-red-400 mb-2">Failed to Load Dashboard</h2>
            <p className="text-red-600 dark:text-red-300 text-sm mb-4">{error}</p>
            <button 
              onClick={loadFamilyData}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!familyData) return null

  // Find head of household
  const headOfHousehold = familyData.members.find(m => m.relationship_to_head === 'head') || headMember
  const displayName = headOfHousehold 
    ? `${headOfHousehold.first_name}` 
    : session?.family_id || 'Citizen'

  // Calculate stats from real data
  const memberCount = familyData.members.length
  const pendingDocs = familyData.documents.filter(d => 
    d.document_verification.some(v => v.status === 'pending')
  ).length
  const verifiedDocs = familyData.documents.filter(d => 
    d.document_verification.some(v => v.status === 'verified')
  ).length

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Welcome Header */}
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Welcome, {displayName}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Family registered: {new Date(familyData.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </header>

        {/* Registration Status Banner */}
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">
                {familyData.registration_status === 'verified' ? 'verified' : 'pending'}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Family ID: {familyData.family_id}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${getStatusBadge(familyData.registration_status)}`}>
                  {familyData.registration_status.replace('_', ' ')}
                </span>
                {familyData.vulnerability_flag && (
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                    VULNERABLE
                  </span>
                )}
              </div>
            </div>
          </div>
          <Link to="/family" className="text-primary font-semibold text-sm hidden sm:flex items-center gap-1">
            View Details
            <span className="material-symbols-outlined text-lg">chevron_right</span>
          </Link>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
          <Link to="/family" className="flex flex-col gap-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm hover:shadow-md transition-shadow">
            <span className="material-symbols-outlined text-primary">groups</span>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">Family Members</p>
              <h3 className="text-gray-900 dark:text-white text-xl font-bold">{memberCount} Members</h3>
            </div>
          </Link>
          <div className="flex flex-col gap-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
            <span className="material-symbols-outlined text-green-600">home</span>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">Household Size</p>
              <h3 className="text-gray-900 dark:text-white text-xl font-bold">{familyData.household_size}</h3>
            </div>
          </div>
          <Link to="/documents" className="flex flex-col gap-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm hover:shadow-md transition-shadow">
            <span className="material-symbols-outlined text-amber-600">description</span>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">Documents</p>
              <h3 className="text-gray-900 dark:text-white text-xl font-bold">{familyData.documents.length} Files</h3>
            </div>
          </Link>
          <div className="flex flex-col gap-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
            <span className="material-symbols-outlined text-blue-500">location_on</span>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">Geo Code</p>
              <h3 className="text-gray-900 dark:text-white text-lg font-bold truncate">{familyData.geo_code || 'Not Set'}</h3>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <Link to="/family" className="flex items-center gap-3 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <span className="material-symbols-outlined text-primary">person_add</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">Add Member</span>
          </Link>
          <Link to="/documents" className="flex items-center gap-3 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <span className="material-symbols-outlined text-primary">upload_file</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">Upload Document</span>
          </Link>
          <Link to="/profile" className="flex items-center gap-3 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <span className="material-symbols-outlined text-primary">edit</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">Update Profile</span>
          </Link>
          <Link to="/settings" className="flex items-center gap-3 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <span className="material-symbols-outlined text-primary">settings</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">Settings</span>
          </Link>
        </div>

        {/* Family Members List */}
        <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm mb-8">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
            <h3 className="text-gray-900 dark:text-white text-lg font-bold">Family Members</h3>
            <Link to="/family" className="text-primary text-sm font-semibold">View All</Link>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {familyData.members.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <span className="material-symbols-outlined text-4xl mb-2">group_off</span>
                <p>No family members registered yet</p>
              </div>
            ) : (
              familyData.members.slice(0, 4).map((member) => (
                <div key={member.member_id} className="p-4 flex gap-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <div className="size-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary">
                      {member.gender === 'male' ? 'man' : member.gender === 'female' ? 'woman' : 'person'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {member.first_name} {member.last_name}
                      {member.relationship_to_head === 'head' && (
                        <span className="ml-2 px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded font-medium">
                          HEAD
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                      {member.relationship_to_head} • {member.gender || 'Unknown'}
                      {member.date_of_birth && ` • ${new Date().getFullYear() - new Date(member.date_of_birth).getFullYear()} yrs`}
                    </p>
                  </div>
                  {!member.alive_flag && (
                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">Deceased</span>
                  )}
                </div>
              ))
            )}
          </div>
          {familyData.members.length > 4 && (
            <div className="p-4 bg-gray-50 dark:bg-gray-800 text-center">
              <Link to="/family" className="text-sm font-bold text-primary">
                View All {familyData.members.length} Members
              </Link>
            </div>
          )}
        </section>

        {/* Address Info */}
        {familyData.address && (
          <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
            <h3 className="text-gray-900 dark:text-white text-lg font-bold mb-3">Permanent Address</h3>
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary">location_on</span>
              <div>
                <p className="text-gray-900 dark:text-white font-medium">{familyData.address.line1}</p>
                {familyData.address.line2 && <p className="text-gray-600 dark:text-gray-400">{familyData.address.line2}</p>}
                <p className="text-gray-600 dark:text-gray-400">
                  {[familyData.address.city, familyData.address.region, familyData.address.postal_code]
                    .filter(Boolean)
                    .join(', ')}
                </p>
                <p className="text-gray-500 dark:text-gray-500 text-sm">{familyData.address.country}</p>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
