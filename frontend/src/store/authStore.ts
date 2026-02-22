import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { AuthSession, DbFamily, DbFamilyMember } from '@/types/database'

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
  hasRole: (role: string) => boolean
  refreshPermissions: () => Promise<void>
  
  // Legacy compatibility - uuid for routing, family_id for display
  user: { uuid: string; family_id: string; name: string } | null
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state - NOT authenticated (no more mock data!)
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
      },

      // Store additional family details after login
      setFamilyDetails: (family, headMember) => {
        const name = headMember 
          ? `${headMember.first_name} ${headMember.last_name}` 
          : `Family ${family.family_id}`
        set({
          familyDetails: family,
          headMember,
          user: { uuid: family.uuid, family_id: family.family_id, name },
        })
      },

      // Logout - clear all auth state
      logout: () => {
        set({
          isAuthenticated: false,
          session: null,
          familyDetails: null,
          headMember: null,
          error: null,
          user: null,
        })
      },

      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error, isLoading: false }),
      clearError: () => set({ error: null }),

      // Permission & role checks
      hasPermission: (permission: string): boolean => {
        const session = get().session
        if (!session || !session.permissions) return false
        if (!Array.isArray(session.permissions)) return false
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
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        session: state.session,
        user: state.user,
      }),
    }
  )
)

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


