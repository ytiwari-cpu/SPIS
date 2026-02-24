import { useState } from 'react'
import type { Benefit, BenefitType, BenefitStatus } from '@/types'

const mockBenefits: Benefit[] = [
  {
    id: 'ben_001',
    programme_name: 'Social Security Housing',
    beneficiary_name: 'Arjun Sharma',
    type: 'CASH' as BenefitType,
    amount: 1200,
    item_description: null,
    status: 'ISSUED' as BenefitStatus,
    issued_at: '2026-01-12T10:00:00Z',
    failure_reason: null,
  },
  {
    id: 'ben_002',
    programme_name: 'Child Care Subsidy',
    beneficiary_name: 'Ananya Sharma',
    type: 'IN_KIND' as BenefitType,
    amount: null,
    item_description: 'Health Voucher',
    status: 'PENDING' as BenefitStatus,
    issued_at: null,
    failure_reason: null,
  },
  {
    id: 'ben_003',
    programme_name: 'Education Grant',
    beneficiary_name: 'Rahul Sharma',
    type: 'CASH' as BenefitType,
    amount: 500,
    item_description: null,
    status: 'FAILED' as BenefitStatus,
    issued_at: null,
    failure_reason: 'Bank account verification failed. Please update your profile.',
  },
  {
    id: 'ben_004',
    programme_name: 'Food Security Subsidy',
    beneficiary_name: 'Arjun Sharma',
    type: 'CASH' as BenefitType,
    amount: 2500,
    item_description: null,
    status: 'ISSUED' as BenefitStatus,
    issued_at: '2025-12-15T10:00:00Z',
    failure_reason: null,
  },
]

const getStatusBadge = (status: BenefitStatus) => {
  const styles = {
    ISSUED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  }
  return styles[status]
}

export default function BenefitsContent() {
  const [benefits] = useState<Benefit[]>(mockBenefits)

  const totalCash = benefits
    .filter((b) => b.status === 'ISSUED' && b.type === 'CASH' && b.amount)
    .reduce((sum, b) => sum + (b.amount || 0), 0)

  const pendingCount = benefits.filter((b) => b.status === 'PENDING').length

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Benefits Received</h1>
        </header>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="flex flex-col gap-2 rounded-xl p-5 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Total Cash</p>
            <p className="text-gray-900 dark:text-white text-2xl font-bold">₹{totalCash.toLocaleString()}</p>
          </div>
          <div className="flex flex-col gap-2 rounded-xl p-5 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Pending</p>
            <p className="text-gray-900 dark:text-white text-2xl font-bold">{pendingCount} Item{pendingCount !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Benefits List */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Detailed History</h2>
            <button className="text-primary font-semibold text-sm">Filter</button>
          </div>

          <div className="flex flex-col gap-3">
            {benefits.map((benefit) => (
              <div
                key={benefit.id}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm"
              >
                <div className="p-4 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                        Programme Name
                      </p>
                      <p className="font-bold text-gray-900 dark:text-white">{benefit.programme_name}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${getStatusBadge(benefit.status)}`}>
                      {benefit.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-y-3">
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Beneficiary</p>
                      <p className="text-sm text-gray-900 dark:text-white">{benefit.beneficiary_name}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Type</p>
                      <p className="text-sm text-gray-900 dark:text-white">
                        {benefit.type === 'CASH' ? 'Cash' : benefit.type === 'IN_KIND' ? 'In-Kind' : 'Voucher'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        {benefit.type === 'CASH' ? 'Amount' : 'Item'}
                      </p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                        {benefit.type === 'CASH' && benefit.amount
                          ? `₹${benefit.amount.toLocaleString()}`
                          : benefit.item_description || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Date</p>
                      <p className="text-sm text-gray-900 dark:text-white">
                        {benefit.issued_at
                          ? new Date(benefit.issued_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : benefit.status === 'PENDING'
                          ? 'Processing'
                          : 'Failed'}
                      </p>
                    </div>
                  </div>
                </div>

                {benefit.status === 'FAILED' && benefit.failure_reason && (
                  <div className="px-4 py-3 bg-red-50 dark:bg-red-900/10 border-t border-red-100 dark:border-red-900/20 text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
                    <span className="material-symbols-outlined text-sm">error</span>
                    <span>{benefit.failure_reason}</span>
                  </div>
                )}

                {benefit.status === 'ISSUED' && (
                  <button className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 text-xs font-semibold text-gray-500 hover:text-primary transition-colors">
                    <span>Payment Distribution Details</span>
                    <span className="material-symbols-outlined text-sm">expand_more</span>
                  </button>
                )}

                {benefit.status === 'PENDING' && (
                  <button className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 text-xs font-semibold text-gray-500">
                    <span>View Approval Timeline</span>
                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
