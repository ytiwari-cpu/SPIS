/**
 * CITIZEN PROGRAMMES PAGE
 *
 * Shows real programmes fetched from the programme-service API.
 * Citizens see all available programmes with their active status.
 */

import { useState, useEffect } from 'react'
import { getProgrammes } from '@/services/programmeApi'
import type { Programme } from '@/types/programme'

type TabType = 'all' | 'active' | 'inactive'

const tabs: { key: TabType; label: string }[] = [
  { key: 'all', label: 'All Programmes' },
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Inactive' },
]

export default function Programmes() {
  const [activeTab, setActiveTab] = useState<TabType>('all')
  const [programmes, setProgrammes] = useState<Programme[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getProgrammes()
      .then(data => setProgrammes(data))
      .catch(err => setError(err.message || 'Failed to load programmes'))
      .finally(() => setLoading(false))
  }, [])

  const filteredProgrammes = programmes.filter(p => {
    if (activeTab === 'active') return p.active_flag
    if (activeTab === 'inactive') return !p.active_flag
    return true
  })

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <div className="max-w-3xl mx-auto text-center py-16">
          <div className="animate-spin size-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-500">Loading programmes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Programmes</h1>
          <span className="text-sm text-gray-500">{programmes.length} total</span>
        </header>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-6">
          {tabs.map((tab) => {
            const count = tab.key === 'all'
              ? programmes.length
              : tab.key === 'active'
                ? programmes.filter(p => p.active_flag).length
                : programmes.filter(p => !p.active_flag).length
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === tab.key
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
              >
                {tab.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.key
                    ? 'bg-white/20'
                    : 'bg-gray-200 dark:bg-gray-700'
                  }`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Programme Cards */}
        {filteredProgrammes.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
            <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-700 mb-4">
              folder_off
            </span>
            <p className="text-gray-500 dark:text-gray-400">No programmes found.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredProgrammes.map((programme) => (
              <div
                key={programme.programme_id}
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm"
              >
                <div className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="size-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                      <span className={`material-symbols-outlined ${programme.active_flag ? 'text-green-600' : 'text-gray-400'}`}>
                        verified_user
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-bold text-gray-900 dark:text-white">{programme.programme_name}</h3>
                          <p className="text-xs text-gray-400 font-mono mt-0.5">{programme.programme_code}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase shrink-0 ${programme.active_flag
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                          }`}>
                          {programme.active_flag ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      {programme.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                          {programme.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Config details */}
                  {programme.programme_config && (
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Benefit Type</p>
                        <p className="text-sm text-gray-900 dark:text-white mt-1">
                          {programme.programme_config.benefit_type}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Frequency</p>
                        <p className="text-sm text-gray-900 dark:text-white mt-1">
                          {programme.programme_config.benefit_frequency}
                        </p>
                      </div>
                      {programme.programme_config.effective_from && (
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Effective From</p>
                          <p className="text-sm text-gray-900 dark:text-white mt-1">
                            {new Date(programme.programme_config.effective_from).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', year: 'numeric',
                            })}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info Banner */}
        <div className="mt-8 p-4 rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/20">
          <div className="flex gap-3">
            <span className="material-symbols-outlined text-primary shrink-0">info</span>
            <div>
              <p className="text-sm font-semibold text-primary mb-1">Programme Enrollment</p>
              <p className="text-xs text-primary/80 dark:text-primary/90 leading-relaxed">
                Eligible programmes are automatically identified based on your family profile.
                Contact your case worker for more information about programme enrollment.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
