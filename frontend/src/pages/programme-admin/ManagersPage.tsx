/**
 * ManagersPage — Manage programme-manager access per programme
 *
 * Uses Tailwind CSS to match the Family module styling system.
 */
import { useEffect, useState } from 'react'
import { useProgrammeStore } from '@/store/programmeStore'
import * as api from '@/services/programmeApi'
import type { ProgrammeManagerLink } from '@/types/programme'

interface ManagerUser {
    user_id: string
    email: string
}

export default function ManagersPage() {
    const { programmes, fetchProgrammes } = useProgrammeStore()
    const [selectedProgId, setSelectedProgId] = useState<string | null>(null)
    const [managers, setManagers] = useState<ProgrammeManagerLink[]>([])
    const [availableUsers, setAvailableUsers] = useState<ManagerUser[]>([])
    const [selectedUserId, setSelectedUserId] = useState('')
    const [loading, setLoading] = useState(false)
    const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

    useEffect(() => { fetchProgrammes() }, [fetchProgrammes])

    useEffect(() => {
        if (selectedProgId) loadManagers(selectedProgId)
    }, [selectedProgId])

    useEffect(() => {
        api.listProgrammeManagerUsers()
            .then(u => setAvailableUsers(u))
            .catch(() => setAvailableUsers([]))
    }, [])

    const loadManagers = async (progId: string) => {
        setLoading(true)
        try { setManagers(await api.getProgrammeManagers(progId)) }
        catch { setManagers([]) }
        finally { setLoading(false) }
    }

    const flash = (text: string, ok: boolean) => {
        setMsg({ text, ok })
        setTimeout(() => setMsg(null), 3000)
    }

    const addManager = async () => {
        if (!selectedProgId || !selectedUserId) return
        try {
            await api.addProgrammeManager(selectedProgId, selectedUserId)
            setSelectedUserId('')
            flash('Manager added successfully', true)
            loadManagers(selectedProgId)
        } catch (err) { flash((err as Error).message, false) }
    }

    const removeManager = async (userId: string) => {
        if (!selectedProgId) return
        if (!confirm('Remove this manager from the programme?')) return
        try {
            await api.removeProgrammeManager(selectedProgId, userId)
            loadManagers(selectedProgId)
        } catch (err) { alert((err as Error).message) }
    }

    const inpCls = 'w-full px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500'

    return (
        <div className="bg-gray-50 min-h-screen p-6 md:p-8">
            <div className="max-w-3xl mx-auto">
                <header className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Programme Managers</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Add or remove managers per programme. Managers can view and edit the programme.
                    </p>
                </header>

                {/* Programme selector */}
                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Select Programme
                    </label>
                    <select
                        value={selectedProgId || ''}
                        onChange={e => setSelectedProgId(e.target.value || null)}
                        className={inpCls}
                    >
                        <option value="">Choose a programme...</option>
                        {programmes.map(p => (
                            <option key={p.programme_id} value={p.programme_id}>
                                {p.programme_name} ({p.programme_code})
                            </option>
                        ))}
                    </select>
                </div>

                {selectedProgId && (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-gray-200">
                            <h2 className="font-semibold text-gray-900">Current Managers</h2>
                        </div>

                        {/* Flash */}
                        {msg && (
                            <div className={`mx-5 mt-4 px-4 py-2 rounded-lg text-sm font-medium ${msg.ok
                                ? 'bg-green-50 text-green-700 border border-green-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                                }`}>{msg.text}</div>
                        )}

                        <div className="p-5">
                            {loading ? (
                                <div className="flex items-center gap-2 text-gray-400">
                                    <span className="material-symbols-outlined animate-spin text-base">autorenew</span>
                                    Loading...
                                </div>
                            ) : managers.length === 0 ? (
                                <p className="text-sm text-gray-500 italic">
                                    No additional managers — the programme creator always has access.
                                </p>
                            ) : (
                                <div className="space-y-2 mb-5">
                                    {managers.map(m => (
                                        <div
                                            key={m.id}
                                            className="flex items-center justify-between py-2 border-b border-gray-100"
                                        >
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">{m.email || m.user_id}</p>
                                                <p className="text-xs text-gray-400">Added {new Date(m.created_at).toLocaleDateString()}</p>
                                            </div>
                                            <button
                                                onClick={() => removeManager(m.user_id)}
                                                className="text-xs px-3 py-1 rounded-lg border border-red-300 text-red-500 hover:bg-red-50 transition-colors"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Add manager */}
                            <div className="pt-4 border-t border-gray-200">
                                <p className="text-sm font-semibold text-gray-700 mb-2">Add Manager</p>
                                <div className="flex gap-2">
                                    <select
                                        value={selectedUserId}
                                        onChange={e => setSelectedUserId(e.target.value)}
                                        className={`flex-1 ${inpCls}`}
                                    >
                                        <option value="">Select a programme manager...</option>
                                        {availableUsers
                                            .filter(u => !managers.some(m => m.user_id === u.user_id))
                                            .map(u => (
                                                <option key={u.user_id} value={u.user_id}>
                                                    {u.email}
                                                </option>
                                            ))}
                                    </select>
                                    <button
                                        onClick={addManager}
                                        disabled={!selectedUserId}
                                        className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
