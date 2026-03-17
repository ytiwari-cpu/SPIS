import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from './store/authStore'

// Migrate any leftover sessionStorage auth key to localStorage (one-time migration)\nif (typeof window !== 'undefined') {\n  const oldSession = sessionStorage.getItem('spis-auth-storage')\n  if (oldSession && !localStorage.getItem('spis-auth-storage')) {\n    localStorage.setItem('spis-auth-storage', oldSession)\n  }\n  sessionStorage.removeItem('spis-auth-storage')\n}

// Layouts
import PublicLayout from './layouts/PublicLayout'
import AppLayout from './layouts/AppLayout'

// Guard + route config
import PermissionGuard from './components/PermissionGuard'
import { authenticatedRoutes } from './config/routeConfig'

// Public Pages
import HomePage from './pages/public/HomePage'
import NoticesPage from './pages/public/NoticesPage'
import LoginPage from './pages/public/LoginPage'
import ResetPasswordPage from './pages/public/ResetPasswordPage'

// Registration Flow
import RegistrationWizard from './pages/registration/RegistrationWizard'

function App() {
  const { isAuthenticated, session, logout } = useAuthStore()

  // Validate session on mount - check if token exists, is not expired,
  // and is still accepted by the server (handles server restarts)
  useEffect(() => {
    if (isAuthenticated && session) {
      if (!session.access_token) {
        console.warn('No access token found, logging out')
        logout()
        return
      }

      // JWTs use base64url encoding — convert to standard base64 first
      try {
        const b64 = session.access_token.split('.')[1]
          .replace(/-/g, '+').replace(/_/g, '/')
        const payload = JSON.parse(atob(b64))
        const expiresAt = payload.exp * 1000
        if (Date.now() >= expiresAt) {
          console.warn('Session expired, logging out')
          logout()
          return
        }
      } catch (error) {
        console.error('Error validating token:', error)
        logout()
        return
      }

      // Server-side validation: call a protected endpoint to check if
      // the token is still accepted (catches server restarts which
      // invalidate all tokens issued before the restart)
      const validateServerSide = async () => {
        try {
          const raw = localStorage.getItem('spis-auth-storage')
          if (!raw) return
          const stored = JSON.parse(raw)
          const accessToken = stored.state?.session?.access_token
          if (!accessToken) return

          const response = await fetch('http://localhost:3001/api/v1/auth/me', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          })

          if (response.status === 401) {
            console.warn('Server rejected token (likely restarted), logging out')
            logout()
          }
        } catch {
          // Network error — server may be down, don't force logout
        }
      }

      // validateServerSide()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Routes>
      {/* ── Public Routes ─────────────────────────────────────────── */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/notices" element={<NoticesPage />} />
        <Route path="/notices/:id" element={<NoticesPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      {/* Family Registration (before or after login) */}
      <Route path="/register" element={<RegistrationWizard />} />

      {/* ── Authenticated Routes — single unified layout ──────────── */}
      <Route
        element={
          isAuthenticated ? <AppLayout /> : <Navigate to="/login" replace />
        }
      >
        {authenticatedRoutes.map(({ path, component: Page, permission }) => (
          <Route
            key={path}
            path={path}
            element={
              permission ? (
                <PermissionGuard permission={permission}>
                  <Page />
                </PermissionGuard>
              ) : (
                <Page />
              )
            }
          />
        ))}
      </Route>

      {/* Unauthenticated users on unknown routes go to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
