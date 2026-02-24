/**
 * Beneficiaries Page — Matches wireframe exactly:
 * Enrolled / Eligible tabs, search, Filters, Export CSV, data table.
 */
import { useEffect, useState } from 'react'
import { useProgrammeStore } from '@/store/programmeStore'
import * as api from '@/services/programmeApi'

export default function BeneficiariesPageContent() {
    const { programmes, beneficiaries, fetchProgrammes, fetchBeneficiaries, loading } = useProgrammeStore()
    const [selectedProg, setSelectedProg] = useState('')
    const [tab, setTab] = useState<'enrolled' | 'eligible'>('enrolled')
    const [search, setSearch] = useState('')
    const [evaluating, setEvaluating] = useState(false)

    useEffect(() => { fetchProgrammes() }, []) // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { if (selectedProg) fetchBeneficiaries(selectedProg) }, [selectedProg]) // eslint-disable-line react-hooks/exhaustive-deps

    const handleEvaluateAll = async () => {
        if (!selectedProg) return
        setEvaluating(true)
        try {
            await api.evaluateAll(selectedProg)
            fetchBeneficiaries(selectedProg)
        } catch (e) { alert((e as Error).message) }
        setEvaluating(false)
    }

    const handleExportCSV = () => {
        if (!beneficiaries.length) return
        const rows = [
            ['UUID (Subject ID)', 'Score', 'Rule Ver', 'Status', 'Evaluated At'],
            ...beneficiaries.map(b => [b.subject_id, b.calculated_score ?? '', 'v2.4', b.status, b.active_from || ''])
        ]
        const csv = rows.map(r => r.join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `beneficiaries-${selectedProg}.csv`
        a.click()
    }

    const filtered = beneficiaries.filter(b => {
        if (search && !b.subject_id.toLowerCase().includes(search.toLowerCase())) return false
        if (tab === 'eligible') return b.calculated_score != null && b.calculated_score > 0
        return true
    })

    return (
        <div className="bg-gray-50 min-h-screen p-6 md:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Beneficiaries</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Manage and monitor beneficiaries for the National Social Protection System.</p>
                </div>

                {/* Programme selector */}
                <div className="flex gap-3 mb-5">
                    <select
                        value={selectedProg}
                        onChange={e => setSelectedProg(e.target.value)}
                        className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">Select Programme…</option>
                        {programmes.map(p => <option key={p.programme_id} value={p.programme_id}>{p.programme_name}</option>)}
                    </select>
                    {selectedProg && (
                        <button
                            onClick={handleEvaluateAll}
                            disabled={evaluating}
                            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                            <span className="material-symbols-outlined text-base">play_arrow</span>
                            {evaluating ? 'Evaluating…' : 'Run Evaluation'}
                        </button>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex gap-6 mb-4 border-b border-gray-200">
                    {(['enrolled', 'eligible'] as const).map(t => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`pb-2.5 text-sm font-semibold capitalize transition-colors border-b-2 -mb-px ${tab === t
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-gray-400 hover:text-gray-700'
                                }`}
                        >
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Search + Filters + Export row */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 text-base">search</span>
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search by UUID (subject_id)..."
                            className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                        />
                    </div>
                    <button className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 bg-white hover:bg-gray-50 transition-colors">
                        <span className="material-symbols-outlined text-base">filter_list</span>
                        Filters
                    </button>
                    <button onClick={handleExportCSV} className="ml-auto flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 bg-white hover:bg-gray-50 transition-colors">
                        <span className="material-symbols-outlined text-base">download</span>
                        Export CSV
                    </button>
                </div>

                {/* Table */}
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    {/* Table header */}
                    <div className="grid grid-cols-12 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-100">
                        <span className="col-span-4">UUID (SUBJECT_ID)</span>
                        <span className="col-span-2">SCORE</span>
                        <span className="col-span-2">RULE VER</span>
                        <span className="col-span-2">STATUS</span>
                        <span className="col-span-1">EVALUATED AT</span>
                        <span className="col-span-1 text-right">ACTIONS</span>
                    </div>

                    <div className="divide-y divide-gray-50">
                        {!selectedProg ? (
                            <div className="py-16 text-center text-sm text-gray-400">Select a programme above to view beneficiaries.</div>
                        ) : loading ? (
                            [...Array(6)].map((_, i) => (
                                <div key={i} className="grid grid-cols-12 px-5 py-3 animate-pulse">
                                    <div className="col-span-4 h-4 bg-gray-100 rounded" />
                                    <div className="col-span-2 h-4 bg-gray-100 rounded" />
                                    <div className="col-span-2 h-4 bg-gray-100 rounded" />
                                    <div className="col-span-2 h-4 bg-gray-100 rounded" />
                                    <div className="col-span-1 h-4 bg-gray-100 rounded" />
                                </div>
                            ))
                        ) : filtered.length === 0 ? (
                            <div className="py-16 text-center text-sm text-gray-400">No beneficiaries found. Run an evaluation to generate results.</div>
                        ) : (
                            filtered.map(b => (
                                <div key={b.subject_id} className="grid grid-cols-12 px-5 py-3 items-center hover:bg-gray-50 transition-colors text-sm">
                                    <div className="col-span-4">
                                        <span className="text-blue-600 font-semibold font-mono text-xs">
                                            {b.subject_id.replace(/-/g, '').slice(0, 9).toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="col-span-2 font-bold text-gray-900">{b.calculated_score ?? '—'}</div>
                                    <div className="col-span-2 text-gray-500 text-xs">v2.4</div>
                                    <div className="col-span-2">
                                        <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
                                            <span className="material-symbols-outlined text-sm">check_circle</span>
                                            {b.status?.toUpperCase() || 'ELIGIBLE'}
                                        </span>
                                    </div>
                                    <div className="col-span-1 text-xs text-gray-400">
                                        {b.active_from ? new Date(b.active_from).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }) : b.created_at ? new Date(b.created_at).toLocaleDateString() : '—'}
                                    </div>
                                    <div className="col-span-1 flex justify-end">
                                        <button className="text-xs text-blue-600 font-semibold hover:underline">View Evaluation</button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
