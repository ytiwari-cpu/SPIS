/**
 * COMMON PROGRAMME
 *
 * One template, one data-fetch strategy per mode.
 * The JSX is identical regardless of who is viewing — only the programmes
 * array differs:
 *
 *   admin  → getProgrammes()           (all programmes)
 *   citizen → enrolled programmes only (cross-ref with beneficiaries)
 *   detail  → getProgramme(id)         (single programme)
 */

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { usePermissions, SECTION_PREFIXES } from '@/lib/auth'
import { useAuthStore } from '@/store/authStore'
import {
  getProgrammes,
  getProgramme,
  getSubjectEnrollments,
} from '@/services/programmeApi'
import type { Programme, Beneficiary, BeneficiaryWithProgramme } from '@/types/programme'
import { PageHeader, SearchInput, Badge } from '@/components/admin/shared'
import ActiveArchiveTabs from '@/components/common/ActiveArchiveTabs'

export type ProgrammeMode = 'admin' | 'citizen' | 'detail'
export interface CommonProgrammeProps { mode?: ProgrammeMode }

// ─── Helpers ──────────────────────────────────────────────────────────────────

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary'

function statusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'ACTIVE':  case 'Active':  return 'success'
    case 'DRAFT':   case 'Pending': return 'warning'
    case 'INACTIVE':case 'Exited':  return 'error'
    case 'Suspended': return 'info'
    default: return 'default'
  }
}

function fmt(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export function resolveProgrammeMode(
  hasPrefix: (p: string) => boolean,
  programmeId?: string,
): ProgrammeMode {
  if (programmeId) return 'detail'
  if (hasPrefix(SECTION_PREFIXES.Administration)) return 'admin'
  return 'citizen'
}

// ─── Row type: programme + optional enrollment ────────────────────────────────

interface ProgrammeRow {
  programme: Programme
  enrollment: Beneficiary | undefined
}

// ─── Card (list view) ─────────────────────────────────────────────────────────

function ProgrammeCard({ row, onClick }: { row: ProgrammeRow; onClick: () => void }) {
  const { programme, enrollment } = row
  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
    >
      <div className="flex items-start gap-4">
        <div className="size-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
          <span className={`material-symbols-outlined ${programme.active_flag ? 'text-primary' : 'text-gray-400'}`}>
            verified_user
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">{programme.programme_name}</h3>
              <p className="text-xs text-gray-400 font-mono mt-0.5">{programme.programme_code}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={statusVariant(programme.status)}>{programme.status}</Badge>
              {enrollment && (
                <Badge variant={statusVariant(enrollment.status)}>
                  {enrollment.status}
                </Badge>
              )}
            </div>
          </div>
          {programme.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 line-clamp-2">
              {programme.description}
            </p>
          )}
        </div>
      </div>

      {programme.programme_config && (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Benefit Type</p>
            <p className="text-sm text-gray-900 dark:text-white mt-1">{programme.programme_config.benefit_type}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Frequency</p>
            <p className="text-sm text-gray-900 dark:text-white mt-1">{programme.programme_config.benefit_frequency}</p>
          </div>
          {programme.programme_config.effective_from && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Effective From</p>
              <p className="text-sm text-gray-900 dark:text-white mt-1">{fmt(programme.programme_config.effective_from)}</p>
            </div>
          )}
          {enrollment?.active_from && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Enrolled From</p>
              <p className="text-sm text-gray-900 dark:text-white mt-1">{fmt(enrollment.active_from)}</p>
            </div>
          )}
          {enrollment?.approved_at && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Approved</p>
              <p className="text-sm text-gray-900 dark:text-white mt-1">{fmt(enrollment.approved_at)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Detail view ──────────────────────────────────────────────────────────────

function ProgrammeDetail({ row, onBack }: { row: ProgrammeRow; onBack: () => void }) {
  const { programme, enrollment } = row
  return (
    <div className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <PageHeader
          title={programme.programme_name}
          subtitle={programme.programme_code}
          breadcrumb={[
            { label: 'Programmes', href: '#' },
            { label: programme.programme_name },
          ]}
          actions={
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">arrow_back</span>
              Back
            </button>
          }
        />

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-6">
          {/* Status badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={statusVariant(programme.status)}>{programme.status}</Badge>
            <Badge variant={programme.active_flag ? 'success' : 'default'}>
              {programme.active_flag ? 'Active' : 'Inactive'}
            </Badge>
            {enrollment && (
              <Badge variant={statusVariant(enrollment.status)}>{enrollment.status}</Badge>
            )}
          </div>

          {/* Description */}
          {programme.description && (
            <p className="text-gray-600 dark:text-gray-400">{programme.description}</p>
          )}

          {/* Config grid — same fields for everyone */}
          {programme.programme_config && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-4 border-t border-gray-100 dark:border-gray-800">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Benefit Type</p>
                <p className="text-gray-900 dark:text-white">{programme.programme_config.benefit_type}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Frequency</p>
                <p className="text-gray-900 dark:text-white">{programme.programme_config.benefit_frequency}</p>
              </div>
              {programme.programme_config.effective_from && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Effective From</p>
                  <p className="text-gray-900 dark:text-white">{fmt(programme.programme_config.effective_from)}</p>
                </div>
              )}
              {programme.programme_config.effective_to && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Effective To</p>
                  <p className="text-gray-900 dark:text-white">{fmt(programme.programme_config.effective_to)}</p>
                </div>
              )}
              {programme.programme_config.quota_limit !== null && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Quota Limit</p>
                  <p className="text-gray-900 dark:text-white">
                    {programme.programme_config.quota_limit?.toLocaleString() ?? 'Unlimited'}
                  </p>
                </div>
              )}
              {/* Enrollment fields — shown when present, hidden when absent */}
              {enrollment?.active_from && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Enrolled From</p>
                  <p className="text-gray-900 dark:text-white">{fmt(enrollment.active_from)}</p>
                </div>
              )}
              {enrollment?.active_till && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Enrolled Until</p>
                  <p className="text-gray-900 dark:text-white">{fmt(enrollment.active_till)}</p>
                </div>
              )}
              {enrollment?.approved_at && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Approved</p>
                  <p className="text-gray-900 dark:text-white">{fmt(enrollment.approved_at)}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function CommonProgramme({ mode: modeProp }: CommonProgrammeProps = {}) {
  const { hasPrefix } = usePermissions()
  const { session } = useAuthStore()
  const params = useParams<{ programmeId?: string }>()
  const programmeId = params.programmeId
  const mode = modeProp ?? resolveProgrammeMode(hasPrefix, programmeId)

  const [rows, setRows] = useState<ProgrammeRow[]>([])
  const [selected, setSelected] = useState<ProgrammeRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const load = async () => {
      try {
        let programmes: Programme[] = []
        let enrollments: Beneficiary[] = []

        if (mode === 'detail' && programmeId) {
          programmes = [await getProgramme(programmeId)]
        } else if (mode === 'admin') {
          programmes = await getProgrammes()
        } else {
          // citizen — fetch only MY enrollments, with programme data embedded.
          // We never call getProgrammes() here — citizens don't have access to
          // the admin listing endpoint and shouldn't be hitting it.
          const familyUuid = session?.familyUUID
          if (familyUuid) {
            const myEnrollments: BeneficiaryWithProgramme[] = await getSubjectEnrollments(familyUuid)
            programmes = myEnrollments.map(e => e.programme)
            enrollments = myEnrollments
          }
        }

        if (!cancelled) {
          // Merge into rows — same shape for everyone
          const merged: ProgrammeRow[] = programmes.map(p => ({
            programme: p,
            enrollment: enrollments.find(e => e.programme_id === p.programme_id),
          }))
          setRows(merged)
          if (mode === 'detail' && merged.length > 0) setSelected(merged[0])
        }
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load programmes')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [mode, programmeId, session?.familyUUID]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => rows.filter(({ programme: p }) => {
    const matchesArchive = showArchived ? !p.active_flag : p.active_flag
    const matchesSearch = !searchQuery ||
      p.programme_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.programme_code.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesArchive && matchesSearch
  }), [rows, showArchived, searchQuery])

  // ── Detail ─────────────────────────────────────────────────────────────────
  if (selected) {
    return <ProgrammeDetail row={selected} onBack={() => setSelected(null)} />
  }

  // ── List ───────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <PageHeader
          title="Programmes"
          subtitle={loading ? 'Loading…' : `${filtered.length} programme${filtered.length !== 1 ? 's' : ''}`}
          actions={
            <ActiveArchiveTabs
              isArchived={showArchived}
              onToggle={(v) => { setShowArchived(v); setSearchQuery('') }}
              activeLabel="Active"
              archivedLabel="Inactive"
            />
          }
        />

        <div className="mb-6">
          <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search by name or code…" />
        </div>

        {loading && (
          <div className="text-center py-16">
            <div className="animate-spin size-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Loading programmes…</p>
          </div>
        )}

        {!loading && error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
            <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-700">folder_off</span>
            <p className="mt-4 text-gray-500 dark:text-gray-400">No programmes found.</p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="space-y-4">
            {filtered.map(row => (
              <ProgrammeCard
                key={row.programme.programme_id}
                row={row}
                onClick={() => setSelected(row)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
