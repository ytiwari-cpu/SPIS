/**
 * AdminProgrammesTable — SuperAdmin view of all programmes.
 *
 * Columns: ID/Name | Status | Coverage | Budget Utilization | Actions
 * Row click → Detail drawer slides in from right
 * Edit button → Full edit modal (name, desc, config, payment)
 * Permission-gated edit: shows "no permission" if ADMIN.PROGRAMMES.EDIT absent
 */

import { useEffect, useState, useMemo } from 'react'
import { getProgrammes, activateProgramme, updateProgramme } from '@/services/programmeApi'
import type { Programme } from '@/types/programme'
import { usePermissions } from '@/lib/auth'
import { Drawer, ActionButton } from '@/components/admin/shared'

// ── helpers ───────────────────────────────────────────────────────────────────

type BadgeVariant = 'success' | 'warning' | 'error' | 'ending' | 'default'

function statusVariant(status: string, effectiveTo?: string | null): BadgeVariant {
  const s = status?.toUpperCase()
  if (s === 'ACTIVE' && effectiveTo) {
    const daysLeft = (new Date(effectiveTo).getTime() - Date.now()) / 86_400_000
    if (daysLeft >= 0 && daysLeft <= 30) return 'ending'
  }
  switch (s) {
    case 'ACTIVE':   return 'success'
    case 'DRAFT':    return 'warning'
    case 'INACTIVE': return 'error'
    default:         return 'default'
  }
}

const variantClass: Record<BadgeVariant, string> = {
  success: 'bg-green-100  text-green-700',
  warning: 'bg-gray-100   text-gray-500',
  error:   'bg-red-100    text-red-600',
  ending:  'bg-orange-100 text-orange-600',
  default: 'bg-gray-100   text-gray-600',
}

const variantLabel: Record<BadgeVariant, string> = {
  success: 'ACTIVE',
  warning: 'DRAFT',
  error:   'INACTIVE',
  ending:  'ENDING SOON',
  default: 'UNKNOWN',
}

function StatusBadge({ status, effectiveTo }: Readonly<{ status: string; effectiveTo?: string | null }>) {
  const v = statusVariant(status, effectiveTo)
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wide ${variantClass[v]}`}>
      {variantLabel[v]}
    </span>
  )
}

// ── Coverage bar ──────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${Math.round(n / 1_000)}k`
  return String(n)
}

function CoverageBar({ enrolled, quota }: Readonly<{ enrolled: number; quota: number | null }>) {
  const pct = quota && quota > 0 ? Math.min(100, (enrolled / quota) * 100) : 0
  const barColor = pct >= 90 ? 'bg-orange-400' : 'bg-blue-500'
  return (
    <div className="space-y-1 min-w-0">
      <p className="text-sm font-bold text-gray-900 leading-tight">
        {fmt(enrolled)}
        {quota ? <span className="font-normal text-gray-400"> / {fmt(quota)}</span> : null}
      </p>
      <p className="text-xs text-gray-400">Enrolled / Eligible</p>
      {quota ? (
        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
      ) : null}
    </div>
  )
}

// ── Budget bar ────────────────────────────────────────────────────────────────

function fmtCurrency(n: number, currency = 'JMD'): string {
  if (n >= 1_000_000) return `${currency} ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${currency} ${Math.round(n / 1_000)}k`
  return `${currency} ${n}`
}

function BudgetBar({ total, currency }: Readonly<{ total: number | null | undefined; currency?: string | null }>) {
  if (!total) return <span className="text-sm text-gray-400">—</span>
  return (
    <div className="space-y-1 min-w-0">
      <p className="text-sm font-bold text-gray-900 leading-tight">{fmtCurrency(total, currency ?? 'JMD')}</p>
      <p className="text-xs text-gray-400">Total budget</p>
      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-blue-400" style={{ width: '100%' }} />
      </div>
    </div>
  )
}

// ── Skeleton rows ─────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {new Array(4).fill(null).map((_v, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <div key={`skel-${i}`} className="grid grid-cols-12 px-6 py-4 items-center gap-4 animate-pulse border-b border-gray-100 last:border-0">
          <div className="col-span-4 space-y-1.5">
            <div className="h-3.5 w-20 bg-gray-100 rounded" />
            <div className="h-4 w-40 bg-gray-100 rounded" />
            <div className="h-3 w-16 bg-gray-100 rounded" />
          </div>
          <div className="col-span-2"><div className="h-6 w-24 bg-gray-100 rounded-full" /></div>
          <div className="col-span-2 space-y-1.5">
            <div className="h-4 w-16 bg-gray-100 rounded" />
            <div className="h-1.5 w-full bg-gray-100 rounded-full" />
          </div>
          <div className="col-span-2 space-y-1.5">
            <div className="h-4 w-16 bg-gray-100 rounded" />
            <div className="h-1.5 w-full bg-gray-100 rounded-full" />
          </div>
          <div className="col-span-2 flex justify-end gap-2">
            <div className="h-7 w-14 bg-gray-100 rounded-lg" />
            <div className="h-7 w-20 bg-gray-100 rounded-lg" />
          </div>
        </div>
      ))}
    </>
  )
}

// ── Full Edit Modal ────────────────────────────────────────────────────────────

interface EditModalProps {
  readonly programme: Programme
  readonly canEdit: boolean
  readonly onClose: () => void
  readonly onSaved: () => void
}

function EditModal({ programme, canEdit, onClose, onSaved }: EditModalProps) {
  // master fields
  const [name, setName]   = useState(programme.programme_name)
  const [desc, setDesc]   = useState(programme.description ?? '')
  // config fields
  const cfg = programme.programme_config
  const [benefitType, setBenefitType]         = useState(cfg?.benefit_type ?? '')
  const [benefitFreq, setBenefitFreq]         = useState(cfg?.benefit_frequency ?? '')
  const [quotaLimit, setQuotaLimit]           = useState(cfg?.quota_limit?.toString() ?? '')
  const [rankingRequired, setRankingRequired] = useState(cfg?.ranking_required ?? false)
  const [effectiveFrom, setEffectiveFrom]     = useState(cfg?.effective_from ?? '')
  const [effectiveTo, setEffectiveTo]         = useState(cfg?.effective_to ?? '')
  // payment fields
  const pay = programme.programme_payment_settings
  const [payFreq, setPayFreq]       = useState(pay?.payment_frequency ?? '')
  const [payMode, setPayMode]       = useState(pay?.payment_mode ?? '')
  const [budget, setBudget]         = useState(pay?.total_budget_allocated?.toString() ?? '')
  const [currency, setCurrency]     = useState(pay?.currency ?? 'JMD')

  const [saving, setSaving] = useState(false)

  // No-permission view
  if (!canEdit) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 space-y-4 text-center">
          <span className="material-symbols-outlined text-5xl text-gray-300">lock</span>
          <h2 className="text-lg font-bold text-gray-800">No Edit Permission</h2>
          <p className="text-sm text-gray-500">
            You do not have <strong>ADMIN.PROGRAMMES.EDIT</strong> permission. Contact your administrator.
          </p>
          <button onClick={onClose} className="mt-2 px-6 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200">
            Close
          </button>
        </div>
      </div>
    )
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateProgramme(programme.programme_id, {
        programme_name:       name || undefined,
        description:          desc || undefined,
        benefit_type:         benefitType || undefined,
        benefit_frequency:    benefitFreq || undefined,
        quota_limit:          quotaLimit ? Number(quotaLimit) : undefined,
        ranking_required:     rankingRequired,
        effective_from:       effectiveFrom || undefined,
        effective_to:         effectiveTo || undefined,
        payment_frequency:    payFreq || undefined,
        payment_mode:         payMode || undefined,
        total_budget_allocated: budget ? Number(budget) : undefined,
        currency:             currency || undefined,
      })
      onSaved()
      onClose()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const input = "mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  const label = "text-xs font-semibold text-gray-500 uppercase tracking-wider block"
  const select = `${input} bg-white`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Edit Programme</h2>
            <p className="text-xs text-blue-600 font-mono">{programme.programme_code}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Body (scrollable) */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">

          {/* ── Basic Info ── */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Basic Information</h3>
            <div className="space-y-3">
              <div>
                <label htmlFor="ep-name" className={label}>Programme Name</label>
                <input id="ep-name" value={name} onChange={e => setName(e.target.value)} className={input} />
              </div>
              <div>
                <label htmlFor="ep-desc" className={label}>Description</label>
                <textarea id="ep-desc" value={desc} onChange={e => setDesc(e.target.value)} rows={3} className={`${input} resize-none`} />
              </div>
            </div>
          </section>

          {/* ── Configuration ── */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Programme Configuration</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="ep-bt" className={label}>Benefit Type</label>
                <select id="ep-bt" value={benefitType} onChange={e => setBenefitType(e.target.value)} className={select}>
                  <option value="">— Select —</option>
                  {['Cash', 'In-Kind', 'Hybrid', 'Service'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="ep-bf" className={label}>Benefit Frequency</label>
                <select id="ep-bf" value={benefitFreq} onChange={e => setBenefitFreq(e.target.value)} className={select}>
                  <option value="">— Select —</option>
                  {['Monthly', 'Quarterly', 'Annual', 'One-Time'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="ep-ql" className={label}>Quota Limit</label>
                <input id="ep-ql" type="number" min={0} value={quotaLimit} onChange={e => setQuotaLimit(e.target.value)} placeholder="No limit" className={input} />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={rankingRequired}
                    onChange={e => setRankingRequired(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />{' '}
                  Ranking Required
                </label>
              </div>
              <div>
                <label htmlFor="ep-ef" className={label}>Effective From</label>
                <input id="ep-ef" type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} className={input} />
              </div>
              <div>
                <label htmlFor="ep-et" className={label}>Effective To</label>
                <input id="ep-et" type="date" value={effectiveTo} onChange={e => setEffectiveTo(e.target.value)} className={input} />
              </div>
            </div>
          </section>

          {/* ── Payment Settings ── */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Payment Settings</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="ep-pf" className={label}>Payment Frequency</label>
                <select id="ep-pf" value={payFreq} onChange={e => setPayFreq(e.target.value)} className={select}>
                  <option value="">— Select —</option>
                  {['Monthly', 'Quarterly', 'Annual', 'One-Time'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="ep-pm" className={label}>Payment Mode</label>
                <select id="ep-pm" value={payMode} onChange={e => setPayMode(e.target.value)} className={select}>
                  <option value="">— Select —</option>
                  {['Bank Transfer', 'Mobile Money', 'Cheque', 'Cash', 'Voucher'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="ep-bud" className={label}>Total Budget Allocated</label>
                <input id="ep-bud" type="number" min={0} step={0.01} value={budget} onChange={e => setBudget(e.target.value)} placeholder="0.00" className={input} />
              </div>
              <div>
                <label htmlFor="ep-cur" className={label}>Currency</label>
                <select id="ep-cur" value={currency} onChange={e => setCurrency(e.target.value)} className={select}>
                  {['JMD', 'USD', 'GBP', 'EUR', 'CAD'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving || !name.trim()}
            className="px-5 py-2 text-sm rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Programme Detail Drawer ───────────────────────────────────────────────────

function DetailField({ label, value }: Readonly<{ label: string; value?: string | number | boolean | null }>) {
  if (value === null || value === undefined || value === '') return null
  let display: string
  if (typeof value === 'boolean') {
    display = value ? 'Yes' : 'No'
  } else {
    display = String(value)
  }
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-medium text-gray-900 mt-0.5">{display}</p>
    </div>
  )
}

function formatDate(d?: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })
}

interface ProgrammeDrawerProps {
  readonly programme: Programme | null
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly onEdit: (p: Programme) => void
  readonly onPublish: (p: Programme) => Promise<void>
  readonly onToggle: (p: Programme) => Promise<void>
  readonly busy: string | null
  readonly canEdit: boolean
}

function ProgrammeDrawer({ programme, isOpen, onClose, onEdit, onPublish, onToggle, busy, canEdit }: ProgrammeDrawerProps) {
  if (!programme) return null

  const cfg = programme.programme_config
  const pay = programme.programme_payment_settings
  const enrolled  = (programme as Programme & { enrollment_count?: number }).enrollment_count ?? 0
  const effectiveTo = cfg?.effective_to ?? null
  const isDraft   = programme.status?.toUpperCase() === 'DRAFT'
  const isActive  = programme.status?.toUpperCase() === 'ACTIVE'
  const isBusy    = busy === programme.programme_id

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Programme Details`}
      footer={
        <div className="flex items-center gap-2 flex-wrap">
          {canEdit && (
            <ActionButton
              onClick={() => { onEdit(programme); onClose() }}
              icon="edit"
              label="Edit"
              variant="primary"
            />
          )}
          {isDraft && (
            <ActionButton
              onClick={() => { void onPublish(programme); onClose() }}
              icon="publish"
              label={isBusy ? '…' : 'Publish'}
              variant="primary"
            />
          )}
          {!isDraft && (
            <ActionButton
              onClick={() => { void onToggle(programme); onClose() }}
              icon={isActive ? 'toggle_off' : 'toggle_on'}
              label={isBusy ? '…' : drawerToggleLabel(isActive)}
              variant={isActive ? 'danger' : 'primary'}
            />
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Status */}
        <div className="flex items-center gap-3">
          <StatusBadge status={programme.status} effectiveTo={effectiveTo} />
          <span className="text-xs font-mono text-blue-600 font-bold">{programme.programme_code}</span>
        </div>

        {/* Name + description */}
        <div>
          <h3 className="text-base font-bold text-gray-900">{programme.programme_name}</h3>
          {programme.description && (
            <p className="text-sm text-gray-500 mt-1">{programme.description}</p>
          )}
        </div>

        {/* Coverage */}
        <div>
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Coverage</h4>
          <div className="bg-gray-50 rounded-xl p-4">
            <CoverageBar enrolled={enrolled} quota={cfg?.quota_limit ?? null} />
          </div>
        </div>

        {/* Configuration */}
        {cfg && (
          <div>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Configuration</h4>
            <div className="grid grid-cols-2 gap-3">
              <DetailField label="Benefit Type"      value={cfg.benefit_type} />
              <DetailField label="Benefit Frequency" value={cfg.benefit_frequency} />
              <DetailField label="Quota Limit"       value={cfg.quota_limit ?? 'No limit'} />
              <DetailField label="Ranking Required"  value={cfg.ranking_required} />
              <DetailField label="Effective From"    value={formatDate(cfg.effective_from)} />
              <DetailField label="Effective To"      value={formatDate(cfg.effective_to) ?? '—'} />
            </div>
          </div>
        )}

        {/* Payment Settings */}
        {pay && (
          <div>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Payment Settings</h4>
            <div className="grid grid-cols-2 gap-3">
              <DetailField label="Payment Frequency" value={pay.payment_frequency} />
              <DetailField label="Payment Mode"      value={pay.payment_mode} />
              <DetailField label="Currency"          value={pay.currency} />
              <DetailField
                label="Total Budget"
                value={pay.total_budget_allocated
                  ? fmtCurrency(pay.total_budget_allocated, pay.currency ?? 'JMD')
                  : '—'}
              />
            </div>
          </div>
        )}

        {/* Timestamps */}
        <div>
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Timeline</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Created</span>
              <span className="text-gray-900">{formatDate(programme.created_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Last Updated</span>
              <span className="text-gray-900">{formatDate(programme.updated_at)}</span>
            </div>
          </div>
        </div>
      </div>
    </Drawer>
  )
}

// ── Row actions helpers ───────────────────────────────────────────────────────

function rowToggleLabel(isBusy: boolean, isActive: boolean): string {
  if (isBusy)   return '…'
  if (isActive) return 'Deactivate'
  return 'Activate'
}

function drawerToggleLabel(isActive: boolean): string {
  return isActive ? 'Deactivate' : 'Activate'
}

function publishBtnLabel(isBusy: boolean): string {
  return isBusy ? '…' : 'Publish'
}

// ── Table body ────────────────────────────────────────────────────────────────

interface TableBodyProps {
  readonly filtered:   Programme[]
  readonly busy:       string | null
  readonly search:     string
  readonly onRowClick: (p: Programme) => void
  readonly onEdit:     (p: Programme) => void
  readonly onPublish:  (p: Programme) => Promise<void>
  readonly onToggle:   (p: Programme) => Promise<void>
}

function TableBody({ filtered, busy, search, onRowClick, onEdit, onPublish, onToggle }: TableBodyProps) {
  if (filtered.length === 0) {
    const msg = search ? 'No programmes match your search.' : 'No programmes found.'
    return <div className="py-20 text-center text-sm text-gray-400">{msg}</div>
  }

  return (
    <div className="divide-y divide-gray-100">
      {filtered.map(p => {
        const isDraft    = p.status?.toUpperCase() === 'DRAFT'
        const isActive   = p.status?.toUpperCase() === 'ACTIVE'
        const isBusy     = busy === p.programme_id
        const enrolled   = (p as Programme & { enrollment_count?: number }).enrollment_count ?? 0
        const quota      = p.programme_config?.quota_limit ?? null
        const budget     = p.programme_payment_settings?.total_budget_allocated
        const currency   = p.programme_payment_settings?.currency
        const effectiveTo = p.programme_config?.effective_to ?? null
        const benefitType = p.programme_config?.benefit_type

        return (
          <button
            key={p.programme_id}
            type="button"
            className="w-full grid grid-cols-12 px-6 py-4 items-center gap-4 hover:bg-blue-50/40 cursor-pointer transition-colors text-left"
            onClick={() => onRowClick(p)}
          >
            {/* ID / Name */}
            <div className="col-span-4 min-w-0">
              <p className="text-xs font-bold text-blue-600 tracking-wide mb-0.5">{p.programme_code}</p>
              <p className="text-sm font-semibold text-gray-900 truncate">{p.programme_name}</p>
              {benefitType && (
                <p className="text-xs text-gray-400 mt-0.5">Benefit: {benefitType}</p>
              )}
            </div>

            {/* Status */}
            <div className="col-span-2">
              <StatusBadge status={p.status} effectiveTo={effectiveTo} />
            </div>

            {/* Coverage */}
            <div className="col-span-2">
              <CoverageBar enrolled={enrolled} quota={quota} />
            </div>

            {/* Budget Utilization */}
            <div className="col-span-2">
              <BudgetBar total={budget} currency={currency} />
            </div>

            {/* Actions — stop propagation so row click doesn't fire */}
            <div
              role="none"
              className="col-span-2 flex items-center justify-end gap-1.5 flex-wrap"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => onEdit(p)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
                title="Edit"
              >
                <span className="material-symbols-outlined text-sm leading-none">edit</span>
                {' '}Edit
              </button>

              {isDraft && (
                <button
                  onClick={() => void onPublish(p)}
                  disabled={isBusy}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  title="Publish"
                >
                  {publishBtnLabel(isBusy)}
                </button>
              )}

              {!isDraft && (
                <button
                  onClick={() => void onToggle(p)}
                  disabled={isBusy}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors ${
                    isActive
                      ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                      : 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                  }`}
                  title={isActive ? 'Deactivate' : 'Activate'}
                >
                  <span className="material-symbols-outlined text-sm leading-none">
                    {isActive ? 'toggle_off' : 'toggle_on'}
                  </span>
                  {' '}{rowToggleLabel(isBusy, isActive)}
                </button>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminProgrammesTableContent() {
  const { hasPermission } = usePermissions()
  const canEdit = hasPermission('ADMIN.PROGRAMMES.EDIT')

  const [programmes, setProgrammes]     = useState<Programme[]>([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [editing, setEditing]           = useState<Programme | null>(null)
  const [busy, setBusy]                 = useState<string | null>(null)
  // drawer
  const [drawerOpen, setDrawerOpen]     = useState(false)
  const [selectedProg, setSelectedProg] = useState<Programme | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await getProgrammes()
      setProgrammes(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return programmes.filter(p =>
      !q ||
      p.programme_name.toLowerCase().includes(q) ||
      (p.programme_code || '').toLowerCase().includes(q)
    )
  }, [programmes, search])

  const handleRowClick = (p: Programme) => {
    setSelectedProg(p)
    setDrawerOpen(true)
  }

  const handlePublish = async (p: Programme) => {
    if (!confirm(`Publish "${p.programme_name}"?`)) return
    setBusy(p.programme_id)
    try {
      await activateProgramme(p.programme_id)
      await load()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const handleToggleActive = async (p: Programme) => {
    const next = p.status?.toUpperCase() === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    if (!confirm(`Set "${p.programme_name}" to ${next}?`)) return
    setBusy(p.programme_id)
    try {
      await updateProgramme(p.programme_id, { status: next })
      await load()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="p-6 md:p-8 min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Programmes</h1>
            <p className="text-sm text-gray-500 mt-0.5">Overview of all social protection programmes.</p>
          </div>

          <div className="relative w-full sm:w-72">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-base">search</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search programmes…"
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Table card */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          {/* Column headers */}
          <div className="grid grid-cols-12 px-6 py-3 gap-4 text-xs font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
            <span className="col-span-4">ID / Name</span>
            <span className="col-span-2">Status</span>
            <span className="col-span-2">Coverage</span>
            <span className="col-span-2">Budget Utilization</span>
            <span className="col-span-2 text-right">Actions</span>
          </div>

          {loading
            ? <SkeletonRows />
            : <TableBody
                filtered={filtered}
                busy={busy}
                search={search}
                onRowClick={handleRowClick}
                onEdit={p => setEditing(p)}
                onPublish={handlePublish}
                onToggle={handleToggleActive}
              />
          }
        </div>
      </div>

      {/* Detail Drawer */}
      <ProgrammeDrawer
        programme={selectedProg}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onEdit={p => { setDrawerOpen(false); setEditing(p) }}
        onPublish={handlePublish}
        onToggle={handleToggleActive}
        busy={busy}
        canEdit={canEdit}
      />

      {/* Full Edit Modal */}
      {editing && (
        <EditModal
          programme={editing}
          canEdit={canEdit}
          onClose={() => setEditing(null)}
          onSaved={() => void load()}
        />
      )}
    </div>
  )
}
