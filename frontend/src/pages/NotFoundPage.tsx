import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

export default function NotFoundPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [countdown, setCountdown] = useState(3)
  const timerRef = useRef<NodeJS.Timeout>()
  const redirectRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    // Countdown timer
    timerRef.current = setInterval(() => {
      setCountdown((prev) => prev - 1)
    }, 1000)

    // Redirect after 3 seconds
    redirectRef.current = setTimeout(() => {
      navigate('/dashboard', { replace: true })
    }, 3000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (redirectRef.current) clearTimeout(redirectRef.current)
    }
  }, [navigate])

  const handleGoToDashboard = () => {
    // Clean up timers before navigating
    if (timerRef.current) clearInterval(timerRef.current)
    if (redirectRef.current) clearTimeout(redirectRef.current)
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center">
        <div className="bg-orange-50 dark:bg-orange-900/10 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-6xl text-orange-500">error_outline</span>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
          Page Not Found
        </h1>
        
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          The page you're looking for doesn't exist or you don't have access to it.
        </p>
        
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mb-6">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Requested Route:</p>
          <code className="text-sm text-gray-900 dark:text-white font-mono break-all">
            {location.pathname}
          </code>
        </div>
        
        <div className="mb-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Redirecting to dashboard in <span className="font-bold text-primary">{countdown}</span> second{countdown !== 1 ? 's' : ''}...
          </p>
        </div>
        
        <button
          onClick={handleGoToDashboard}
          className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
        >
          Go to Dashboard Now
        </button>
      </div>
    </div>
  )
}
