import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { requestPasswordReset, confirmPasswordReset } from '@/services/iamApi'

export default function ResetPasswordPage() {
  const navigate = useNavigate()

  // Step 1: Request OTP
  const [nationalId, setNationalId] = useState('')
  const [isRequestingOtp, setIsRequestingOtp] = useState(false)
  const [requestError, setRequestError] = useState('')

  // Step 2: Verify OTP and set password
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isConfirming, setIsConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const normalizeNationalId = (value: string): string => {
    return value.replace(/\D/g, '')
  }

  const handleRequestOtp = async (e: FormEvent) => {
    e.preventDefault()

    const cleanNationalId = normalizeNationalId(nationalId)
    if (cleanNationalId.length !== 14) {
      setRequestError('National ID must be exactly 14 digits')
      return
    }

    setRequestError('')
    setIsRequestingOtp(true)

    try {
      await requestPasswordReset(cleanNationalId)
      setOtpSent(true)
      setRequestError('')
    } catch (err: any) {
      // Handle both string and object errors
      const error = err.response?.data?.error || err.message || 'Failed to send OTP'
      const errorMessage = typeof error === 'object' ? error.message || JSON.stringify(error) : error
      setRequestError(errorMessage)
    } finally {
      setIsRequestingOtp(false)
    }
  }

  const handleConfirmReset = async (e: FormEvent) => {
    e.preventDefault()

    // Validate OTP
    if (otp?.length !== 6) {
      setConfirmError('Please enter a valid 6-digit OTP')
      return
    }

    // Validate password
    if (newPassword.length < 8) {
      setConfirmError('Password must be at least 8 characters')
      return
    }

    if (newPassword !== confirmPassword) {
      setConfirmError('Passwords do not match')
      return
    }

    setConfirmError('')
    setIsConfirming(true)

    try {
      const response = await confirmPasswordReset(
        normalizeNationalId(nationalId),
        otp,
        newPassword,
      )
      setSuccessMessage(response.message || 'Password reset successfully!')
      setConfirmError('')

      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/login')
      }, 2000)
    } catch (err: any) {
      // Handle both string and object errors
      const error = err.response?.data?.error || err.message || 'Failed to reset password'
      const errorMessage = typeof error === 'object' ? error.message || JSON.stringify(error) : error
      setConfirmError(errorMessage)
    } finally {
      setIsConfirming(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Reset Password</h1>
          <p className="text-gray-600">
            {otpSent
              ? 'Enter the OTP sent to your registered email'
              : 'Enter your National ID to receive an OTP'}
          </p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 text-sm font-medium">{successMessage}</p>
            <p className="text-green-600 text-xs mt-1">Redirecting to login...</p>
          </div>
        )}

        {/* Step 1: Request OTP */}
        {!otpSent && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <form onSubmit={handleRequestOtp} className="space-y-6">
              {/* National ID Input */}
              <div>
                <label htmlFor="nationalId" className="block text-sm font-medium text-gray-700 mb-2">
                  National ID
                </label>
                <input
                  type="text"
                  id="nationalId"
                  value={nationalId}
                  onChange={(e) => setNationalId(e.target.value)}
                  placeholder="12345678901234"
                  maxLength={14}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isRequestingOtp}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">14-digit National ID</p>
              </div>

              {/* Error Message */}
              {requestError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 text-sm">{requestError}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isRequestingOtp}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isRequestingOtp ? 'Sending OTP...' : 'Send OTP'}
              </button>
            </form>

            {/* Back to Login */}
            <div className="mt-6 text-center">
              <Link to="/login" className="text-sm text-blue-600 hover:text-blue-700">
                ← Back to Login
              </Link>
            </div>
          </div>
        )}

        {/* Step 2: Verify OTP and Set Password */}
        {otpSent && !successMessage && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <form onSubmit={handleConfirmReset} className="space-y-6">
              {/* OTP Input */}
              <div>
                <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-2">
                  OTP Code
                </label>
                <input
                  type="text"
                  id="otp"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  maxLength={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl tracking-wider font-mono"
                  disabled={isConfirming}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">6-digit code sent to your email</p>
              </div>

              {/* New Password Input */}
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isConfirming}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Minimum 8 characters</p>
              </div>

              {/* Confirm Password Input */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isConfirming}
                  required
                />
              </div>

              {/* Error Message */}
              {confirmError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 text-sm">{confirmError}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isConfirming}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isConfirming ? 'Resetting Password...' : 'Reset Password'}
              </button>
            </form>

            {/* Resend OTP */}
            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setOtpSent(false)
                  setOtp('')
                  setNewPassword('')
                  setConfirmPassword('')
                  setConfirmError('')
                }}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Didn't receive OTP? Try again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
