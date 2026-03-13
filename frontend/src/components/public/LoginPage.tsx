import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { authApi } from '@/services/familyApi'
import { extractApiError } from '@/services/authFetch'
import WorkerRegistrationModal from '@/components/WorkerRegistrationModal'

function normalizeNationalId(value: string): string {
  return value.replace(/\D/g, '')
}

export default function LoginPageContent() {
  const navigate = useNavigate()
  const { login, isAuthenticated, setFamilyDetails, setNeedsPasswordSetup } = useAuthStore()

  const [loginMode, setLoginMode] = useState<'password' | 'otp'>('password')
  const [nationalId, setNationalId] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [_otpId, setOtpId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showWorkerRegistration, setShowWorkerRegistration] = useState(false)

  // Prevent the useEffect redirect from firing during an active login flow
  const loginInProgress = useRef(false)

  // Already-authenticated users visiting /login are redirected to /dashboard
  useEffect(() => {
    if (isAuthenticated && !loginInProgress.current) {
      navigate('/dashboard')
    }
  }, [isAuthenticated, navigate])

  const finalizeLogin = async (sessionData: any) => {
    loginInProgress.current = true
    
    console.log('[LoginPage] Received session data:', {
      hasPermissions: !!sessionData.permissions,
      permissionsIsArray: Array.isArray(sessionData.permissions),
      permissionsLength: sessionData.permissions?.length || 0,
      roles: sessionData.roles,
      keys: Object.keys(sessionData),
    })
    
    login(sessionData)

    // If this is a brand-new citizen (first OTP login from family_member),
    // mark that they need to set a password — the Dashboard will show a forced modal.
    if (sessionData.is_new_user) {
      setNeedsPasswordSetup(true)
    }

    // Only fetch family details for users with CITIZEN permissions
    // Staff users (ADMIN.* only) don't have attached families
    const perms = sessionData.permissions || []
    const hasCitizenPerms = perms.some((p: string) => p.startsWith('CITIZEN.'))

    if (hasCitizenPerms && sessionData.uuid) {
      try {
        const meResponse = await authApi.getMe()
        if (meResponse.success && meResponse.data) {
          setFamilyDetails(meResponse.data, meResponse.data.head_member || null)
        }
      } catch {
        // No family record — continue without family details
      }
    }

    loginInProgress.current = false

    // Always go to /dashboard — SmartDashboard picks the right view
    navigate('/dashboard')
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
        setError(extractApiError(response.error, 'Login failed'))
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

  const handleRequestOtp = async () => {
    const cleanNationalId = normalizeNationalId(nationalId)
    if (cleanNationalId.length !== 14) {
      setError('National ID must be exactly 14 digits')
      return
    }

    setError('')
    setIsLoading(true)

    try {
      const response = await authApi.requestOtpLogin(cleanNationalId)

      if (response.success && response.data) {
        setOtpSent(true)
        setOtpId(response.data.otp_id)
        setError('')
      } else {
        setError(extractApiError(response.error, 'Failed to send OTP'))
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      if (message.includes('404')) {
        setError('National ID not found in system')
      } else if (message.includes('409')) {
        setError('No email registered for this National ID')
      } else {
        setError(`Failed to send OTP: ${message}`)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    const cleanNationalId = normalizeNationalId(nationalId)
    if (cleanNationalId.length !== 14) {
      setError('National ID must be exactly 14 digits')
      return
    }
    if (!otp || otp.length !== 6) {
      setError('OTP must be 6 digits')
      return
    }

    setError('')
    setIsLoading(true)

    try {
      const response = await authApi.verifyOtpLogin({
        national_id: cleanNationalId,
        otp,
      })

      if (response.success && response.data) {
        await finalizeLogin(response.data)
      } else {
        setError(extractApiError(response.error, 'OTP verification failed'))
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      if (message.includes('400')) {
        setError('Invalid OTP code. Please try again.')
      } else if (message.includes('429')) {
        setError('Too many attempts. Please request a new OTP.')
      } else {
        setError(`OTP verification failed: ${message}`)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (loginMode === 'password') {
      handleNationalLogin()
    } else if (!otpSent) {
      handleRequestOtp()
    } else {
      handleVerifyOtp()
    }
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
          {/* Login Mode Toggle */}
          <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg mb-6">
            <button
              type="button"
              onClick={() => {
                setLoginMode('password')
                setOtpSent(false)
                setOtp('')
                setError('')
              }}
              className={`flex-1 py-2 px-4 rounded-md font-medium transition-all ${loginMode === 'password'
                ? 'bg-white dark:bg-gray-700 text-primary shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
            >
              <span className="flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-lg">lock</span>
                Password
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMode('otp')
                setPassword('')
                setOtpSent(false)
                setOtp('')
                setError('')
              }}
              className={`flex-1 py-2 px-4 rounded-md font-medium transition-all ${loginMode === 'otp'
                ? 'bg-white dark:bg-gray-700 text-primary shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
            >
              <span className="flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-lg">mail</span>
                OTP
              </span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg flex items-start gap-2">
                <span className="material-symbols-outlined text-lg shrink-0">error</span>
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="nationalId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                National ID
              </label>
              <input
                id="nationalId"
                type="text"
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value)}
                placeholder="14-digit National ID"
                disabled={otpSent}
                className="w-full h-12 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-gray-900 dark:text-white font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                required
              />
            </div>

            {loginMode === 'password' ? (
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Password
                </label>
                <input
                  id="password"
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
            ) : otpSent ? (
              <div>
                <label htmlFor="otp" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  OTP Code
                </label>
                <input
                  id="otp"
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit OTP"
                  maxLength={6}
                  className="w-full h-12 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-gray-900 dark:text-white font-mono text-2xl text-center tracking-widest"
                  required
                />
                <div className="mt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setOtpSent(false)
                      setOtp('')
                      setError('')
                    }}
                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                  >
                    ← Change National ID
                  </button>
                  <button
                    type="button"
                    onClick={handleRequestOtp}
                    disabled={isLoading}
                    className="text-sm text-primary hover:text-primary-dark font-medium disabled:opacity-50"
                  >
                    Resend OTP
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <p className="text-sm text-blue-900 dark:text-blue-200 flex items-start gap-2">
                  <span className="material-symbols-outlined text-lg shrink-0">info</span>
                  <span>
                    An OTP will be sent to your registered email address. Click "Send OTP" to continue.
                  </span>
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary text-white font-bold h-12 rounded-lg hover:bg-primary-dark transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <span className="material-symbols-outlined animate-spin">progress_activity</span>
                  {' '}
                  {loginMode === 'otp' && otpSent ? 'Verifying...' : loginMode === 'otp' ? 'Sending OTP...' : 'Signing in...'}
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">
                    {loginMode === 'otp' && !otpSent ? 'mail' : 'login'}
                  </span>
                  {' '}
                  {loginMode === 'otp' && !otpSent ? 'Send OTP' : loginMode === 'otp' ? 'Verify & Sign In' : 'Sign In'}
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
      </div>

      {/* Worker Registration Modal */}
      <WorkerRegistrationModal
        isOpen={showWorkerRegistration}
        onClose={() => setShowWorkerRegistration(false)}
      />
    </div>
  )
}
