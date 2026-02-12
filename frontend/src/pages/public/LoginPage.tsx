import { Link, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuthStore, useIsDevMode } from '@/store/authStore'
import { authApi } from '@/services/familyApi'
import type { FamilyListItem } from '@/types/database'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, isAuthenticated, setFamilyDetails } = useAuthStore()
  const isDevMode = useIsDevMode()
  
  // Form state
  const [familyId, setFamilyId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Dev tools state
  const [families, setFamilies] = useState<FamilyListItem[]>([])
  const [loadingFamilies, setLoadingFamilies] = useState(false)

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard')
    }
  }, [isAuthenticated, navigate])

  // Load family list for dev mode
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

  const handleLogin = async (id: string) => {
    if (!id.trim()) {
      setError('Please enter a Family ID')
      return
    }

    setError('')
    setIsLoading(true)

    try {
      const response = await authApi.login(id.trim())
      
      if (response.success && response.data) {
        login(response.data)
        
        // Fetch additional family details
        try {
          const meResponse = await authApi.getMe()
          if (meResponse.success && meResponse.data) {
            setFamilyDetails(meResponse.data, meResponse.data.head_member || null)
          }
        } catch {
          // Non-critical - continue anyway
        }
        
        navigate('/dashboard')
      } else {
        setError('Login failed. Please check your Family ID.')
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      if (errorMessage.includes('404') || errorMessage.includes('not found')) {
        setError('Family not found. Please check your Family ID or register a new family.')
      } else {
        setError(`Login failed: ${errorMessage}`)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleLogin(familyId)
  }

  const handleQuickLogin = (id: string) => {
    setFamilyId(id)
    handleLogin(id)
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
      pending_verification: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      verified: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    }
    return styles[status] || styles.draft
  }

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="flex size-14 items-center justify-center rounded-xl bg-primary text-white">
              <span className="material-symbols-outlined text-3xl">account_balance</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Citizen Portal Login
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Enter your Family ID to access the portal
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-800">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg flex items-start gap-2">
                <span className="material-symbols-outlined text-lg shrink-0">error</span>
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Family ID (UUID)
              </label>
              <input
                type="text"
                value={familyId}
                onChange={(e) => setFamilyId(e.target.value)}
                placeholder="e.g., 123e4567-e89b-12d3-a456-426614174000"
                className="w-full h-12 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-gray-900 dark:text-white font-mono text-sm"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Your Family ID was provided during registration
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary text-white font-bold h-12 rounded-lg hover:bg-primary-dark transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <span className="material-symbols-outlined animate-spin">progress_activity</span>
                  Signing in...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">login</span>
                  Sign In
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Don't have an account?{' '}
              <Link to="/register" className="text-primary font-semibold hover:underline">
                Register your family
              </Link>
            </p>
          </div>
        </div>

        {/* DEV MODE: Quick Login Panel */}
        {isDevMode && (
          <div className="mt-6 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 overflow-hidden">
            <div className="bg-amber-100 dark:bg-amber-900/40 px-4 py-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-600 dark:text-amber-400">developer_mode</span>
              <span className="text-sm font-bold text-amber-800 dark:text-amber-300">
                DEV MODE: Quick Login
              </span>
              <button
                onClick={loadFamilies}
                className="ml-auto text-amber-600 hover:text-amber-800 dark:text-amber-400"
                title="Refresh"
              >
                <span className="material-symbols-outlined text-lg">refresh</span>
              </button>
            </div>
            
            <div className="p-4">
              {loadingFamilies ? (
                <div className="flex items-center justify-center py-4 text-amber-600">
                  <span className="material-symbols-outlined animate-spin">progress_activity</span>
                  <span className="ml-2 text-sm">Loading families...</span>
                </div>
              ) : families.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                    No families in database yet
                  </p>
                  <Link
                    to="/register"
                    className="inline-flex items-center gap-1 text-sm font-semibold text-amber-800 dark:text-amber-200 hover:underline"
                  >
                    <span className="material-symbols-outlined text-lg">add</span>
                    Register first family
                  </Link>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {families.map((family) => (
                    <button
                      key={family.family_id}
                      onClick={() => handleQuickLogin(family.family_id)}
                      disabled={isLoading}
                      className="w-full text-left p-3 rounded-lg bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-700 hover:border-amber-400 transition-colors disabled:opacity-50"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-gray-600 dark:text-gray-400 truncate">
                          {family.family_id.substring(0, 8)}...
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusBadge(family.registration_status || 'draft')}`}>
                          {(family.registration_status || 'draft').replace('_', ' ')}
                        </span>
                      </div>
                      <div className="mt-1 font-semibold text-gray-900 dark:text-white">
                        Family {family.family_id.substring(0, 8)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Help Text */}
        <div className="mt-6 p-4 bg-primary/5 dark:bg-primary/10 rounded-lg border border-primary/20">
          <div className="flex gap-3">
            <span className="material-symbols-outlined text-primary shrink-0">info</span>
            <p className="text-xs text-primary/80 dark:text-primary/90 leading-relaxed">
              <strong>Development Mode:</strong> Login using Family ID (UUID). 
              No password required. Register a family first if none exist.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
