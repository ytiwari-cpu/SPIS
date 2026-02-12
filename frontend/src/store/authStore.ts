import { create } from 'zustand'
import { persist } from 'zustand/middleware'
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
  
  // Legacy compatibility - uuid for routing, family_id for display
  user: { uuid: string; family_id: string; name: string } | null
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // Initial state - NOT authenticated (no more mock data!)
      isAuthenticated: false,
      session: null,
      familyDetails: null,
      headMember: null,
      isLoading: false,
      error: null,
      user: null,

      // Login with session from API
      login: (session) => {
        localStorage.setItem('spis-auth', JSON.stringify(session))
        set({
          isAuthenticated: true,
          session,
          error: null,
          user: { 
            uuid: session.uuid, 
            family_id: session.family_id, 
            name: `Family ${session.family_id}` 
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
        localStorage.removeItem('spis-auth')
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
    }),
    {
      name: 'spis-auth-storage',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        session: state.session,
        user: state.user,
      }),
      // Migration: clear old sessions that don't have uuid
      onRehydrateStorage: () => (state) => {
        if (state?.session && !state.session.uuid) {
          console.warn('Session missing uuid, clearing old session format. Please log in again.')
          localStorage.removeItem('spis-auth')
          localStorage.removeItem('spis-auth-storage')
          state.isAuthenticated = false
          state.session = null
          state.user = null
        }
        if (state?.user && !state.user.uuid) {
          console.warn('User missing uuid, clearing old user format.')
          state.user = null
          state.isAuthenticated = false
        }
      },
    }
  )
)

// Helper hook to get UUID from session (for API calls)
export const useFamilyUuid = () => {
  const session = useAuthStore((state) => state.session)
  return session?.uuid || null
}

// Helper hook to get family_id from session (for display)
export const useFamilyId = () => {
  const session = useAuthStore((state) => state.session)
  return session?.family_id || null
}

// Helper hook to check if dev mode
export const useIsDevMode = () => {
  // @ts-expect-error - Vite injects import.meta.env
  return import.meta.env?.DEV || import.meta.env?.MODE === 'development' || true
}
