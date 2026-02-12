import { Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useIsDevMode } from '@/store/authStore'
import { devApi, authApi } from '@/services/familyApi'
import type { FamilyListItem } from '@/types/database'

// Static notices data (public information)
const publicNotices = [
  {
    id: '1',
    title: 'New Social Security Programme Announced',
    summary: 'The government has launched a new social security initiative to support vulnerable families across the nation.',
    category: 'GOVERNMENT',
    is_pinned: true,
    published_at: '2026-02-08T10:00:00Z',
  },
  {
    id: '2',
    title: 'Education Grant Applications Now Open',
    summary: 'Applications for the 2026 Education Grant programme are now being accepted. Deadline: March 15, 2026.',
    category: 'PROGRAMME',
    is_pinned: false,
    published_at: '2026-02-05T09:00:00Z',
  },
  {
    id: '3',
    title: 'System Maintenance Notice',
    summary: 'Scheduled maintenance on February 15, 2026 from 2:00 AM to 6:00 AM. Services may be temporarily unavailable.',
    category: 'GENERAL',
    is_pinned: false,
    published_at: '2026-02-01T14:00:00Z',
  },
]

const serviceCards = [
  {
    icon: 'family_restroom',
    title: 'Family Registration',
    description: 'Register your family to access social protection programmes and benefits.',
    color: 'bg-blue-500',
  },
  {
    icon: 'school',
    title: 'Education Support',
    description: 'Access scholarships, grants, and educational assistance for your children.',
    color: 'bg-green-500',
  },
  {
    icon: 'health_and_safety',
    title: 'Health Benefits',
    description: 'Healthcare subsidies and medical assistance programmes for eligible families.',
    color: 'bg-red-500',
  },
  {
    icon: 'home',
    title: 'Housing Assistance',
    description: 'Support for housing needs including rent assistance and home improvements.',
    color: 'bg-amber-500',
  },
]

export default function HomePage() {
  const isDevMode = useIsDevMode()
  const location = useLocation()
  const [activeDevTab, setActiveDevTab] = useState<'families' | 'sql' | 'schema'>('families')
  
  // Registration success message from navigation state
  const registrationSuccess = location.state?.registrationSuccess
  const successMessage = location.state?.message
  const registeredFamilyId = location.state?.familyId
  const [showSuccessMessage, setShowSuccessMessage] = useState(!!registrationSuccess)
  
  // Clear the state so the message doesn't persist on refresh
  useEffect(() => {
    if (registrationSuccess) {
      // Clear the location state after 30 seconds
      const timer = setTimeout(() => {
        setShowSuccessMessage(false)
        globalThis.history.replaceState({}, document.title)
      }, 30000)
      return () => clearTimeout(timer)
    }
  }, [registrationSuccess])
  
  // Dev tools state
  const [families, setFamilies] = useState<FamilyListItem[]>([])
  const [loadingFamilies, setLoadingFamilies] = useState(false)
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM family LIMIT 10')
  const [sqlResult, setSqlResult] = useState<{ data?: unknown[]; error?: string; duration_ms?: number } | null>(null)
  const [executingSql, setExecutingSql] = useState(false)
  const [schemaInfo, setSchemaInfo] = useState<Record<string, { exists: boolean; error?: string }> | null>(null)
  const [loadingSchema, setLoadingSchema] = useState(false)
  const [seedingData, setSeedingData] = useState(false)
  const [seedMessage, setSeedMessage] = useState('')

  useEffect(() => {
    if (isDevMode) {
      loadFamilies()
    }
  }, [isDevMode])

  const loadFamilies = async () => {
    setLoadingFamilies(true)
    try {
      const response = await authApi.listFamilies()
      if (response.success && response.data) {
        setFamilies(response.data)
      }
    } catch (err) {
      console.error('Failed to load families:', err)
    } finally {
      setLoadingFamilies(false)
    }
  }

  const loadSchema = async () => {
    setLoadingSchema(true)
    try {
      const response = await devApi.getSchema()
      if (response.success && response.tables) {
        setSchemaInfo(response.tables)
      }
    } catch (err) {
      console.error('Failed to load schema:', err)
    } finally {
      setLoadingSchema(false)
    }
  }

  const executeSql = async () => {
    if (!sqlQuery.trim()) return
    
    setExecutingSql(true)
    setSqlResult(null)
    try {
      const result = await devApi.executeSql(sqlQuery)
      setSqlResult(result)
    } catch (err: unknown) {
      setSqlResult({ error: err instanceof Error ? err.message : 'Execution failed' })
    } finally {
      setExecutingSql(false)
    }
  }

  const handleSeedData = async () => {
    setSeedingData(true)
    setSeedMessage('')
    try {
      const result = await devApi.seedData()
      if (result.success) {
        setSeedMessage(`Created family: ${result.data.family.family_id}`)
        loadFamilies()
      } else {
        setSeedMessage('Seed failed')
      }
    } catch (err: unknown) {
      setSeedMessage(`${err instanceof Error ? err.message : 'Seed failed'}`)
    } finally {
      setSeedingData(false)
    }
  }

  const getCategoryBadge = (category: string) => {
    const styles: Record<string, string> = {
      GOVERNMENT: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      PROGRAMME: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      EMERGENCY: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      GENERAL: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
    }
    return styles[category] || styles.GENERAL
  }

  return (
    <div className="min-h-screen">
      {/* Registration Success Banner */}
      {showSuccessMessage && (
        <div className="bg-green-500 text-white py-4 px-6">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-2xl">check_circle</span>
              <div>
                <p className="font-bold">Registration Submitted Successfully!</p>
                <p className="text-sm text-green-100">
                  {successMessage || 'Your application is now pending verification. You will be notified once approved.'}
                </p>
                {registeredFamilyId && (
                  <p className="text-xs text-green-200 mt-1">
                    Reference ID: {registeredFamilyId.slice(0, 8)}...
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                setShowSuccessMessage(false)
                globalThis.history.replaceState({}, document.title)
              }}
              className="p-2 hover:bg-green-400 rounded-lg transition-colors"
              aria-label="Dismiss"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary to-primary-dark text-white py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="text-3xl md:text-5xl font-bold mb-6 leading-tight">
              Social Protection for Every Family
            </h1>
            <p className="text-lg md:text-xl text-white/80 mb-8">
              Access government social welfare programmes, register your family, 
              and receive the benefits you deserve through our unified national platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-primary font-bold rounded-xl hover:bg-gray-100 transition-colors shadow-lg"
              >
                <span className="material-symbols-outlined">group_add</span>
                Register a Family
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 transition-colors border border-white/20"
              >
                <span className="material-symbols-outlined">login</span>
                Citizen Login
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* DEV MODE: Developer Tools */}
      {isDevMode && (
        <section className="py-8 bg-amber-50 dark:bg-amber-900/10 border-b-2 border-amber-300 dark:border-amber-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 mb-6">
              <span className="material-symbols-outlined text-amber-600 text-2xl">developer_mode</span>
              <h2 className="text-xl font-bold text-amber-800 dark:text-amber-300">
                Developer Tools
              </h2>
              <span className="text-xs bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded font-medium">
                DEV ONLY
              </span>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2 mb-4">
              {[
                { id: 'families', label: 'Family List', icon: 'group' },
                { id: 'sql', label: 'SQL Editor', icon: 'database' },
                { id: 'schema', label: 'Schema Info', icon: 'table_chart' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveDevTab(tab.id as typeof activeDevTab)
                    if (tab.id === 'schema' && !schemaInfo) loadSchema()
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                    activeDevTab === tab.id
                      ? 'bg-amber-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-amber-700 dark:text-amber-300 hover:bg-amber-100'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-amber-200 dark:border-amber-800 overflow-hidden">
              {/* Family List Tab */}
              {activeDevTab === 'families' && (
                <div className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      Registered Families ({families.length})
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSeedData}
                        disabled={seedingData}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-lg">add</span>
                        Seed Sample
                      </button>
                      <button
                        onClick={loadFamilies}
                        className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-300"
                      >
                        <span className="material-symbols-outlined text-lg">refresh</span>
                        Refresh
                      </button>
                    </div>
                  </div>
                  
                  {seedMessage && (
                    <div className="mb-4 p-2 rounded text-sm bg-blue-100 text-blue-700">
                      {seedMessage}
                    </div>
                  )}

                  {loadingFamilies ? (
                    <div className="flex items-center justify-center py-8 text-gray-500">
                      <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
                      Loading...
                    </div>
                  ) : families.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <span className="material-symbols-outlined text-4xl mb-2">folder_open</span>
                      <p>No families found. Click "Seed Sample" to create test data.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Family ID</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Code</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Status</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {families.map((family) => (
                            <tr key={family.family_id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                              <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">
                                {family.family_id.substring(0, 8)}...
                              </td>
                              <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                                {family.family_id}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  family.registration_status === 'verified' ? 'bg-green-100 text-green-700' :
                                  family.registration_status === 'pending_verification' ? 'bg-yellow-100 text-yellow-700' :
                                  family.registration_status === 'rejected' ? 'bg-red-100 text-red-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {family.registration_status}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <Link
                                  to="/login"
                                  onClick={() => navigator.clipboard.writeText(family.family_id)}
                                  className="text-primary hover:underline text-sm font-medium"
                                >
                                  Copy ID & Login
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* SQL Editor Tab */}
              {activeDevTab === 'sql' && (
                <div className="p-4">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      SQL Query (SELECT only)
                    </label>
                    <textarea
                      value={sqlQuery}
                      onChange={(e) => setSqlQuery(e.target.value)}
                      className="w-full h-32 font-mono text-sm p-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
                      placeholder="SELECT * FROM family LIMIT 10"
                    />
                  </div>
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={executeSql}
                      disabled={executingSql}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
                    >
                      {executingSql ? (
                        <>
                          <span className="material-symbols-outlined animate-spin">progress_activity</span>
                          Executing...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined">play_arrow</span>
                          Execute
                        </>
                      )}
                    </button>
                    <div className="flex gap-1">
                      {['family', 'family_member', 'address', 'documents'].map((table) => (
                        <button
                          key={table}
                          onClick={() => setSqlQuery(`SELECT * FROM ${table} LIMIT 10`)}
                          className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300"
                        >
                          {table}
                        </button>
                      ))}
                    </div>
                  </div>

                  {sqlResult && (
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      {sqlResult.error ? (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
                          <strong>Error:</strong> {sqlResult.error}
                        </div>
                      ) : (
                        <>
                          <div className="p-2 bg-gray-50 dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-400 flex justify-between">
                            <span>{Array.isArray(sqlResult.data) ? sqlResult.data.length : 0} rows</span>
                            <span>{sqlResult.duration_ms}ms</span>
                          </div>
                          <div className="max-h-64 overflow-auto">
                            {Array.isArray(sqlResult.data) && sqlResult.data.length > 0 ? (
                              <table className="w-full text-xs">
                                <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0">
                                  <tr>
                                    {Object.keys(sqlResult.data[0] as Record<string, unknown>).map((key) => (
                                      <th key={key} className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                                        {key}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                  {sqlResult.data.map((row, i) => (
                                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                      {Object.values(row as Record<string, unknown>).map((val, j) => (
                                        <td key={j} className="px-3 py-2 text-gray-600 dark:text-gray-400 max-w-xs truncate">
                                          {val === null ? <span className="text-gray-400 italic">null</span> : String(val)}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <div className="p-4 text-center text-gray-500">No results</div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Schema Info Tab */}
              {activeDevTab === 'schema' && (
                <div className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Database Tables</h3>
                    <button
                      onClick={loadSchema}
                      className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-300"
                    >
                      <span className="material-symbols-outlined text-lg">refresh</span>
                      Refresh
                    </button>
                  </div>

                  {loadingSchema ? (
                    <div className="flex items-center justify-center py-8 text-gray-500">
                      <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
                      Loading schema...
                    </div>
                  ) : schemaInfo ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                      {Object.entries(schemaInfo).map(([table, info]) => (
                        <div
                          key={table}
                          className={`p-3 rounded-lg border ${
                            info.exists
                              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`material-symbols-outlined text-lg ${info.exists ? 'text-green-600' : 'text-red-600'}`}>
                              {info.exists ? 'check_circle' : 'error'}
                            </span>
                            <span className="font-medium text-sm text-gray-900 dark:text-white">{table}</span>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {info.exists ? 'Available' : info.error || 'Not found'}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      Click refresh to load schema info
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* About Section */}
      <section className="py-16 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4">
              About the Platform
            </h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              The Social Protection Information System (SPIS) is designed to streamline 
              access to government welfare programmes and ensure benefits reach those who need them most.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {serviceCards.map((service, index) => (
              <div
                key={index}
                className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 hover:shadow-lg transition-shadow"
              >
                <div className={`${service.color} w-12 h-12 rounded-xl flex items-center justify-center mb-4`}>
                  <span className="material-symbols-outlined text-white">{service.icon}</span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  {service.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {service.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Public Notices Section */}
      <section className="py-16 bg-gray-50 dark:bg-background-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
              Public Notices
            </h2>
            <Link
              to="/notices"
              className="text-primary font-semibold text-sm hover:underline flex items-center gap-1"
            >
              View All
              <span className="material-symbols-outlined text-lg">chevron_right</span>
            </Link>
          </div>

          <div className="space-y-4">
            {publicNotices.map((notice) => (
              <div
                key={notice.id}
                className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  <div className="hidden sm:flex w-12 h-12 shrink-0 rounded-full bg-primary/10 items-center justify-center">
                    <span className="material-symbols-outlined text-primary">
                      {notice.category === 'EMERGENCY' ? 'warning' : 'campaign'}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${getCategoryBadge(notice.category)}`}>
                        {notice.category}
                      </span>
                      {notice.is_pinned && (
                        <span className="text-amber-500 flex items-center gap-1 text-xs">
                          <span className="material-symbols-outlined text-sm">push_pin</span>
                          Pinned
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                      {notice.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {notice.summary}
                    </p>
                    <p className="text-xs text-gray-400">
                      Published: {new Date(notice.published_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <Link
                    to={`/notices/${notice.id}`}
                    className="shrink-0 text-primary hover:text-primary-dark"
                  >
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-primary to-primary-dark rounded-2xl p-8 md:p-12 text-white text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Ready to Register Your Family?
            </h2>
            <p className="text-white/80 mb-8 max-w-2xl mx-auto">
              Join thousands of families who have already registered and are receiving 
              social protection benefits. The registration process is simple and takes 
              only a few minutes.
            </p>
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-primary font-bold rounded-xl hover:bg-gray-100 transition-colors shadow-lg"
            >
              <span className="material-symbols-outlined">group_add</span>
              Start Registration
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
