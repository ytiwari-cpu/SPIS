import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'

// Layouts
import PublicLayout from './layouts/PublicLayout'
import CitizenLayout from './layouts/CitizenLayout'

// Public Pages
import HomePage from './pages/public/HomePage'
import NoticesPage from './pages/public/NoticesPage'
import LoginPage from './pages/public/LoginPage'

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

function App() {
  const { isAuthenticated, user } = useAuthStore()

  return (
    <Routes>
      {/* Public Routes */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/notices" element={<NoticesPage />} />
        <Route path="/notices/:id" element={<NoticesPage />} />
        <Route path="/login" element={<LoginPage />} />
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
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
