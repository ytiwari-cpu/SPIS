/**
 * Programme Store — Zustand state for Programme Admin Module
 */
import { create } from 'zustand'
import type {
    Programme,
    RuleVariable,
    RuleGroup,
    Beneficiary,
    CustomField,
    AuditLog,
} from '@/types/programme'
import * as api from '@/services/programmeApi'

interface ProgrammeState {
    // Data
    programmes: Programme[]
    selectedProgramme: Programme | null
    variables: RuleVariable[]
    ruleGroups: RuleGroup[]
    beneficiaries: Beneficiary[]
    customFields: CustomField[]
    auditLogs: AuditLog[]

    // UI
    loading: boolean
    error: string | null

    // Actions
    fetchProgrammes: () => Promise<void>
    fetchProgramme: (id: string) => Promise<void>
    fetchVariables: () => Promise<void>
    fetchRuleGroups: () => Promise<void>
    fetchBeneficiaries: (programmeId: string) => Promise<void>
    fetchCustomFields: () => Promise<void>
    fetchAuditLogs: (programmeId: string) => Promise<void>
    setSelectedProgramme: (p: Programme | null) => void
    clearError: () => void
}

export const useProgrammeStore = create<ProgrammeState>((set) => ({
    programmes: [],
    selectedProgramme: null,
    variables: [],
    ruleGroups: [],
    beneficiaries: [],
    customFields: [],
    auditLogs: [],
    loading: false,
    error: null,

    fetchProgrammes: async () => {
        set({ loading: true, error: null })
        try {
            const programmes = await api.getProgrammes()
            set({ programmes, loading: false })
        } catch (err) {
            set({ error: (err as Error).message, loading: false })
        }
    },

    fetchProgramme: async (id) => {
        set({ loading: true, error: null })
        try {
            const programme = await api.getProgramme(id)
            set({ selectedProgramme: programme, loading: false })
        } catch (err) {
            set({ error: (err as Error).message, loading: false })
        }
    },

    fetchVariables: async () => {
        try {
            const variables = await api.getVariables()
            set({ variables })
        } catch (err) {
            set({ error: (err as Error).message })
        }
    },

    fetchRuleGroups: async () => {
        try {
            const ruleGroups = await api.getRuleGroups()
            set({ ruleGroups })
        } catch (err) {
            set({ error: (err as Error).message })
        }
    },

    fetchBeneficiaries: async (programmeId) => {
        set({ loading: true, error: null })
        try {
            const beneficiaries = await api.getBeneficiaries(programmeId)
            set({ beneficiaries, loading: false })
        } catch (err) {
            set({ error: (err as Error).message, loading: false })
        }
    },

    fetchCustomFields: async () => {
        try {
            const customFields = await api.getCustomFields()
            set({ customFields })
        } catch (err) {
            set({ error: (err as Error).message })
        }
    },

    fetchAuditLogs: async (programmeId) => {
        try {
            const auditLogs = await api.getAuditLogs(programmeId)
            set({ auditLogs })
        } catch (err) {
            set({ error: (err as Error).message })
        }
    },

    setSelectedProgramme: (p) => set({ selectedProgramme: p }),
    clearError: () => set({ error: null }),
}))
