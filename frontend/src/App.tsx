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
import AppLayout from './layouts/AppLayout'

// Guard
import PermissionGuard from './components/PermissionGuard'

// Public Pages
import HomePage from './pages/public/HomePage'
import NoticesPage from './pages/public/NoticesPage'
import LoginPage from './pages/public/LoginPage'
import ResetPasswordPage from './pages/public/ResetPasswordPage'
import NotFoundPage from './pages/NotFoundPage'

// Registration Flow
import RegistrationWizard from './pages/registration/RegistrationWizard'

// Smart Dashboard (picks admin vs citizen view)
import SmartDashboard from './pages/SmartDashboard'

// Citizen Pages
import MemberProfile from './pages/citizen/MemberProfile'
import MyFamily from './pages/citizen/MyFamily'
import FamilyEdit from './pages/citizen/FamilyEdit'
import Documents from './pages/citizen/Documents'
import Benefits from './pages/citizen/Benefits'
import Settings from './pages/citizen/Settings'

// Common Components (role-based view switchers)
import ProgrammesView from './components/common/ProgrammesView'
import GrievancesView from './components/common/GrievancesView'

// Admin Pages
import { AdminUsers } from './pages/admin'
import {
  AdminOverview,
  AdminFamilies,
  AdminGrievances,
  AdminAppeals,
  AdminAdmins,
  AdminArchived,
  AdminAuditLogs,
  AdminRoleManagement,
  AdminRoles,
  AdminRoleForm,
  AdminCaseWorkers,
  AdminCaseWorkerDetail,
} from './pages/superadmin'

// Programme Admin Pages

import ProgrammesPage from './pages/programme-admin/ProgrammesPage'
import RuleGroupsPage from './pages/programme-admin/RuleGroupsPage'
import VariablesPage from './pages/programme-admin/VariablesPage'
import BeneficiariesPage from './pages/programme-admin/BeneficiariesPage'
import ManagersPage from './pages/programme-admin/ManagersPage'
import PaymentsPage from './pages/programme-admin/PaymentsPage'
import ReportsPage from './pages/programme-admin/ReportsPage'
import ProgrammeAuditLogsPage from './pages/programme-admin/AuditLogsPage'

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
          const raw = sessionStorage.getItem('spis-auth-storage')
          if (!raw) return
          const stored = JSON.parse(raw)
          const accessToken = stored.state?.session?.access_token
          if (!accessToken) return

          const response = await fetch('http://localhost:3001/api/v1/families', {
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

      validateServerSide()
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
        {/* Dashboard — always accessible, picks correct view by role */}
        <Route path="/dashboard" element={<SmartDashboard />} />

        {/* Citizen pages — guarded by CITIZEN.* permissions */}
        <Route path="/profile" element={<PermissionGuard permission="CITIZEN.PROFILE.VIEW"><MemberProfile /></PermissionGuard>} />
        <Route path="/family" element={<PermissionGuard permission="CITIZEN.FAMILY.VIEW"><MyFamily /></PermissionGuard>} />
        <Route path="/family/edit" element={<PermissionGuard permission="CITIZEN.FAMILY.EDIT"><FamilyEdit /></PermissionGuard>} />
        <Route path="/documents" element={<PermissionGuard permission="CITIZEN.DOCUMENTS.VIEW"><Documents /></PermissionGuard>} />
        <Route path="/benefits" element={<PermissionGuard permission="CITIZEN.BENEFITS.VIEW"><Benefits /></PermissionGuard>} />
        <Route path="/programmes" element={<PermissionGuard permission="CITIZEN.PROGRAMMES.VIEW"><ProgrammesView /></PermissionGuard>} />
        <Route path="/grievances" element={<GrievancesView />} />
        <Route path="/settings" element={<Settings />} />

        {/* Admin pages — guarded by ADMIN.* permissions */}
        <Route path="/admin/overview" element={<PermissionGuard permission="ADMIN.OVERVIEW.VIEW"><AdminOverview /></PermissionGuard>} />
        <Route path="/admin/families" element={<PermissionGuard permission="ADMIN.FAMILIES.VIEW"><AdminFamilies /></PermissionGuard>} />
        <Route path="/admin/grievances" element={<PermissionGuard permission="ADMIN.GRIEVANCES.VIEW"><AdminGrievances /></PermissionGuard>} />
        <Route path="/admin/appeals" element={<PermissionGuard permission="ADMIN.APPEALS.VIEW"><AdminAppeals /></PermissionGuard>} />
        <Route path="/admin/users" element={<PermissionGuard permission="ADMIN.USERS.VIEW"><AdminUsers /></PermissionGuard>} />
        <Route path="/admin/admin-access" element={<PermissionGuard permission="ADMIN.ACCESS.VIEW"><AdminAdmins /></PermissionGuard>} />
        <Route path="/admin/archived" element={<PermissionGuard permission="ADMIN.ARCHIVED.VIEW"><AdminArchived /></PermissionGuard>} />
        <Route path="/admin/audit-logs" element={<PermissionGuard permission="ADMIN.AUDITLOGS.VIEW"><AdminAuditLogs /></PermissionGuard>} />
        <Route path="/admin/roles" element={<PermissionGuard permission="ADMIN.ROLES.VIEW"><AdminRoles /></PermissionGuard>} />
        <Route path="/admin/roles/new" element={<PermissionGuard permission="ADMIN.ROLES.CREATE"><AdminRoleForm /></PermissionGuard>} />
        <Route path="/admin/roles/:roleName/view" element={<PermissionGuard permission="ADMIN.ROLES.VIEW"><AdminRoleForm /></PermissionGuard>} />
        <Route path="/admin/roles/:roleName/edit" element={<PermissionGuard permission="ADMIN.ROLES.EDIT"><AdminRoleForm /></PermissionGuard>} />
        <Route path="/admin/roles-management" element={<PermissionGuard permission="ADMIN.ROLES.MANAGE_PERMISSIONS"><AdminRoleManagement /></PermissionGuard>} />
        <Route path="/admin/case-workers" element={<PermissionGuard permission="ADMIN.CASEWORKERS.VIEW"><AdminCaseWorkers /></PermissionGuard>} />
        <Route path="/admin/case-workers/:workerId" element={<PermissionGuard permission="ADMIN.CASEWORKERS.VIEW"><AdminCaseWorkerDetail /></PermissionGuard>} />

        {/* Programme Admin Module */}
        <Route path="/programme-admin/programmes" element={<PermissionGuard permission="ADMIN.PROGRAMMES.VIEW"><ProgrammesPage /></PermissionGuard>} />
        <Route path="/programme-admin/programmes/:programmeId" element={<PermissionGuard permission="ADMIN.PROGRAMMES.VIEW"><ProgrammesPage /></PermissionGuard>} />
        <Route path="/programme-admin/rule-groups" element={<PermissionGuard permission="ADMIN.PROGRAMMES.VIEW"><RuleGroupsPage /></PermissionGuard>} />
        <Route path="/programme-admin/variables" element={<PermissionGuard permission="ADMIN.PROGRAMMES.VIEW"><VariablesPage /></PermissionGuard>} />
        <Route path="/programme-admin/beneficiaries" element={<PermissionGuard permission="ADMIN.PROGRAMMES.VIEW"><BeneficiariesPage /></PermissionGuard>} />
        <Route path="/programme-admin/payments" element={<PermissionGuard permission="ADMIN.PROGRAMMES.VIEW"><PaymentsPage /></PermissionGuard>} />
        <Route path="/programme-admin/reports" element={<PermissionGuard permission="ADMIN.PROGRAMMES.VIEW"><ReportsPage /></PermissionGuard>} />
        <Route path="/programme-admin/audit-logs" element={<PermissionGuard permission="ADMIN.PROGRAMMES.VIEW"><ProgrammeAuditLogsPage /></PermissionGuard>} />
        <Route path="/programme-admin/managers" element={<PermissionGuard permission="ADMIN.PROGRAMMES.VIEW"><ManagersPage /></PermissionGuard>} />

        {/* Catch-all for authenticated users - show 404 with auto-redirect */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* Unauthenticated users on unknown routes go to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
