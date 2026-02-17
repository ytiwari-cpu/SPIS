import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from './store/authStore'

// Clean up old localStorage keys (we now use sessionStorage)
if (typeof window !== 'undefined') {
  localStorage.removeItem('spis-auth')
  localStorage.removeItem('spis-auth-storage')
}

// Layouts
import PublicLayout from './layouts/PublicLayout'
import CitizenLayout from './layouts/CitizenLayout'

// Public Pages
import HomePage from './pages/public/HomePage'
import NoticesPage from './pages/public/NoticesPage'
import LoginPage from './pages/public/LoginPage'
import ResetPasswordPage from './pages/public/ResetPasswordPage'

// Registration Flow
import RegistrationWizard from './pages/registration/RegistrationWizard'

// Citizen Pages
import Dashboard from './pages/citizen/Dashboard'
import MemberProfile from './pages/citizen/MemberProfile'
import MyFamily from './pages/citizen/MyFamily'
import FamilyEdit from './pages/citizen/FamilyEdit'
import Documents from './pages/citizen/Documents'
import Benefits from './pages/citizen/Benefits'
import Programmes from './pages/citizen/Programmes'
import Grievances from './pages/citizen/Grievances'
import Settings from './pages/citizen/Settings'

// Admin Pages
import { AdminDashboard } from './pages/admin'

function App() {
  const { isAuthenticated, session, logout } = useAuthStore()

  // Validate session on mount - check if token exists and is not expired
  useEffect(() => {
    if (isAuthenticated && session) {
      // Check if access token exists
      if (!session.access_token) {
        console.warn('No access token found, logging out')
        logout()
        return
      }

      // Decode JWT to check expiration (without verification, just for expiry check)
      try {
        const payload = JSON.parse(atob(session.access_token.split('.')[1]))
        const expiresAt = payload.exp * 1000 // Convert to milliseconds
        const now = Date.now()
        
        if (now >= expiresAt) {
          console.warn('Session expired, logging out')
          logout()
        }
      } catch (error) {
        console.error('Error validating token:', error)
        logout()
      }
    }
  }, [isAuthenticated, session, logout])

  return (
    <Routes>
      {/* Public Routes */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/notices" element={<NoticesPage />} />
        <Route path="/notices/:id" element={<NoticesPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      {/* Family Registration (can be accessed before/after login) */}
      <Route path="/register" element={<RegistrationWizard />} />

      {/* Authenticated Citizen Routes */}
      <Route
        element={
          isAuthenticated ? (
            <CitizenLayout />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<MemberProfile />} />
        <Route path="/family" element={<MyFamily />} />
        <Route path="/family/edit" element={<FamilyEdit />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/benefits" element={<Benefits />} />
        <Route path="/programmes" element={<Programmes />} />
        <Route path="/grievances" element={<Grievances />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
