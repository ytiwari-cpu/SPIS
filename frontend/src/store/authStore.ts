import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { AuthSession, DbFamily, DbFamilyMember } from '@/types/database'

// ─── Cross-tab sync ────────────────────────────────────────────────────────
// BroadcastChannel lets every same-origin tab know about login/logout events
// without polling. Falls back gracefully (older browsers just skip it).
const authChannel = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('spis-auth')
  : null

interface AuthState {
  // State
  isAuthenticated: boolean
  session: AuthSession | null
  familyDetails: DbFamily | null
  headMember: DbFamilyMember | null
  isLoading: boolean
  error: string | null

  // Actions
  login: (session: AuthSession) => void
  setFamilyDetails: (family: DbFamily, headMember: DbFamilyMember | null) => void
  logout: () => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
  hasPermission: (permission: string) => boolean
  hasExplicitPermission: (permission: string) => boolean
  hasRole: (role: string) => boolean
  refreshPermissions: () => Promise<void>
  
  // Legacy compatibility - uuid for routing, family_id for display
  user: { uuid: string; family_id: string; name: string } | null
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      session: null,
      familyDetails: null,
      headMember: null,
      isLoading: false,
      error: null,
      user: null,

      // Login with session from API
      login: (session: AuthSession) => {
        set({
          isAuthenticated: true,
          session,
          error: null,
          user: {
            uuid: session.uuid || session.user_id || '',
            family_id: session.family_id || '',
            name: session.email || (session.family_id ? `Family ${session.family_id}` : 'User'),
          },
        })
        // Notify other tabs about the new login
        authChannel?.postMessage({ type: 'LOGIN' })
      },

      // Store additional family details after login
      setFamilyDetails: (family, headMember) => {
        const name = headMember 
          ? `${headMember.first_name} ${headMember.last_name}` 
          : `Family ${family.family_id}`
        set((state) => ({
          familyDetails: family,
          headMember,
          user: { uuid: family.uuid, family_id: family.family_id, name },
          // Also patch session.uuid so useFamilyUuid() always reflects the family
          session: state.session ? { ...state.session, uuid: family.uuid, family_id: family.family_id } : state.session,
        }))
      },

      // Logout - clear all auth state and notify other tabs
      logout: () => {
        set({
          isAuthenticated: false,
          session: null,
          familyDetails: null,
          headMember: null,
          error: null,
          user: null,
        })
        // Notify other tabs so they also log out
        authChannel?.postMessage({ type: 'LOGOUT' })
      },

      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error, isLoading: false }),
      clearError: () => set({ error: null }),

      // Permission & role checks
      hasPermission: (permission: string): boolean => {
        const session = get().session
        if (!session) return false
        // SuperAdmin has all permissions
        if (Array.isArray(session.roles) && session.roles.includes('SuperAdmin')) return true
        if (!session.permissions || !Array.isArray(session.permissions)) return false
        return session.permissions.includes(permission)
      },

      // Check permission strictly from the JWT — no SuperAdmin bypass.
      // Use this for permissions that must be explicitly granted (e.g. SYSTEM.EXPORT).
      hasExplicitPermission: (permission: string): boolean => {
        const session = get().session
        if (!session?.permissions || !Array.isArray(session.permissions)) return false
        return session.permissions.includes(permission)
      },

      hasRole: (role: string): boolean => {
        const roles = get().session?.roles || []
        return roles.includes(role)
      },

      // Refresh permissions from backend (for when roles/permissions change)
      refreshPermissions: async (): Promise<void> => {
        const currentSession = get().session
        if (!currentSession?.access_token) return

        try {
          const { getMyPermissions } = await import('@/services/rbacApi')
          const permissions = await getMyPermissions()
          
          // Update session with fresh permissions
          set({
            session: {
              ...currentSession,
              permissions,
            },
          })
        } catch (error) {
          console.error('Failed to refresh permissions:', error)
          // Don't throw - permissions might be stale but user can still function
        }
      },
    }),
    {
      name: 'spis-auth-storage',
      // localStorage is shared across all tabs in the same browser profile.
      // sessionStorage is tab-isolated and would require re-login on every new tab.
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        session: state.session,
        user: state.user,
      }),
    }
  )
)

// ─── Cross-tab sync listeners ──────────────────────────────────────────────
// Listen for LOGOUT broadcast from other tabs and clear local state.
if (authChannel) {
  authChannel.onmessage = (event) => {
    if (event.data?.type === 'LOGOUT') {
      // Another tab logged out — clear state here without re-broadcasting
      useAuthStore.setState({
        isAuthenticated: false,
        session: null,
        familyDetails: null,
        headMember: null,
        error: null,
        user: null,
      })
    }
    // LOGIN events are handled automatically because both tabs share the same
    // localStorage key — Zustand's persist middleware rehydrates on storage change.
  }
}

// Fallback: listen for storage events (covers BroadcastChannel-unsupported browsers)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === 'spis-auth-storage' && event.newValue) {
      try {
        const parsed = JSON.parse(event.newValue)
        if (parsed.state) {
          useAuthStore.setState(parsed.state)
        }
      } catch { /* ignore parse errors */ }
    }
    // Key was deleted (logout from another tab)
    if (event.key === 'spis-auth-storage' && event.newValue === null) {
      useAuthStore.setState({
        isAuthenticated: false,
        session: null,
        familyDetails: null,
        headMember: null,
        error: null,
        user: null,
      })
    }
  })
}

// Helper hook to get UUID from session (for API calls)
export const useFamilyUuid = (): string | null => {
  const session = useAuthStore((state: AuthState) => state.session)
  return session?.uuid || null
}

// Helper hook to get family_id from session (for display)
export const useFamilyId = (): string | null => {
  const session = useAuthStore((state: AuthState) => state.session)
  return session?.family_id || null
}


