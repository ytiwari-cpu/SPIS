/**
 * Programme Dashboard — Real data only, no mock values
 *
 * Layout:
 *   • Metric cards computed from real programme + beneficiary data
 *   • Programme Overview table with status + Publish action for DRAFT
 *   • System Activity Log sidebar
 */
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useProgrammeStore } from '@/store/programmeStore'
import * as api from '@/services/programmeApi'

// ── Metric Card ──────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, icon }: { label: string; value: string | number; sub?: string; icon: string }) {
    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-start justify-between">
            <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">{label}</p>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
            </div>
            <span className="material-symbols-outlined text-gray-300 text-2xl mt-0.5">{icon}</span>
        </div>
    )
}

// ── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
        ACTIVE: 'text-green-700 bg-green-100',
        DRAFT: 'text-amber-700 bg-amber-100',
        INACTIVE: 'text-gray-500 bg-gray-100',
    }
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded uppercase ${map[status] ?? map.INACTIVE}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status === 'ACTIVE' ? 'bg-green-500' : status === 'DRAFT' ? 'bg-amber-500' : 'bg-gray-400'}`} />
            {status}
        </span>
    )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function ProgrammeDashboardPage() {
    const { programmes, beneficiaries, auditLogs, loading, fetchProgrammes, fetchBeneficiaries, fetchAuditLogs } = useProgrammeStore()

    useEffect(() => {
        fetchProgrammes()
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // Fetch beneficiaries + audit logs for the first programme when available
    useEffect(() => {
        if (programmes.length > 0) {
            fetchBeneficiaries(programmes[0].programme_id)
            fetchAuditLogs(programmes[0].programme_id)
        }
    }, [programmes]) // eslint-disable-line react-hooks/exhaustive-deps

    // ── Real computed metrics ────────────────────────────────────────────
    const totalActive = programmes.filter(p => p.active_flag || p.status === 'ACTIVE').length
    const totalDraft = programmes.filter(p => p.status === 'DRAFT').length
    const enrolled = beneficiaries.filter(b => b.status === 'Active').length
    const eligible = beneficiaries.filter(b => b.calculated_score != null && b.calculated_score > 0).length

    const handlePublish = async (programmeId: string) => {
        try {
            await api.activateProgramme(programmeId)
            fetchProgrammes()
        } catch (e) {
            alert((e as Error).message)
        }
    }

    return (
        <div className="bg-gray-50 min-h-screen p-6 md:p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Programme Dashboard</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Overview of programme performance and activity.</p>
                </div>

                {/* Metric cards — real data only */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <MetricCard label="Total Programmes" value={programmes.length} sub={`${totalActive} active, ${totalDraft} draft`} icon="verified_user" />
                    <MetricCard label="Enrolled" value={enrolled} sub="active beneficiaries" icon="people" />
                    <MetricCard label="Eligible" value={eligible} sub="score > 0" icon="check_circle" />
                    <MetricCard label="Total Beneficiaries" value={beneficiaries.length} sub="across all statuses" icon="group_add" />
                </div>

                {/* Main content — 2-column layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Programme Overview Table — 2 cols */}
                    <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-blue-500 text-lg">list_alt</span>
                                <h2 className="font-bold text-gray-800">Programme Overview</h2>
                            </div>
                            <Link to="/programme-admin/programmes" className="text-xs text-blue-600 font-semibold hover:underline">
                                View All →
                            </Link>
                        </div>

                        {/* Table header */}
                        <div className="grid grid-cols-12 px-5 py-2.5 border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            <div className="col-span-4">Programme</div>
                            <div className="col-span-2">Status</div>
                            <div className="col-span-2">Beneficiaries</div>
                            <div className="col-span-2">Ranking</div>
                            <div className="col-span-2 text-right">Actions</div>
                        </div>

                        {/* Table body */}
                        {loading ? (
                            <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
                        ) : programmes.length === 0 ? (
                            <div className="py-12 text-center text-sm text-gray-400">No programmes yet.</div>
                        ) : (
                            programmes.slice(0, 8).map(p => {
                                const status = p.status || (p.active_flag ? 'ACTIVE' : 'INACTIVE')
                                const isDraft = status === 'DRAFT'
                                const quotaLimit = p.programme_config?.quota_limit
                                const rankingRequired = p.programme_config?.ranking_required
                                return (
                                    <div key={p.programme_id} className="grid grid-cols-12 px-5 py-3 items-center hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                                        <div className="col-span-4">
                                            <p className="font-semibold text-gray-900 text-sm">{p.programme_name}</p>
                                            <p className="text-xs text-gray-400 font-mono">{p.programme_code}</p>
                                        </div>
                                        <div className="col-span-2">
                                            <StatusBadge status={status} />
                                        </div>
                                        <div className="col-span-2 text-sm text-gray-600">
                                            {quotaLimit ? `${quotaLimit.toLocaleString()} limit` : '—'}
                                        </div>
                                        <div className="col-span-2">
                                            {rankingRequired ? (
                                                <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Enabled</span>
                                            ) : (
                                                <span className="text-xs text-gray-400">Disabled</span>
                                            )}
                                        </div>
                                        <div className="col-span-2 flex justify-end gap-2">
                                            {isDraft && (
                                                <button
                                                    onClick={() => handlePublish(p.programme_id)}
                                                    className="text-xs px-3 py-1 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors"
                                                >
                                                    Publish
                                                </button>
                                            )}
                                            <Link
                                                to={`/programme-admin/programmes`}
                                                className="text-xs text-blue-600 font-semibold hover:underline"
                                            >
                                                View
                                            </Link>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>

                    {/* System Activity Log — 1 col */}
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-gray-500 text-lg">history</span>
                                <h2 className="font-bold text-gray-800">System Activity Log</h2>
                            </div>
                            <Link to="/programme-admin/audit-logs" className="text-xs text-blue-600 font-semibold hover:underline">
                                View All →
                            </Link>
                        </div>

                        <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
                            {auditLogs.length === 0 ? (
                                <div className="py-12 text-center text-sm text-gray-400">No activity yet.</div>
                            ) : (
                                auditLogs.slice(0, 10).map((log, i) => (
                                    <div key={log.history_id ?? i} className="px-5 py-3">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="text-sm font-semibold text-gray-700">{log.change_type}</p>
                                                <p className="text-xs text-gray-400 mt-0.5">
                                                    {log.changed_by ?? 'System'} · {log.changed_at ? new Date(log.changed_at).toLocaleString() : '—'}
                                                </p>
                                            </div>
                                            <span className="text-xs text-blue-600 font-semibold cursor-pointer hover:underline">View</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
