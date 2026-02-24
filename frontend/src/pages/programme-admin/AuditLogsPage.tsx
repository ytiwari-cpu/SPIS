/**
 * Audit Logs Page — Matches wireframe:
 * System Audit Logs table with ACTION TYPE / PROGRAMME ID / CHANGED BY / CHANGED AT / ACTIONS
 * Export Logs button
 */
import { useEffect } from 'react'
import { useProgrammeStore } from '@/store/programmeStore'

export default function AuditLogsPage() {
    const { programmes, auditLogs, fetchProgrammes, fetchAuditLogs, loading } = useProgrammeStore()

    useEffect(() => {
        fetchProgrammes()
        // Load all audit logs for the first programme
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (programmes.length > 0) fetchAuditLogs(programmes[0].programme_id)
    }, [programmes]) // eslint-disable-line react-hooks/exhaustive-deps

    const handleExport = () => {
        if (!auditLogs.length) return
        const rows = [
            ['Action Type', 'Programme ID', 'Changed By', 'Changed At'],
            ...auditLogs.map(l => [l.change_type || 'RULE MODIFIED', l.programme_id || '', l.changed_by || '', l.changed_at || ''])
        ]
        const csv = rows.map(r => r.join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = 'audit-logs.csv'
        a.click()
    }

    return (
        <div className="bg-gray-50 min-h-screen p-6 md:p-8">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Manage and monitor audit logs for the National Social Protection System.</p>
                </div>

                {/* Table */}
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
                        <h2 className="text-sm font-semibold text-gray-800">System Audit Logs</h2>
                        <button onClick={handleExport} className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors">
                            <span className="material-symbols-outlined text-base">download</span>
                            Export Logs
                        </button>
                    </div>

                    {/* Table header */}
                    <div className="grid grid-cols-12 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-100">
                        <span className="col-span-3">ACTION TYPE</span>
                        <span className="col-span-3">PROGRAMME ID</span>
                        <span className="col-span-2">CHANGED BY</span>
                        <span className="col-span-2">CHANGED AT</span>
                        <span className="col-span-2 text-right">ACTIONS</span>
                    </div>

                    <div className="divide-y divide-gray-50">
                        {loading ? (
                            [...Array(4)].map((_, i) => (
                                <div key={i} className="grid grid-cols-12 px-5 py-3.5 animate-pulse">
                                    {[3, 3, 2, 2, 2].map((span, j) => (
                                        <div key={j} className={`col-span-${span} h-4 bg-gray-100 rounded`} />
                                    ))}
                                </div>
                            ))
                        ) : auditLogs.length === 0 ? (
                            <div className="py-16 text-center text-sm text-gray-400">No audit logs yet.</div>
                        ) : (
                            auditLogs.map((log, i) => (
                                <div key={log.history_id ?? i} className="grid grid-cols-12 px-5 py-3.5 items-center hover:bg-gray-50 transition-colors text-sm">
                                    <div className="col-span-3">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-700">{log.change_type || 'RULE MODIFIED'}</span>
                                    </div>
                                    <div className="col-span-3 font-mono text-xs text-blue-600">{log.programme_id || '—'}</div>
                                    <div className="col-span-2 text-sm text-gray-600">{log.changed_by || '—'}</div>
                                    <div className="col-span-2 text-xs text-gray-400">
                                        {log.changed_at ? new Date(log.changed_at).toLocaleString() : '—'}
                                    </div>
                                    <div className="col-span-2 flex justify-end">
                                        <button className="text-xs text-blue-600 font-semibold hover:underline">View Details</button>
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
