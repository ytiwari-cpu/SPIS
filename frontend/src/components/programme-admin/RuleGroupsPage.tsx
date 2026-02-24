/**
 * Programme Admin — Rule Groups Page (PMT, MT, etc.)
 */
import { useEffect, useState } from 'react'
import { useProgrammeStore } from '@/store/programmeStore'
import * as api from '@/services/programmeApi'
import type { RuleGroup, RuleGroupRule } from '@/types/programme'
import { OPERATORS } from '@/types/programme'
import { useAuthStore } from '@/store/authStore'

export default function RuleGroupsPageContent() {
    const { ruleGroups, variables, fetchRuleGroups, fetchVariables } = useProgrammeStore()
    const { hasPermission } = useAuthStore()
    const canManage = hasPermission('PROGRAMME.RULES.MANAGE')

    const [selected, setSelected] = useState<RuleGroup | null>(null)
    const [showCreate, setShowCreate] = useState(false)
    const [form, setForm] = useState({ group_code: '', group_name: '', description: '', scoring_method: 'weighted_sum' as const })
    const [saving, setSaving] = useState(false)

    useEffect(() => { fetchRuleGroups(); fetchVariables() }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const handleCreate = async () => {
        setSaving(true)
        try {
            await api.createRuleGroup(form)
            await fetchRuleGroups()
            setShowCreate(false)
            setForm({ group_code: '', group_name: '', description: '', scoring_method: 'weighted_sum' })
        } catch (err) { alert((err as Error).message) }
        setSaving(false)
    }

    const handleLoadDetail = async (g: RuleGroup) => {
        try {
            const full = await api.getRuleGroup(g.rule_group_id)
            setSelected(full)
        } catch { setSelected(g) }
    }

    // ── Detail View ────────────────────────────────────────────────────────
    if (selected) {
        return (
            <div className="p-6 max-w-4xl mx-auto">
                <button onClick={() => setSelected(null)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
                    <span className="material-symbols-outlined text-lg">arrow_back</span> Back to Rule Groups
                </button>

                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="material-symbols-outlined text-purple-500 text-2xl">rule_folder</span>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{selected.group_name}</h1>
                            <p className="text-sm text-gray-500">{selected.group_code} · {selected.scoring_method.replace('_', ' ')}</p>
                        </div>
                    </div>
                    {selected.description && <p className="text-gray-600 dark:text-gray-300 mt-2">{selected.description}</p>}
                </div>

                {/* Sub-Rules */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                        <h2 className="font-semibold text-gray-900 dark:text-white">Sub-Rules ({selected.rule_group_rules?.length || 0})</h2>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {(!selected.rule_group_rules || selected.rule_group_rules.length === 0) ? (
                            <div className="p-8 text-center text-gray-400">No sub-rules in this group.</div>
                        ) : selected.rule_group_rules.map((sr: RuleGroupRule) => (
                            <div key={sr.rule_group_rule_id} className="flex items-center justify-between p-4">
                                <div>
                                    <p className="font-medium text-sm text-gray-900 dark:text-white">{sr.variable_code}</p>
                                    <p className="text-xs text-gray-500">{sr.operator} {sr.threshold_value} · Weight: {sr.weight} {sr.mandatory_flag ? '· ⚠ Mandatory' : ''}</p>
                                </div>
                                {canManage && (
                                    <button
                                        onClick={async () => {
                                            await api.removeRuleGroupRule(selected.rule_group_id, sr.rule_group_rule_id)
                                            handleLoadDetail(selected)
                                        }}
                                        className="text-red-500 hover:text-red-700 text-sm"
                                    >Remove</button>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Add sub-rule form */}
                    {canManage && (
                        <AddSubRuleForm groupId={selected.rule_group_id} variables={variables} onAdded={() => handleLoadDetail(selected)} />
                    )}
                </div>
            </div>
        )
    }

    // ── List View ──────────────────────────────────────────────────────────
    return (
        <div className="p-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rule Groups</h1>
                    <p className="text-sm text-gray-500 mt-1">Composite scoring groups like PMT, MT</p>
                </div>
                {canManage && (
                    <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-lg">add</span> Create Group
                    </button>
                )}
            </div>

            {/* Create Form */}
            {showCreate && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-purple-200 dark:border-purple-800 p-6 mb-6">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4">New Rule Group</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Group Code</label>
                            <input value={form.group_code} onChange={e => setForm(f => ({ ...f, group_code: e.target.value }))} placeholder="e.g., PMT"
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Group Name</label>
                            <input value={form.group_name} onChange={e => setForm(f => ({ ...f, group_name: e.target.value }))} placeholder="e.g., Proxy Means Test"
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Scoring Method</label>
                            <select value={form.scoring_method} onChange={e => setForm(f => ({ ...f, scoring_method: e.target.value as 'weighted_sum' }))}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm">
                                <option value="weighted_sum">Weighted Sum</option>
                                <option value="average">Average</option>
                                <option value="min">Minimum</option>
                                <option value="max">Maximum</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description"
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm" />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 mt-5">
                        <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
                        <button onClick={handleCreate} disabled={saving || !form.group_code || !form.group_name} className="px-5 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                            {saving ? 'Creating...' : 'Create Group'}
                        </button>
                    </div>
                </div>
            )}

            {/* List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {ruleGroups.length === 0 ? (
                    <div className="col-span-2 p-8 text-center text-gray-400 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                        No rule groups found.
                    </div>
                ) : ruleGroups.map(g => (
                    <button
                        key={g.rule_group_id}
                        onClick={() => handleLoadDetail(g)}
                        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 text-left hover:shadow-lg transition-all hover:-translate-y-0.5"
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <span className="material-symbols-outlined text-purple-500">rule_folder</span>
                            <h3 className="font-semibold text-gray-900 dark:text-white">{g.group_name}</h3>
                        </div>
                        <p className="text-xs text-gray-500 mb-2">{g.group_code} · {g.scoring_method.replace('_', ' ')}</p>
                        {g.description && <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{g.description}</p>}
                        <div className="mt-3 flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                                {g.rule_group_rules?.length || 0} sub-rules
                            </span>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    )
}

// ── Add Sub-Rule Form ────────────────────────────────────────────────────────
function AddSubRuleForm({ groupId, variables, onAdded }: {
    groupId: string
    variables: { variable_code: string; display_name: string; category: string }[]
    onAdded: () => void
}) {
    const [open, setOpen] = useState(false)
    const [varCode, setVarCode] = useState('')
    const [operator, setOperator] = useState('==')
    const [threshold, setThreshold] = useState('')
    const [weight, setWeight] = useState('1')
    const [mandatory, setMandatory] = useState(false)

    const handleAdd = async () => {
        try {
            await api.addRuleGroupRule(groupId, {
                variable_code: varCode, operator, threshold_value: threshold,
                weight: Number(weight), mandatory_flag: mandatory,
            })
            onAdded()
            setOpen(false)
            setVarCode(''); setThreshold(''); setWeight('1'); setMandatory(false)
        } catch (err) { alert((err as Error).message) }
    }

    if (!open) {
        return (
            <div className="p-4 border-t border-gray-100 dark:border-gray-700">
                <button onClick={() => setOpen(true)} className="text-sm text-purple-600 hover:underline flex items-center gap-1">
                    <span className="material-symbols-outlined text-base">add</span> Add Sub-Rule
                </button>
            </div>
        )
    }

    return (
        <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-purple-50/50 dark:bg-purple-900/5">
            <div className="grid grid-cols-2 gap-3">
                <select value={varCode} onChange={e => setVarCode(e.target.value)}
                    className="col-span-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm">
                    <option value="">Select Variable...</option>
                    {variables.map(v => <option key={v.variable_code} value={v.variable_code}>{v.display_name} ({v.category})</option>)}
                </select>
                <select value={operator} onChange={e => setOperator(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm">
                    {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <input value={threshold} onChange={e => setThreshold(e.target.value)} placeholder="Threshold"
                    className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm" />
                <input value={weight} onChange={e => setWeight(e.target.value)} type="number" step="0.1" placeholder="Weight"
                    className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm" />
                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <input type="checkbox" checked={mandatory} onChange={e => setMandatory(e.target.checked)} /> Mandatory
                </label>
            </div>
            <div className="flex justify-end gap-2 mt-3">
                <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm text-gray-500">Cancel</button>
                <button onClick={handleAdd} disabled={!varCode || !threshold} className="px-4 py-1.5 bg-purple-600 text-white rounded-lg text-sm disabled:opacity-50">Add</button>
            </div>
        </div>
    )
}
