/**
 * Programme API Service
 * All API calls to the programme-service backend
 */
import type {
    Programme,
    RuleVariable,
    RuleGroup,
    RuleGroupRule,
    ProgrammeRule,
    Beneficiary,
    BeneficiaryWithProgramme,
    CustomField,
    EvaluationResult,
    ImpactAnalysis,
    AuditLog,
    RulesTreeNode,
    ProgrammeManagerLink,
} from '@/types/programme'

const PROGRAMME_API = 'http://localhost:3004/api/v1'

function getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    try {
        const raw = localStorage.getItem('spis-auth-storage')
        if (raw) {
            const stored = JSON.parse(raw)
            const token = stored.state?.session?.access_token
            if (token) headers['Authorization'] = `Bearer ${token}`
        }
    } catch { /* ignore */ }
    return headers
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${PROGRAMME_API}${path}`
    const res = await fetch(url, {
        ...init,
        headers: { ...getAuthHeaders(), ...(init?.headers || {}) },
    })

    if (res.status === 401 && !globalThis.location.pathname.includes('/login')) {
        localStorage.removeItem('spis-auth-storage')
        globalThis.location.href = '/login'
    }

    const json = await res.json()
    const errMsg = (typeof json.error === 'string' ? json.error : json.error?.message) || json.message || 'API Error'
    if (!res.ok) throw new Error(errMsg)
    return json.data as T
}

// ─── Programmes ───────────────────────────────────────────────────────────────
export const getProgrammes = () => apiFetch<Programme[]>('/programmes')
export const getProgramme = (id: string) => apiFetch<Programme>(`/programmes/${id}`)
export const createProgramme = (body: Record<string, unknown>) =>
    apiFetch<Programme>('/programmes', { method: 'POST', body: JSON.stringify(body) })
export const updateProgramme = (id: string, body: Record<string, unknown>) =>
    apiFetch<Programme>(`/programmes/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
export const deleteProgramme = (id: string) =>
    apiFetch<void>(`/programmes/${id}`, { method: 'DELETE' })
export const activateProgramme = (id: string) =>
    apiFetch<Programme>(`/programmes/${id}/activate`, { method: 'PATCH' })
export const saveRulesTree = (id: string, rules_tree: RulesTreeNode) =>
    apiFetch<Programme>(`/programmes/${id}/rules-tree`, {
        method: 'PATCH', body: JSON.stringify({ rules_tree }),
    })

// ─── Variables ────────────────────────────────────────────────────────────────
export const getVariables = () => apiFetch<RuleVariable[]>('/variables')
export const getVariablesGrouped = () => apiFetch<Record<string, RuleVariable[]>>('/variables/grouped')
export const refreshVariables = () =>
    apiFetch<RuleVariable[]>('/variables/refresh', { method: 'POST' })

// ─── Rule Groups ──────────────────────────────────────────────────────────────
export const getRuleGroups = () => apiFetch<RuleGroup[]>('/rule-groups')
export const getRuleGroup = (id: string) => apiFetch<RuleGroup>(`/rule-groups/${id}`)
export const createRuleGroup = (body: Record<string, unknown>) =>
    apiFetch<RuleGroup>('/rule-groups', { method: 'POST', body: JSON.stringify(body) })
export const updateRuleGroup = (id: string, body: Record<string, unknown>) =>
    apiFetch<RuleGroup>(`/rule-groups/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
export const deleteRuleGroup = (id: string) =>
    apiFetch<void>(`/rule-groups/${id}`, { method: 'DELETE' })
export const addRuleGroupRule = (groupId: string, body: Record<string, unknown>) =>
    apiFetch<RuleGroupRule>(`/rule-groups/${groupId}/rules`, { method: 'POST', body: JSON.stringify(body) })
export const removeRuleGroupRule = (groupId: string, ruleId: string) =>
    apiFetch<void>(`/rule-groups/${groupId}/rules/${ruleId}`, { method: 'DELETE' })

// ─── Programme Rules ──────────────────────────────────────────────────────────
export const getProgrammeRules = (programmeId: string) =>
    apiFetch<ProgrammeRule[]>(`/rules/programme/${programmeId}`)
export const addProgrammeRule = (programmeId: string, body: Record<string, unknown>) =>
    apiFetch<ProgrammeRule>(`/rules/programme/${programmeId}`, { method: 'POST', body: JSON.stringify(body) })
export const removeProgrammeRule = (programmeId: string, ruleId: string) =>
    apiFetch<void>(`/rules/programme/${programmeId}/${ruleId}`, { method: 'DELETE' })

// ─── Beneficiaries ────────────────────────────────────────────────────────────
export const getBeneficiaries = (programmeId: string) =>
    apiFetch<Beneficiary[]>(`/beneficiaries/${programmeId}`)
// Returns all beneficiary records for a given subject (family or individual UUID)
export const getSubjectEnrollments = (subjectId: string) =>
    apiFetch<BeneficiaryWithProgramme[]>(`/beneficiaries/subject/${subjectId}`)
export const enrollBeneficiary = (programmeId: string, body: Record<string, unknown>) =>
    apiFetch<Beneficiary>(`/beneficiaries/${programmeId}`, { method: 'POST', body: JSON.stringify(body) })
export const updateBeneficiaryStatus = (programmeId: string, subjectId: string, body: Record<string, unknown>) =>
    apiFetch<Beneficiary>(`/beneficiaries/${programmeId}/${subjectId}/status`, { method: 'PATCH', body: JSON.stringify(body) })

// ─── Engine ───────────────────────────────────────────────────────────────────
export const evaluateSubject = (programmeId: string, body: Record<string, unknown>) =>
    apiFetch<EvaluationResult>(`/engine/evaluate/${programmeId}`, { method: 'POST', body: JSON.stringify(body) })
export const evaluateAll = (programmeId: string) =>
    apiFetch<{ total_evaluated: number; eligible: number; ineligible: number; results: EvaluationResult[] }>(
        `/engine/evaluate-all/${programmeId}`, { method: 'POST' })
export const getImpactAnalysis = (programmeId: string) =>
    apiFetch<ImpactAnalysis>(`/engine/impact/${programmeId}`)

// ─── Custom Fields ────────────────────────────────────────────────────────────
export const getCustomFields = () => apiFetch<CustomField[]>('/custom-fields')
export const createCustomField = (body: Record<string, unknown>) =>
    apiFetch<CustomField>('/custom-fields', { method: 'POST', body: JSON.stringify(body) })
export const updateCustomField = (id: string, body: Record<string, unknown>) =>
    apiFetch<CustomField>(`/custom-fields/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
export const deleteCustomField = (id: string) =>
    apiFetch<void>(`/custom-fields/${id}`, { method: 'DELETE' })

// ─── Audit Logs ───────────────────────────────────────────────────────────────
export const getAuditLogs = (programmeId: string) =>
    apiFetch<AuditLog[]>(`/audit/programme/${programmeId}`)
export const getAllAuditLogs = () => apiFetch<AuditLog[]>('/audit/all')

// ─── Programme Managers ───────────────────────────────────────────────────────
export const getProgrammeManagers = (programmeId: string) =>
    apiFetch<ProgrammeManagerLink[]>(`/programme-managers/programme/${programmeId}`)
export const addProgrammeManager = (programmeId: string, userId: string) =>
    apiFetch<ProgrammeManagerLink>(`/programme-managers/programme/${programmeId}`, {
        method: 'POST', body: JSON.stringify({ user_id: userId }),
    })
export const removeProgrammeManager = (programmeId: string, userId: string) =>
    apiFetch<void>(`/programme-managers/programme/${programmeId}/${userId}`, { method: 'DELETE' })
export const listProgrammeManagerUsers = () =>
    apiFetch<{ user_id: string; email: string; national_id_hash?: string }[]>('/programme-managers')
