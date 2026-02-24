/**
 * ProgrammesPage — Wireframe-aligned redesign:
 *   • Top bar: SELECT PROGRAMME dropdown + Add New button
 *   • Tabs: Programme Details | Rules
 *   • Programme Details: Basic Information card + Configuration card
 *   • Bottom bar: Edit Programme | Create New Version
 *   • Rules: Inline RuleBuilder + VariablesPanel
 */
import { useEffect, useState, useCallback } from 'react'
import { useProgrammeStore } from '@/store/programmeStore'
import * as api from '@/services/programmeApi'
import type { Programme, RulesTreeNode, RuleVariable } from '@/types/programme'
import RuleBuilder from '@/components/programme/RuleBuilder'

// ── Variables Panel ───────────────────────────────────────────────────────────

function VariablesPanel({ variables, onVariableAdded }: { variables: RuleVariable[]; onVariableAdded: () => void }) {
    const { customFields, fetchCustomFields } = useProgrammeStore()
    const [open, setOpen] = useState(false)
    const [showForm, setShowForm] = useState(false)
    const [form, setForm] = useState({ display_name: '', target_table: 'family', data_type: 'text', description: '', enum_str: '' })
    const [saving, setSaving] = useState(false)
    const [search, setSearch] = useState('')

    useEffect(() => { if (open) fetchCustomFields() }, [open, fetchCustomFields])

    const handleCreate = async () => {
        if (!form.display_name) return
        setSaving(true)
        try {
            const body: Record<string, unknown> = {
                display_name: form.display_name,
                target_table: form.target_table,
                data_type: form.data_type,
                description: form.description || undefined,
            }
            if (form.data_type === 'enum' && form.enum_str)
                body.enum_values = form.enum_str.split(',').map(s => s.trim()).filter(Boolean)
            await api.createCustomField(body)
            await fetchCustomFields()
            onVariableAdded()
            setShowForm(false)
            setForm({ display_name: '', target_table: 'family', data_type: 'text', description: '', enum_str: '' })
        } catch (e) { alert((e as Error).message) }
        setSaving(false)
    }

    const cats = [...new Set(variables.map(v => v.category))].sort()
    const filtered = variables.filter(v =>
        !search ||
        v.display_name.toLowerCase().includes(search.toLowerCase()) ||
        v.variable_code.toLowerCase().includes(search.toLowerCase())
    )

    const inp = 'px-3 py-1.5 text-sm rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500'

    return (
        <div className="mt-4 border border-gray-200 rounded-xl overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-gray-500">data_object</span>
                    <span className="text-sm font-semibold text-gray-700">Variables & Custom Fields</span>
                    <span className="text-xs text-gray-400">({variables.length} available)</span>
                </div>
                <span className={`material-symbols-outlined text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}>expand_more</span>
            </button>

            {open && (
                <div className="p-4 bg-white">
                    <div className="flex gap-2 mb-3">
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search variables..."
                            className={`flex-1 ${inp}`}
                        />
                        <select className={inp} onChange={e => setSearch(e.target.value)} defaultValue="">
                            <option value="">All categories</option>
                            {cats.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100 mb-4">
                        {filtered.map(v => (
                            <div key={v.variable_code} className="flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50">
                                <div>
                                    <p className="font-medium text-gray-900">{v.display_name}</p>
                                    <p className="text-xs text-gray-400 font-mono">{v.variable_code}</p>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                    <span className="px-2 py-0.5 rounded-full bg-gray-100">{v.category}</span>
                                    <span>{v.data_type}</span>
                                    <span className={`w-2 h-2 rounded-full ${v.is_system_field ? 'bg-blue-400' : 'bg-orange-400'}`} title={v.is_system_field ? 'System' : 'Custom'} />
                                </div>
                            </div>
                        ))}
                        {filtered.length === 0 && <div className="p-4 text-center text-xs text-gray-400">No variables found.</div>}
                    </div>

                    {/* Custom fields section */}
                    <div className="border-t border-gray-100 pt-3">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Custom Fields ({customFields.length})</p>
                    </div>

                    {showForm ? (
                        <div className="bg-gray-50 rounded-xl border border-orange-200 p-4">
                            <p className="text-sm font-semibold text-gray-700 mb-3">New Custom Field</p>
                            <div className="grid grid-cols-2 gap-3">
                                <input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} placeholder="Display Name *" className={inp} />
                                <select value={form.target_table} onChange={e => setForm(f => ({ ...f, target_table: e.target.value }))} className={inp}>
                                    {['family', 'family_member', 'address', 'house_services'].map(t => <option key={t}>{t}</option>)}
                                </select>
                                <select value={form.data_type} onChange={e => setForm(f => ({ ...f, data_type: e.target.value }))} className={inp}>
                                    {['text', 'number', 'boolean', 'date', 'enum'].map(t => <option key={t}>{t}</option>)}
                                </select>
                                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description" className={inp} />
                                {form.data_type === 'enum' && (
                                    <input value={form.enum_str} onChange={e => setForm(f => ({ ...f, enum_str: e.target.value }))} placeholder="option1, option2, ..." className={`col-span-2 ${inp}`} />
                                )}
                            </div>
                            <div className="flex justify-end gap-2 mt-3">
                                <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
                                <button type="button" onClick={handleCreate} disabled={saving || !form.display_name} className="px-4 py-1.5 bg-orange-500 text-white text-sm rounded-lg disabled:opacity-50 hover:bg-orange-600 transition-colors">
                                    {saving ? 'Creating...' : 'Create Field'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setShowForm(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-300 text-orange-600 text-sm font-medium rounded-lg hover:bg-orange-100 transition-colors"
                        >
                            <span className="material-symbols-outlined text-base">add</span>
                            Add Custom Variable
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
    const cls: Record<string, string> = {
        DRAFT: 'bg-amber-100 text-amber-700',
        ACTIVE: 'bg-green-100 text-green-700',
        INACTIVE: 'bg-gray-100 text-gray-500',
    }
    return (
        <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wide ${cls[status?.toUpperCase()] ?? cls.INACTIVE}`}>
            {status || 'INACTIVE'}
        </span>
    )
}

// ── Create Programme Modal ────────────────────────────────────────────────────

function CreateProgrammeModal({ onCreated, onClose }: { onCreated: (p: Programme) => void; onClose: () => void }) {
    const [step, setStep] = useState(1)
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState({
        programme_name: '',
        programme_code: '',
        description: '',
        effective_from: '',
        effective_to: '',
        ranking_required: false,
        quota_limit: '',
        benefit_type: 'Cash',
        benefit_frequency: 'Monthly',
        payment_mode: 'Bank Transfer',
        currency: 'USD',
        total_budget_allocated: '',
    })
    const [rulesTree, setRulesTree] = useState<RulesTreeNode | null>(null)
    const [variables, setVariables] = useState<RuleVariable[]>([])
    const [draftId, setDraftId] = useState<string | null>(null)

    useEffect(() => {
        api.getVariables().then(setVariables).catch(console.error)
    }, [])

    const inp = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'

    const handleStep1 = async () => {
        if (!form.programme_name || !form.programme_code) return
        setSaving(true)
        try {
            const prog = await api.createProgramme({
                programme_name: form.programme_name,
                programme_code: form.programme_code,
                description: form.description,
                effective_from: form.effective_from || new Date().toISOString().slice(0, 10),
                effective_to: form.effective_to || null,
                ranking_required: form.ranking_required,
                quota_limit: form.quota_limit ? Number(form.quota_limit) : null,
                benefit_type: form.benefit_type,
                benefit_frequency: form.benefit_frequency,
                payment_mode: form.payment_mode,
                currency: form.currency,
                total_budget_allocated: form.total_budget_allocated ? Number(form.total_budget_allocated) : null,
            })
            setDraftId(prog.programme_id)
            setStep(2)
        } catch (e) { alert((e as Error).message) }
        setSaving(false)
    }

    const handleFinish = async () => {
        if (!draftId) return
        setSaving(true)
        try {
            if (rulesTree) await api.saveRulesTree(draftId, rulesTree)
            const updated = await api.getProgramme(draftId)
            onCreated(updated)
        } catch (e) { alert((e as Error).message) }
        setSaving(false)
    }

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-200">
                    <div>
                        <h3 className="font-bold text-gray-900 text-lg">Create New Programme</h3>
                        <p className="text-xs text-gray-400 mt-0.5">Step {step} of 2: {step === 1 ? 'Basic Information & Configuration' : 'Eligibility Rules'}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="p-5">
                    {step === 1 ? (
                        <div className="space-y-5">
                            {/* Basic Info */}
                            <div>
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Basic Information</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="block text-xs font-semibold text-gray-500 mb-1">Programme Name *</label>
                                        <input value={form.programme_name} onChange={e => setForm(f => ({ ...f, programme_name: e.target.value }))} placeholder="e.g. National Senior Citizens Grant" className={inp} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 mb-1">Code *</label>
                                        <input value={form.programme_code} onChange={e => setForm(f => ({ ...f, programme_code: e.target.value }))} placeholder="e.g. NSPS-CASH-01" className={inp} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 mb-1">Benefit Type</label>
                                        <select value={form.benefit_type} onChange={e => setForm(f => ({ ...f, benefit_type: e.target.value }))} className={inp}>
                                            {['Cash', 'In-Kind', 'Voucher', 'Services'].map(t => <option key={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 mb-1">Effective From</label>
                                        <input type="date" value={form.effective_from} onChange={e => setForm(f => ({ ...f, effective_from: e.target.value }))} className={inp} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 mb-1">Effective To</label>
                                        <input type="date" value={form.effective_to} onChange={e => setForm(f => ({ ...f, effective_to: e.target.value }))} className={inp} />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-semibold text-gray-500 mb-1">Description</label>
                                        <textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description of the programme..." className={inp} />
                                    </div>
                                </div>
                            </div>

                            {/* Configuration */}
                            <div>
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Configuration</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex items-center gap-3 col-span-2">
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" checked={form.ranking_required} onChange={e => setForm(f => ({ ...f, ranking_required: e.target.checked }))} className="sr-only peer" />
                                            <div className="w-10 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
                                        </label>
                                        <div>
                                            <p className="text-sm font-semibold text-gray-700">Ranking Required</p>
                                            <p className="text-xs text-gray-400">Enable algorithmic prioritization</p>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 mb-1">Quota Limit (members)</label>
                                        <input type="number" value={form.quota_limit} onChange={e => setForm(f => ({ ...f, quota_limit: e.target.value }))} placeholder="e.g. 150000" className={inp} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 mb-1">Frequency</label>
                                        <select value={form.benefit_frequency} onChange={e => setForm(f => ({ ...f, benefit_frequency: e.target.value }))} className={inp}>
                                            {['Monthly', 'Quarterly', 'Annually', 'One-time'].map(t => <option key={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 mb-1">Budget (USD)</label>
                                        <input type="number" value={form.total_budget_allocated} onChange={e => setForm(f => ({ ...f, total_budget_allocated: e.target.value }))} placeholder="e.g. 50000000" className={inp} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 mb-1">Currency</label>
                                        <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className={inp}>
                                            {['USD', 'EUR', 'GBP', 'ETB', 'KES', 'NGN'].map(t => <option key={t}>{t}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <p className="text-sm text-gray-500 mb-4">Define eligibility rules. The programme has been saved as draft. Rules can be updated later.</p>
                            <RuleBuilder value={rulesTree ?? { combinator: 'AND', rules: [] }} onChange={setRulesTree} variables={variables} readOnly={false} />
                            <VariablesPanel variables={variables} onVariableAdded={async () => { const vars = await api.getVariables(); setVariables(vars) }} />
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 px-5 pb-5">
                    {step === 2 && <button onClick={() => setStep(1)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">← Back</button>}
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
                    {step === 1 ? (
                        <button onClick={handleStep1} disabled={saving || !form.programme_name || !form.programme_code} className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                            {saving ? 'Saving...' : 'Next: Add Rules →'}
                        </button>
                    ) : (
                        <button onClick={handleFinish} disabled={saving} className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                            {saving ? 'Finishing...' : 'Create Programme'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function ProgrammesPageContent() {
    const { programmes, loading, fetchProgrammes } = useProgrammeStore()
    const [selectedProgramme, setSelectedProgramme] = useState<Programme | null>(null)
    const [activeTab, setActiveTab] = useState<'details' | 'rules'>('details')
    const [showCreate, setShowCreate] = useState(false)
    const [editing, setEditing] = useState(false)
    const [saving, setSaving] = useState(false)
    const [editForm, setEditForm] = useState<Partial<Programme>>({})
    const [rulesTree, setRulesTree] = useState<RulesTreeNode | null>(null)
    const [variables, setVariables] = useState<RuleVariable[]>([])

    useEffect(() => { fetchProgrammes() }, []) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (programmes.length > 0 && !selectedProgramme) {
            setSelectedProgramme(programmes[0])
        }
    }, [programmes]) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (selectedProgramme) {
            setEditForm(selectedProgramme)
            setRulesTree(selectedProgramme.rules_tree ?? null)
            api.getVariables().then(setVariables).catch(console.error)
        }
    }, [selectedProgramme])

    const handleSelectProgramme = useCallback((id: string) => {
        const p = programmes.find(x => x.programme_id === id) ?? null
        setSelectedProgramme(p)
        setEditing(false)
        setActiveTab('details')
    }, [programmes])

    const handleSave = async () => {
        if (!selectedProgramme) return
        setSaving(true)
        try {
            await api.updateProgramme(selectedProgramme.programme_id, editForm)
            await fetchProgrammes()
            const updated = await api.getProgramme(selectedProgramme.programme_id)
            setSelectedProgramme(updated)
            setEditing(false)
        } catch (e) { alert((e as Error).message) }
        setSaving(false)
    }

    const handleSaveRules = async () => {
        if (!selectedProgramme) return
        setSaving(true)
        try {
            if (rulesTree) await api.saveRulesTree(selectedProgramme.programme_id, rulesTree)
            const updated = await api.getProgramme(selectedProgramme.programme_id)
            setSelectedProgramme(updated)
            setEditing(false)
        } catch (e) { alert((e as Error).message) }
        setSaving(false)
    }

    const handleActivate = async () => {
        if (!selectedProgramme) return
        setSaving(true)
        try {
            await api.updateProgramme(selectedProgramme.programme_id, { status: 'ACTIVE' })
            const updated = await api.getProgramme(selectedProgramme.programme_id)
            setSelectedProgramme(updated)
            fetchProgrammes()
        } catch (e) { alert((e as Error).message) }
        setSaving(false)
    }

    const inp = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'

    const p = selectedProgramme
    const config = p?.programme_config
    const payment = p?.programme_payment_settings

    return (
        <div className="bg-gray-50 min-h-screen p-6 md:p-8">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Programmes</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Manage and monitor programmes for the National Social Protection System.</p>
                </div>

                {/* Top Bar: SELECT PROGRAMME inside a white card */}
                <div className="bg-white border border-gray-200 rounded-lg px-5 py-3.5 flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Select Programme:</span>
                        <select
                            value={selectedProgramme?.programme_id ?? ''}
                            onChange={e => handleSelectProgramme(e.target.value)}
                            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[260px] font-medium text-gray-800"
                        >
                            {programmes.map(prog => (
                                <option key={prog.programme_id} value={prog.programme_id}>{prog.programme_name}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={() => setShowCreate(true)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <span className="material-symbols-outlined text-base">add</span>
                        Add New
                    </button>
                </div>

                {loading && !p ? (
                    <div className="bg-white border border-gray-200 rounded-lg p-12 text-center text-sm text-gray-400">
                        Loading programmes…
                    </div>
                ) : !p ? (
                    <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
                        <span className="material-symbols-outlined text-4xl text-gray-300 mb-2 block">verified_user</span>
                        <p className="text-gray-400 text-sm">No programmes yet. Create one to get started.</p>
                        <button onClick={() => setShowCreate(true)} className="mt-4 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                            + Add New Programme
                        </button>
                    </div>
                ) : (
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        {/* Tabs */}
                        <div className="flex gap-6 px-6 border-b border-gray-200">
                            {(['details', 'rules'] as const).map(t => (
                                <button
                                    key={t}
                                    onClick={() => { setActiveTab(t); setEditing(false) }}
                                    className={`py-3.5 text-sm font-semibold border-b-2 -mb-px transition-colors capitalize ${activeTab === t
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-gray-400 hover:text-gray-700'
                                        }`}
                                >
                                    {t === 'details' ? 'Program Details' : 'Rules'}
                                </button>
                            ))}
                        </div>

                        {/* Tab Content */}
                        <div className="p-6 space-y-5">
                            {activeTab === 'details' ? (
                                <>
                                    {/* ── Programme Basic Information Card ── */}
                                    <div className="border border-gray-200 rounded-xl p-5">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                                <span className="material-symbols-outlined text-blue-500">description</span>
                                                <h2 className="font-bold text-gray-800">Programme Basic Information</h2>
                                            </div>
                                            <StatusBadge status={p.status || (p.active_flag ? 'ACTIVE' : 'INACTIVE')} />
                                        </div>

                                        {editing ? (
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="col-span-2">
                                                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Programme Name</label>
                                                    <input value={editForm.programme_name ?? ''} onChange={e => setEditForm(f => ({ ...f, programme_name: e.target.value }))} className={inp} />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Code</label>
                                                    <input value={editForm.programme_code ?? ''} onChange={e => setEditForm(f => ({ ...f, programme_code: e.target.value }))} className={inp} />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Effective From</label>
                                                    <input type="date" value={config?.effective_from?.slice(0, 10) ?? ''} readOnly className={inp + ' bg-gray-50 cursor-not-allowed'} />
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Description</label>
                                                    <textarea rows={2} value={editForm.description ?? ''} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className={inp} />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                <div>
                                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">PROGRAMME NAME</p>
                                                    <p className="font-bold text-gray-900 mt-1">{p.programme_name}</p>
                                                </div>
                                                <div className="grid grid-cols-2 gap-6">
                                                    <div>
                                                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">CODE</p>
                                                        <p className="font-semibold text-blue-600 mt-1 font-mono">{p.programme_code}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">EFFECTIVE DATE RANGE</p>
                                                        <p className="text-gray-700 mt-1">
                                                            {config?.effective_from?.slice(0, 10) ?? '—'} to {config?.effective_to?.slice(0, 10) ?? '—'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">DESCRIPTION</p>
                                                    <p className="text-gray-600 mt-1 text-sm leading-relaxed">{p.description || '—'}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* ── Configuration Card ── */}
                                    <div className="border border-gray-200 rounded-xl p-5">
                                        <div className="flex items-center gap-2 mb-4">
                                            <span className="material-symbols-outlined text-gray-500">settings</span>
                                            <h2 className="font-bold text-gray-800">Configuration</h2>
                                        </div>

                                        <div className="grid grid-cols-3 gap-6">
                                            {/* Ranking Required toggle */}
                                            <div>
                                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Ranking Required</p>
                                                <div className="flex items-start gap-3">
                                                    <div className="relative mt-0.5">
                                                        <div className={`w-10 h-5 rounded-full ${config?.ranking_required ? 'bg-blue-600' : 'bg-gray-300'} relative`}>
                                                            <div className={`absolute w-4 h-4 bg-white rounded-full top-0.5 transition-all ${config?.ranking_required ? 'left-5' : 'left-0.5'}`} />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold text-gray-700">Ranking Required</p>
                                                        <p className="text-xs text-gray-400">Enable algorithmic prioritization</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Quota Limit */}
                                            <div>
                                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">QUOTA LIMIT</p>
                                                <p className="text-gray-900 font-semibold">
                                                    {config?.quota_limit ? `${config.quota_limit.toLocaleString()} Members` : '—'}
                                                </p>
                                            </div>

                                            {/* Benefit Type */}
                                            <div>
                                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">BENEFIT TYPE</p>
                                                <span className="px-2.5 py-0.5 text-xs font-bold bg-blue-100 text-blue-700 rounded">
                                                    {config?.benefit_type?.toUpperCase() || '—'}
                                                </span>
                                            </div>

                                            {/* Frequency */}
                                            <div>
                                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">FREQUENCY</p>
                                                <p className="font-semibold text-gray-900">{config?.benefit_frequency || '—'}</p>
                                            </div>

                                            {/* Budget */}
                                            <div>
                                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">BUDGET</p>
                                                <p className="font-semibold text-gray-900">
                                                    {payment?.total_budget_allocated
                                                        ? `${payment.currency ?? 'USD'} ${Number(payment.total_budget_allocated).toLocaleString()}`
                                                        : '—'}
                                                </p>
                                            </div>

                                            {/* Currency */}
                                            <div>
                                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">CURRENCY</p>
                                                <p className="font-semibold text-gray-900">{payment?.currency || '—'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                /* Rules Tab */
                                <>
                                    <div className="flex items-center justify-end mb-2">
                                        {!editing && (
                                            <button onClick={() => setEditing(true)} className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-0.5">
                                                <span className="material-symbols-outlined text-sm">edit</span> Edit Rules
                                            </button>
                                        )}
                                    </div>
                                    <RuleBuilder
                                        value={rulesTree ?? { combinator: 'AND', rules: [] }}
                                        onChange={setRulesTree}
                                        variables={variables}
                                        readOnly={!editing}
                                        status={p.status || 'DRAFT'}
                                        programmeRules={p.programme_rules ?? []}
                                    />
                                    {editing && (
                                        <>
                                            <VariablesPanel
                                                variables={variables}
                                                onVariableAdded={async () => { const vars = await api.getVariables(); setVariables(vars) }}
                                            />
                                            <div className="flex justify-end gap-3 mt-4">
                                                <button onClick={() => { setEditing(false); setRulesTree(p.rules_tree ?? null) }} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                                                <button onClick={handleSaveRules} disabled={saving} className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                                                    {saving ? 'Saving...' : 'Save Rules'}
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Bottom Action Bar — only on Details tab */}
                        {activeTab === 'details' && (
                            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
                                <div className="flex items-center gap-2">
                                    {(p.status === 'DRAFT' || (!p.active_flag && p.status !== 'ACTIVE')) && (
                                        <button onClick={handleActivate} disabled={saving} className="px-4 py-2 text-sm font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50">
                                            Publish
                                        </button>
                                    )}
                                </div>
                                <div className="flex gap-3">
                                    {editing ? (
                                        <>
                                            <button onClick={() => { setEditing(false); setEditForm(p) }} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                                            <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                                                {saving ? 'Saving...' : 'Save Changes'}
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button onClick={() => setEditing(true)} className="px-5 py-2 text-sm font-semibold text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                                                Edit Programme
                                            </button>
                                            <button onClick={() => setShowCreate(true)} className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                                                Create New Version
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Create Programme Modal */}
            {showCreate && (
                <CreateProgrammeModal
                    onCreated={(prog) => {
                        fetchProgrammes()
                        setSelectedProgramme(prog)
                        setShowCreate(false)
                    }}
                    onClose={() => setShowCreate(false)}
                />
            )}
        </div>
    )
}
