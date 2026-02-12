import { create } from 'zustand'
import type {
  Family,
  FamilyMember,
  Address,
  Document,
  DashboardSummary,
} from '@/types'

interface FamilyState {
  // Data
  family: Family | null
  members: FamilyMember[]
  address: Address | null
  documents: Document[]
  dashboardSummary: DashboardSummary | null

  // Loading states
  isLoading: boolean
  isSubmitting: boolean

  // Actions
  setFamily: (family: Family) => void
  setMembers: (members: FamilyMember[]) => void
  addMember: (member: FamilyMember) => void
  updateMember: (id: string, updates: Partial<FamilyMember>) => void
  removeMember: (id: string) => void
  setAddress: (address: Address) => void
  setDocuments: (documents: Document[]) => void
  addDocument: (document: Document) => void
  setDashboardSummary: (summary: DashboardSummary) => void
  setLoading: (isLoading: boolean) => void
  setSubmitting: (isSubmitting: boolean) => void
  reset: () => void
}

const initialState = {
  family: null,
  members: [],
  address: null,
  documents: [],
  dashboardSummary: null,
  isLoading: false,
  isSubmitting: false,
}

export const useFamilyStore = create<FamilyState>((set) => ({
  ...initialState,

  setFamily: (family) => set({ family }),

  setMembers: (members) => set({ members }),

  addMember: (member) =>
    set((state) => ({
      members: [...state.members, member],
    })),

  updateMember: (id, updates) =>
    set((state) => ({
      members: state.members.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      ),
    })),

  removeMember: (id) =>
    set((state) => ({
      members: state.members.filter((m) => m.id !== id),
    })),

  setAddress: (address) => set({ address }),

  setDocuments: (documents) => set({ documents }),

  addDocument: (document) =>
    set((state) => ({
      documents: [...state.documents, document],
    })),

  setDashboardSummary: (dashboardSummary) => set({ dashboardSummary }),

  setLoading: (isLoading) => set({ isLoading }),

  setSubmitting: (isSubmitting) => set({ isSubmitting }),

  reset: () => set(initialState),
}))
