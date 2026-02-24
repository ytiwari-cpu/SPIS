/**
 * Reports Page — Matches wireframe:
 * 4 report type cards (with icon + description + Generate Report link)
 * + REPORT FILTERS section (Programme, Date Range, Status)
 */
import { useProgrammeStore } from '@/store/programmeStore'
import { useEffect } from 'react'

const REPORT_TYPES = [
    {
        icon: 'group',
        title: 'Enrollment Report',
        desc: 'Detailed breakdown of beneficiary enrollment by programme and period.',
        active: false,
    },
    {
        icon: 'bar_chart',
        title: 'Budget Utilization',
        desc: 'Analysis of allocated vs utilized budget across all active programmes.',
        active: false,
    },
    {
        icon: 'layers',
        title: 'Geo Distribution',
        desc: 'Beneficiary distribution mapped by administrative geo codes.',
        active: true,
    },
    {
        icon: 'verified_user',
        title: 'Rule Performance',
        desc: 'Evaluation of eligibility rule effectiveness and exclusion rates.',
        active: false,
    },
]

export default function ReportsPageContent() {
    const { programmes, fetchProgrammes } = useProgrammeStore()
    useEffect(() => { fetchProgrammes() }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const handleGenerate = (title: string) => {
        alert(`Generating "${title}" report… (Connect to report API)`)
    }

    return (
        <div className="bg-gray-50 min-h-screen p-6 md:p-8">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Manage and monitor reports for the National Social Protection System.</p>
                </div>

                {/* Report type cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {REPORT_TYPES.map(r => (
                        <div
                            key={r.title}
                            className={`bg-white border rounded-lg p-5 flex flex-col gap-3 hover:shadow-sm transition-shadow ${r.active ? 'border-blue-300 ring-1 ring-blue-100' : 'border-gray-200'}`}
                        >
                            <span className={`material-symbols-outlined text-2xl ${r.active ? 'text-blue-600' : 'text-gray-500'}`}>{r.icon}</span>
                            <div>
                                <p className="font-semibold text-gray-900 text-sm">{r.title}</p>
                                <p className="text-xs text-gray-500 mt-1 leading-snug">{r.desc}</p>
                            </div>
                            <button
                                onClick={() => handleGenerate(r.title)}
                                className="flex items-center gap-0.5 text-xs font-semibold text-blue-600 hover:underline mt-auto"
                            >
                                Generate Report
                                <span className="material-symbols-outlined text-sm">chevron_right</span>
                            </button>
                        </div>
                    ))}
                </div>

                {/* Report Filters */}
                <div className="bg-white border border-gray-200 rounded-lg p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Report Filters</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Programme</label>
                            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700">
                                <option value="">All Programmes</option>
                                {programmes.map(p => <option key={p.programme_id} value={p.programme_id}>{p.programme_name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Date Range</label>
                            <div className="flex items-center gap-2">
                                <input type="date" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700" />
                                <input type="date" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Status</label>
                            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700">
                                <option value="">All Statuses</option>
                                <option>Active</option>
                                <option>Inactive</option>
                                <option>Draft</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end mt-4">
                        <button className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                            Apply Filters
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
