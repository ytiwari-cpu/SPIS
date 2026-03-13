import { useState } from 'react'
import { authApi } from '@/services/familyApi'
import { useAuthStore } from '@/store/authStore'
import { extractApiError } from '@/services/authFetch'

/**
 * Forced password-setup modal for first-time OTP logins.
 *
 * Shown automatically when a citizen's account was created from the
 * family_member registry and they logged in via OTP for the first time.
 *
 * There is deliberately NO close button — the modal can only be dismissed by
 * successfully submitting a password. This ensures every citizen account has
 * a password set before they start using the dashboard.
 */
export default function SetPasswordModal() {
  const { setNeedsPasswordSetup } = useAuthStore()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // ── Password strength ─────────────────────────────────────────────────────
  const getStrength = (pwd: string): { label: string; color: string; width: string } => {
    if (pwd.length === 0) return { label: '', color: '', width: '0%' }
    let score = 0
    if (pwd.length >= 8) score++
    if (pwd.length >= 12) score++
    if (/[A-Z]/.test(pwd)) score++
    if (/\d/.test(pwd)) score++
    if (/[^A-Za-z0-9]/.test(pwd)) score++
    if (score <= 1) return { label: 'Weak', color: 'bg-red-500', width: '25%' }
    if (score <= 2) return { label: 'Fair', color: 'bg-amber-500', width: '50%' }
    if (score <= 3) return { label: 'Good', color: 'bg-blue-500', width: '75%' }
    return { label: 'Strong', color: 'bg-green-500', width: '100%' }
  }

  const strength = getStrength(password)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsLoading(true)
    try {
      const res = await authApi.setInitialPassword(password)
      if (res.success) {
        setNeedsPasswordSetup(false)
      } else {
        setError(extractApiError(res.error, 'Failed to set password. Please try again.'))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    /* Backdrop — pointer-events-none on clicks so user cannot dismiss by clicking outside */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-md mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-primary px-6 py-5 text-white">
          <div className="flex items-center gap-3 mb-1">
            <span className="material-symbols-outlined text-3xl">lock_reset</span>
            <h2 className="text-xl font-bold">Set Your Password</h2>
          </div>
          <p className="text-primary-100 text-sm opacity-90">
            You logged in with a one-time code. Please set a password now to secure your account for future logins.
          </p>
        </div>

        {/* Notice — why no close button */}
        <div className="px-6 pt-4">
          <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-300">
            <span className="material-symbols-outlined text-base shrink-0 mt-0.5">info</span>
            <span>This step is required before you can use your dashboard. You can use your National ID + this password to log in next time.</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3 text-sm text-red-700 dark:text-red-400">
              <span className="material-symbols-outlined text-base shrink-0 mt-0.5">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* New password */}
          <div>
            <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              New Password
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full h-11 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 pr-10 focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-gray-900 dark:text-white text-sm"
                required
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                tabIndex={-1}
              >
                <span className="material-symbols-outlined text-lg">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>

            {/* Strength bar */}
            {password.length > 0 && (
              <div className="mt-2">
                <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
                    style={{ width: strength.width }}
                  />
                </div>
                <p className={`text-xs mt-1 font-medium ${
                  strength.label === 'Weak' ? 'text-red-500' :
                  strength.label === 'Fair' ? 'text-amber-500' :
                  strength.label === 'Good' ? 'text-blue-500' :
                  'text-green-500'
                }`}>
                  {strength.label}
                </p>
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Confirm Password
            </label>
            <input
              id="confirm-password"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat your password"
              className={`w-full h-11 rounded-lg border bg-white dark:bg-gray-800 px-4 focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-gray-900 dark:text-white text-sm ${
                confirmPassword && confirmPassword !== password
                  ? 'border-red-400 dark:border-red-500'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
              required
            />
            {confirmPassword && confirmPassword !== password && (
              <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
            )}
          </div>

          {/* Password requirements hint */}
          <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <li className={`flex items-center gap-1 ${password.length >= 8 ? 'text-green-600 dark:text-green-400' : ''}`}>
              <span className="material-symbols-outlined text-sm">{password.length >= 8 ? 'check_circle' : 'radio_button_unchecked'}</span>
              At least 8 characters
            </li>
            <li className={`flex items-center gap-1 ${/[A-Z]/.test(password) ? 'text-green-600 dark:text-green-400' : ''}`}>
              <span className="material-symbols-outlined text-sm">{/[A-Z]/.test(password) ? 'check_circle' : 'radio_button_unchecked'}</span>
              One uppercase letter (recommended)
            </li>
            <li className={`flex items-center gap-1 ${/\d/.test(password) ? 'text-green-600 dark:text-green-400' : ''}`}>
              <span className="material-symbols-outlined text-sm">{/\d/.test(password) ? 'check_circle' : 'radio_button_unchecked'}</span>
              One number (recommended)
            </li>
          </ul>

          <button
            type="submit"
            disabled={isLoading || password.length < 8 || password !== confirmPassword}
            className="w-full bg-primary text-white font-bold h-11 rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                Setting password…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-lg">lock</span>
                Set Password &amp; Continue
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
