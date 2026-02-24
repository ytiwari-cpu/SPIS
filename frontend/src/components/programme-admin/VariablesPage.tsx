import { useEffect, useState } from 'react'
import { useProgrammeStore } from '@/store/programmeStore'
import * as api from '@/services/programmeApi'
import { useAuthStore } from '@/store/authStore'

export default function VariablesPageContent() {
    const { variables, customFields, fetchVariables, fetchCustomFields } = useProgrammeStore()
    const { hasPermission } = useAuthStore()
    const canCreate = hasPermission('PROGRAMME.RULES.MANAGE')
    const [tab, setTab] = useState<'catalog' | 'custom'>('catalog')
    const [search, setSearch] = useState('')
    const [catFilter, setCatFilter] = useState('')
    const [showForm, setShowForm] = useState(false)
    const [form, setForm] = useState({ display_name: '', target_table: 'family', data_type: 'text', description: '', enum_str: '' })
    const [saving, setSaving] = useState(false)

    useEffect(() => { fetchVariables(); fetchCustomFields() }, [])

    const cats = [...new Set(variables.map(v => v.category))].sort()
    const filtered = variables.filter(v => {
        if (search && !v.display_name.toLowerCase().includes(search.toLowerCase()) && !v.variable_code.toLowerCase().includes(search.toLowerCase())) return false
        if (catFilter && v.category !== catFilter) return false
        return true
    })

    const handleCreate = async () => {
        setSaving(true)
        try {
            const body: Record<string, unknown> = { display_name: form.display_name, target_table: form.target_table, data_type: form.data_type, description: form.description || undefined }
            if (form.data_type === 'enum' && form.enum_str) body.enum_values = form.enum_str.split(',').map(s => s.trim()).filter(Boolean)
            await api.createCustomField(body)
            await fetchCustomFields(); await fetchVariables()
            setShowForm(false); setForm({ display_name: '', target_table: 'family', data_type: 'text', description: '', enum_str: '' })
        } catch (e) { alert((e as Error).message) }
        setSaving(false)
    }

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Variables & Custom Fields</h1>
            <p className="text-sm text-gray-500 mb-6">Available fields for rule configuration</p>

            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 mb-6 w-fit">
                <button onClick={() => setTab('catalog')} className={`px-4 py-2 rounded-md text-sm font-medium ${tab === 'catalog' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500'}`}>Catalog ({variables.length})</button>
                <button onClick={() => setTab('custom')} className={`px-4 py-2 rounded-md text-sm font-medium ${tab === 'custom' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500'}`}>Custom ({customFields.length})</button>
            </div>

            {tab === 'catalog' ? (
                <>
                    <div className="flex gap-3 mb-4">
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search variables..." className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm" />
                        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm">
                            <option value="">All Categories</option>
                            {cats.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[500px] overflow-y-auto">
                            {filtered.map(v => (
                                <div key={v.variable_code} className="flex items-center justify-between p-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-750">
                                    <div><p className="font-medium text-gray-900 dark:text-white">{v.display_name}</p><p className="text-xs text-gray-400 font-mono">{v.variable_code}</p></div>
                                    <div className="flex items-center gap-3 text-xs text-gray-500">
                                        <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700">{v.category}</span>
                                        <span>{v.data_type}</span>
                                        <span className={`w-2 h-2 rounded-full ${v.is_system_field ? 'bg-blue-500' : 'bg-orange-500'}`} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            ) : (
                <>
                    {canCreate && <div className="flex justify-end mb-4">
                        <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-lg">add</span> Add Custom Field
                        </button>
                    </div>}
                    {showForm && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-orange-200 dark:border-orange-800 p-6 mb-6">
                            <h3 className="font-semibold mb-4">New Custom Field</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} placeholder="Display Name" className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm" />
                                <select value={form.target_table} onChange={e => setForm(f => ({ ...f, target_table: e.target.value }))} className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm">
                                    {['family', 'family_member', 'address', 'house_services'].map(t => <option key={t}>{t}</option>)}
                                </select>
                                <select value={form.data_type} onChange={e => setForm(f => ({ ...f, data_type: e.target.value }))} className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm">
                                    {['text', 'number', 'boolean', 'date', 'enum'].map(t => <option key={t}>{t}</option>)}
                                </select>
                                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description" className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm" />
                                {form.data_type === 'enum' && <input value={form.enum_str} onChange={e => setForm(f => ({ ...f, enum_str: e.target.value }))} placeholder="option1, option2" className="col-span-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm" />}
                            </div>
                            <div className="flex justify-end gap-3 mt-4">
                                <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
                                <button onClick={handleCreate} disabled={saving || !form.display_name} className="px-5 py-2 bg-orange-500 text-white rounded-lg text-sm disabled:opacity-50">{saving ? 'Creating...' : 'Create Field'}</button>
                            </div>
                        </div>
                    )}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden divide-y divide-gray-100 dark:divide-gray-700">
                        {customFields.length === 0 ? <div className="p-8 text-center text-gray-400">No custom fields yet.</div> : customFields.map(f => (
                            <div key={f.field_id} className="flex items-center justify-between p-4">
                                <div><p className="font-medium text-sm">{f.display_name}</p><p className="text-xs text-gray-500">{f.target_table}.{f.field_name} · {f.data_type}</p></div>
                                {canCreate && f.is_active && <button onClick={async () => { await api.deleteCustomField(f.field_id); fetchCustomFields(); fetchVariables() }} className="text-red-500 text-xs">Deactivate</button>}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}
