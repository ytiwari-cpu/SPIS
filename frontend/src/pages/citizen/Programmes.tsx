import { useState } from 'react'
import type { Programme, ProgrammeStatus } from '@/types'

const mockProgrammes: Programme[] = [
  {
    id: 'prog_001',
    name: 'Food Security Subsidy',
    description: 'Monthly food assistance programme for eligible families.',
    icon: 'restaurant',
    status: 'APPROVED' as ProgrammeStatus,
    enrolled_members: ['Arjun Sharma', 'Priya Sharma', 'Rahul Sharma', 'Ananya Sharma'],
    effective_from: '2025-01-01',
    effective_to: '2026-12-31',
  },
  {
    id: 'prog_002',
    name: 'Education Grant',
    description: 'Educational support for school-going children.',
    icon: 'school',
    status: 'IN_PROGRESS' as ProgrammeStatus,
    enrolled_members: ['Rahul Sharma', 'Ananya Sharma'],
    effective_from: null,
    effective_to: null,
  },
  {
    id: 'prog_003',
    name: 'Healthcare Subsidy',
    description: 'Medical expense coverage for family members.',
    icon: 'health_and_safety',
    status: 'ELIGIBLE' as ProgrammeStatus,
    enrolled_members: [],
    effective_from: null,
    effective_to: null,
  },
  {
    id: 'prog_004',
    name: 'Housing Assistance',
    description: 'Support for housing repairs and rent assistance.',
    icon: 'home',
    status: 'REJECTED' as ProgrammeStatus,
    enrolled_members: [],
    effective_from: null,
    effective_to: null,
  },
]

type TabType = 'eligible' | 'approved' | 'in_progress' | 'rejected'

const tabs: { key: TabType; label: string; status: ProgrammeStatus }[] = [
  { key: 'eligible', label: 'Eligible', status: 'ELIGIBLE' },
  { key: 'approved', label: 'Approved', status: 'APPROVED' },
  { key: 'in_progress', label: 'In Progress', status: 'IN_PROGRESS' },
  { key: 'rejected', label: 'Rejected', status: 'REJECTED' },
]

const getStatusBadge = (status: ProgrammeStatus) => {
  const styles = {
    ELIGIBLE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    APPROVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    IN_PROGRESS: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    WITHDRAWN: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  }
  return styles[status]
}

const getIconColor = (status: ProgrammeStatus) => {
  const colors = {
    ELIGIBLE: 'text-blue-600',
    APPROVED: 'text-green-600',
    IN_PROGRESS: 'text-amber-600',
    REJECTED: 'text-red-600',
    WITHDRAWN: 'text-gray-600',
  }
  return colors[status]
}

export default function Programmes() {
  const [activeTab, setActiveTab] = useState<TabType>('approved')
  const [programmes] = useState<Programme[]>(mockProgrammes)

  const filteredProgrammes = programmes.filter((p) => {
    const currentTab = tabs.find((t) => t.key === activeTab)
    return currentTab && p.status === currentTab.status
  })

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Programmes</h1>
        </header>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-6">
          {tabs.map((tab) => {
            const count = programmes.filter((p) => p.status === tab.status).length
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${
                  activeTab === tab.key
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {tab.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.key
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
            <p className="text-gray-500 dark:text-gray-400">No programmes in this category.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredProgrammes.map((programme) => (
              <div
                key={programme.id}
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm"
              >
                <div className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={`size-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0`}>
                      <span className={`material-symbols-outlined ${getIconColor(programme.status)}`}>
                        {programme.icon}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-gray-900 dark:text-white">{programme.name}</h3>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase shrink-0 ${getStatusBadge(programme.status)}`}>
                          {programme.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {programme.description}
                      </p>
                    </div>
                  </div>

                  {programme.enrolled_members.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                        Enrolled Members
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {programme.enrolled_members.map((member, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs text-gray-700 dark:text-gray-300"
                          >
                            {member}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {programme.effective_from && (
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                          Effective From
                        </p>
                        <p className="text-sm text-gray-900 dark:text-white mt-1">
                          {new Date(programme.effective_from).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      {programme.effective_to && (
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                            Effective To
                          </p>
                          <p className="text-sm text-gray-900 dark:text-white mt-1">
                            {new Date(programme.effective_to).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 text-sm font-semibold text-primary hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  View Details
                  <span className="material-symbols-outlined text-lg">chevron_right</span>
                </button>
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
                Click on any eligible programme to apply or view details.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
