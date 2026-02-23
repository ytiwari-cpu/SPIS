/**
 * Payments Page — Matches wireframe:
 * 4 metric cards + Recent Payment Cycles table with status badges
 */
import { useState } from 'react'

const MOCK_CYCLES = [
    { id: 'CYC-2024-001', programme: 'National Cash Transfer', period: 'Jan 2024', amount: '$12.5M', recipients: '45,000', status: 'COMPLETED' },
    { id: 'CYC-2024-002', programme: 'Disability Support', period: 'Jan 2024', amount: '$4.2M', recipients: '12,500', status: 'PROCESSING' },
    { id: 'CYC-2024-003', programme: 'Elderly Pension', period: 'Jan 2024', amount: '$8.8M', recipients: '32,000', status: 'PENDING APPROVAL' },
]

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
        COMPLETED: 'bg-green-100 text-green-700 border-green-200',
        PROCESSING: 'bg-blue-100 text-blue-700 border-blue-200',
        'PENDING APPROVAL': 'bg-orange-100 text-orange-700 border-orange-200',
    }
    return (
        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded border ${map[status] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
            {status}
        </span>
    )
}

export default function PaymentsPage() {
    const [showModal, setShowModal] = useState(false)

    const metrics = [
        { label: 'Total Disbursed', value: '$47.2M', sub: '↗ +12.5% from last cycle', subColor: 'text-green-600', icon: 'credit_card' },
        { label: 'Pending Batch', value: '$2.4M', sub: '3 batches awaiting approval', subColor: 'text-orange-500', icon: 'schedule' },
        { label: 'Failed TXNs', value: '1,240', sub: '0.8% failure rate', subColor: 'text-red-500', icon: 'error_outline' },
        { label: 'Active Cycles', value: '12', sub: 'Next cycle in 4 days', subColor: 'text-gray-400', icon: 'history' },
    ]

    return (
        <div className="bg-gray-50 min-h-screen p-6 md:p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Manage and monitor payments for the National Social Protection System.</p>
                </div>

                {/* Metric cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {metrics.map(m => (
                        <div key={m.label} className="bg-white border border-gray-200 rounded-lg p-4 flex items-start justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">{m.label}</p>
                                <p className="text-2xl font-bold text-gray-900">{m.value}</p>
                                <p className={`text-xs mt-0.5 ${m.subColor}`}>{m.sub}</p>
                            </div>
                            <span className={`material-symbols-outlined text-xl mt-0.5 ${m.subColor}`}>{m.icon}</span>
                        </div>
                    ))}
                </div>

                {/* Recent Payment Cycles */}
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
                        <h2 className="text-sm font-semibold text-gray-800">Recent Payment Cycles</h2>
                        <button
                            onClick={() => setShowModal(true)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <span className="material-symbols-outlined text-base">add</span>
                            New Payment Cycle
                        </button>
                    </div>

                    {/* Table header */}
                    <div className="grid grid-cols-12 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-100">
                        <span className="col-span-2">CYCLE ID</span>
                        <span className="col-span-3">PROGRAMME</span>
                        <span className="col-span-2">PERIOD</span>
                        <span className="col-span-2">AMOUNT</span>
                        <span className="col-span-1">RECIPIENTS</span>
                        <span className="col-span-1">STATUS</span>
                        <span className="col-span-1 text-right">ACTIONS</span>
                    </div>

                    <div className="divide-y divide-gray-50">
                        {MOCK_CYCLES.map(c => (
                            <div key={c.id} className="grid grid-cols-12 px-5 py-4 items-center hover:bg-gray-50 transition-colors text-sm">
                                <div className="col-span-2">
                                    <span className="text-blue-600 font-semibold font-mono text-xs">{c.id}</span>
                                </div>
                                <div className="col-span-3 font-semibold text-gray-800">{c.programme}</div>
                                <div className="col-span-2 text-gray-500">{c.period}</div>
                                <div className="col-span-2 font-semibold text-gray-900">{c.amount}</div>
                                <div className="col-span-1 text-gray-600">{c.recipients}</div>
                                <div className="col-span-1"><StatusBadge status={c.status} /></div>
                                <div className="col-span-1 flex justify-end">
                                    <button className="text-gray-400 hover:text-blue-600 transition-colors">
                                        <span className="material-symbols-outlined text-lg">description</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* New Payment Cycle Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
                        <div className="flex items-center justify-between p-5 border-b border-gray-200">
                            <h3 className="font-semibold text-gray-900">New Payment Cycle</h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-700">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Programme</label>
                                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    <option>National Cash Transfer</option>
                                    <option>Disability Support</option>
                                    <option>Elderly Pension</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Period</label>
                                <input type="month" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Amount (USD)</label>
                                <input type="number" placeholder="0.00" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 px-5 pb-5">
                            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
                            <button onClick={() => setShowModal(false)} className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">Create Cycle</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
