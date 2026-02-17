import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { authApi } from '@/services/familyApi'
import WorkerRegistrationModal from '@/components/WorkerRegistrationModal'

function normalizeNationalId(value: string): string {
  return value.replace(/\D/g, '')
}

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, isAuthenticated, setFamilyDetails } = useAuthStore()

  const [nationalId, setNationalId] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showWorkerRegistration, setShowWorkerRegistration] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard')
    }
  }, [isAuthenticated, navigate])

  const finalizeLogin = async (session: any) => {
    login(session)
    try {
      const meResponse = await authApi.getMe()
      if (meResponse.success && meResponse.data) {
        setFamilyDetails(meResponse.data, meResponse.data.head_member || null)
      }
    } catch {
      // No family record (e.g. SuperAdmin/Worker) — continue without family details
    }

    // Route based on role
    const roles = session.roles || []
    if (roles.includes('SuperAdmin') || roles.includes('Admin')) {
      navigate('/admin')
    } else {
      navigate('/dashboard')
    }
  }

  const handleNationalLogin = async () => {
    const cleanNationalId = normalizeNationalId(nationalId)
    if (cleanNationalId.length !== 14) {
      setError('National ID must be exactly 14 digits')
      return
    }
    if (!password) {
      setError('Password is required')
      return
    }

    setError('')
    setIsLoading(true)

    try {
      const response = await authApi.login({
        national_id: cleanNationalId,
        password,
      })

      if (response.success && response.data) {
        await finalizeLogin(response.data)
      } else {
        setError(response.error || 'Login failed')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      if (message.includes('401')) {
        setError('Invalid credentials. If you haven\'t set a password yet, use "Forgot password?" below.')
      } else if (message.includes('404')) {
        setError('User not found. Please register or reset your password first.')
      } else if (message.includes('403')) {
        setError('Account not activated. Please reset your password first.')
      } else {
        setError(`Login failed: ${message}`)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleNationalLogin()
  }

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center py-12 px-4 relative">
      {/* Worker Registration Button */}
      <button
        onClick={() => setShowWorkerRegistration(true)}
        className="absolute top-4 right-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-md"
      >
        <span className="material-symbols-outlined text-xl">person_add</span>
        <span className="hidden sm:inline">Worker Registration</span>
      </button>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="flex size-14 items-center justify-center rounded-xl bg-primary text-white">
              <span className="material-symbols-outlined text-3xl">account_balance</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Sign In
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Sign in with your National ID and password
          </p>
        </div>

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
                National ID
              </label>
              <input
                type="text"
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value)}
                placeholder="14-digit National ID"
                className="w-full h-12 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-gray-900 dark:text-white font-mono text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                className="w-full h-12 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-gray-900 dark:text-white text-sm"
                required
              />
              <div className="mt-2 text-right">
                <Link
                  to="/reset-password"
                  className="text-sm text-primary hover:text-primary-dark font-medium"
                >
                  Forgot password?
                </Link>
              </div>
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
              Don&apos;t have an account?{' '}
              <Link to="/register" className="text-primary font-semibold hover:underline">
                Register your family
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-6 p-4 bg-primary/5 dark:bg-primary/10 rounded-lg border border-primary/20">
          <div className="flex gap-3">
            <span className="material-symbols-outlined text-primary shrink-0">info</span>
            <p className="text-xs text-primary/80 dark:text-primary/90 leading-relaxed">
              First time? Register your family, then use "Forgot password?" to create your login credentials using the National ID linked to your registration.
            </p>
          </div>
        </div>
      </div>

      {/* Worker Registration Modal */}
      <WorkerRegistrationModal 
        isOpen={showWorkerRegistration} 
        onClose={() => setShowWorkerRegistration(false)} 
      />
    </div>
  )
}
