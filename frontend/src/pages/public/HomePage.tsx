import { Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuthStore } from '@/store/authStore'

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

// ═══════════════════════════════════════════════════════════════
// SQL Editor — Supabase RPC config for all 3 services
// ═══════════════════════════════════════════════════════════════

interface ServiceConfig {
  id: string
  label: string
  icon: string
  color: string
  supabaseUrl: string
  supabaseKey: string
  defaultQuery: string
  quickTables: string[]
}

const dbServices: ServiceConfig[] = [
  {
    id: 'family',
    label: 'Family DB',
    icon: 'family_restroom',
    color: 'bg-blue-600',
    supabaseUrl: 'https://xdupcfxxcbltjmdgzzhf.supabase.co',
    supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdXBjZnh4Y2JsdGptZGd6emhmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDYyODk1MiwiZXhwIjoyMDg2MjA0OTUyfQ.hyRMxWe9mlVVyb1rmBLv4Ee1l1MIUTo2J8hOohDlxCk',
    defaultQuery: 'SELECT * FROM family LIMIT 10',
    quickTables: ['family', 'family_member', 'address', 'documents'],
  },
  {
    id: 'iam',
    label: 'IAM DB',
    icon: 'shield_person',
    color: 'bg-purple-600',
    supabaseUrl: 'https://wrxrstmncezssrscrkxs.supabase.co',
    supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndyeHJzdG1uY2V6c3Nyc2Nya3hzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg2ODc5MiwiZXhwIjoyMDg2NDQ0NzkyfQ.MsQ4yGGoXc8qpNScZqeOS0JqoTDuAMENmMrzfbuP0TQ',
    defaultQuery: 'SELECT user_id, email, status FROM users LIMIT 10',
    quickTables: ['users', 'user_roles', 'password_reset_tokens', 'login_events'],
  },
  {
    id: 'email',
    label: 'Email DB',
    icon: 'mail',
    color: 'bg-green-600',
    supabaseUrl: 'https://qlehzgxxhbbiniouwgta.supabase.co',
    supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsZWh6Z3h4aGJiaW5pb3V3Z3RhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg3NDUyOCwiZXhwIjoyMDg2NDUwNTI4fQ.Z7n9JDcABBe6OeiLaLMCl4gMPjfJthyOrE7ObaSc_To',
    defaultQuery: 'SELECT id, to_email, subject, status, created_at FROM emails ORDER BY created_at DESC LIMIT 10',
    quickTables: ['emails', 'email_templates', 'email_events'],
  },
]

async function executeSupabaseSQL(
  supabaseUrl: string,
  supabaseKey: string,
  query: string,
): Promise<{ data?: unknown[]; error?: string; duration_ms: number }> {
  const start = Date.now()
  try {
    const trimmed = query.trim().toUpperCase()
    let rpcFn = 'exec_sql'
    if (trimmed.startsWith('INSERT') || trimmed.startsWith('UPDATE') || trimmed.startsWith('DELETE')) {
      rpcFn = query.toUpperCase().includes('RETURNING') ? 'exec_dml' : 'exec_ddl'
    } else if (trimmed.startsWith('CREATE') || trimmed.startsWith('ALTER') || trimmed.startsWith('DROP')) {
      rpcFn = 'exec_ddl'
    }

    const res = await axios.post(
      `${supabaseUrl}/rest/v1/rpc/${rpcFn}`,
      { query },
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      },
    )

    const data = Array.isArray(res.data) ? res.data : res.data ? [res.data] : []
    return { data, duration_ms: Date.now() - start }
  } catch (err: unknown) {
    const msg = axios.isAxiosError(err)
      ? err.response?.data?.message || err.response?.data?.error || err.message
      : (err as Error).message
    return { error: String(msg), duration_ms: Date.now() - start }
  }
}

export default function HomePage() {
  const location = useLocation()
  const { session } = useAuthStore()
  const isAuthenticated = !!session?.access_token

  // Registration success message from navigation state
  const registrationSuccess = location.state?.registrationSuccess
  const successMessage = location.state?.message
  const registeredFamilyId = location.state?.familyId
  const [showSuccessMessage, setShowSuccessMessage] = useState(!!registrationSuccess)

  // SQL Editor state
  const [activeService, setActiveService] = useState<string>('family')
  const [sqlQueries, setSqlQueries] = useState<Record<string, string>>(() => {
    const q: Record<string, string> = {}
    for (const s of dbServices) q[s.id] = s.defaultQuery
    return q
  })
  const [sqlResults, setSqlResults] = useState<Record<string, { data?: unknown[]; error?: string; duration_ms?: number }>>({})
  const [executing, setExecuting] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (registrationSuccess) {
      const timer = setTimeout(() => {
        setShowSuccessMessage(false)
        globalThis.history.replaceState({}, document.title)
      }, 30000)
      return () => clearTimeout(timer)
    }
  }, [registrationSuccess])

  const currentService = dbServices.find((s) => s.id === activeService)!

  const handleExecute = async (serviceId: string) => {
    const svc = dbServices.find((s) => s.id === serviceId)!
    const query = sqlQueries[serviceId]
    if (!query?.trim()) return

    setExecuting((prev) => ({ ...prev, [serviceId]: true }))
    setSqlResults((prev) => ({ ...prev, [serviceId]: {} as never }))

    const result = await executeSupabaseSQL(svc.supabaseUrl, svc.supabaseKey, query)
    setSqlResults((prev) => ({ ...prev, [serviceId]: result }))
    setExecuting((prev) => ({ ...prev, [serviceId]: false }))
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

  const result = sqlResults[activeService]

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
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-primary font-bold rounded-xl hover:bg-gray-100 transition-colors shadow-lg"
                >
                  <span className="material-symbols-outlined">dashboard</span>
                  Go to Dashboard
                </Link>
              ) : (
                <>
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
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
           SQL Editor — All 3 Supabase Services
         ═══════════════════════════════════════════════════════════ */}
      <section className="py-8 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="material-symbols-outlined text-primary text-2xl">database</span>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              SQL Editor
            </h2>
            <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded font-medium">
              All Services
            </span>
          </div>

          {/* Service Tabs */}
          <div className="flex gap-2 mb-4">
            {dbServices.map((svc) => (
              <button
                key={svc.id}
                onClick={() => setActiveService(svc.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  activeService === svc.id
                    ? `${svc.color} text-white`
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                }`}
              >
                <span className="material-symbols-outlined text-lg">{svc.icon}</span>
                {svc.label}
              </button>
            ))}
          </div>

          {/* SQL Input + Results */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="p-4">
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  SQL Query — {currentService.label}
                </label>
                <textarea
                  value={sqlQueries[activeService]}
                  onChange={(e) =>
                    setSqlQueries((prev) => ({ ...prev, [activeService]: e.target.value }))
                  }
                  className="w-full h-32 font-mono text-sm p-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white resize-y"
                  placeholder={currentService.defaultQuery}
                />
              </div>

              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => handleExecute(activeService)}
                  disabled={executing[activeService]}
                  className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 disabled:opacity-50 ${currentService.color}`}
                >
                  {executing[activeService] ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                      Executing...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-lg">play_arrow</span>
                      Execute
                    </>
                  )}
                </button>

                <div className="flex gap-1 items-center flex-wrap">
                  <span className="text-xs text-gray-500 mr-1">Quick:</span>
                  {currentService.quickTables.map((table) => (
                    <button
                      key={table}
                      onClick={() =>
                        setSqlQueries((prev) => ({
                          ...prev,
                          [activeService]: `SELECT * FROM ${table} LIMIT 10`,
                        }))
                      }
                      className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 font-mono"
                    >
                      {table}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Results */}
            {result && result.duration_ms !== undefined && (
              <div className="border-t border-gray-200 dark:border-gray-700">
                {result.error ? (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                    <strong>Error:</strong> {result.error}
                  </div>
                ) : (
                  <>
                    <div className="p-2 bg-gray-50 dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-400 flex justify-between px-4">
                      <span>{Array.isArray(result.data) ? result.data.length : 0} rows</span>
                      <span>{result.duration_ms}ms</span>
                    </div>
                    <div className="max-h-72 overflow-auto">
                      {Array.isArray(result.data) && result.data.length > 0 ? (
                        <table className="w-full text-xs">
                          <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0">
                            <tr>
                              {Object.keys(result.data[0] as Record<string, unknown>).map((key) => (
                                <th
                                  key={key}
                                  className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap"
                                >
                                  {key}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {result.data.map((row, i) => (
                              <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                {Object.values(row as Record<string, unknown>).map((val, j) => (
                                  <td
                                    key={j}
                                    className="px-3 py-2 text-gray-600 dark:text-gray-400 max-w-xs truncate whitespace-nowrap"
                                  >
                                    {val === null ? (
                                      <span className="text-gray-400 italic">null</span>
                                    ) : (
                                      String(val)
                                    )}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="p-4 text-center text-gray-500 text-sm">
                          Query executed successfully. No rows returned.
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

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

      {/* CTA Section — only for unauthenticated users */}
      {!isAuthenticated && (
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
      )}
    </div>
  )
}
