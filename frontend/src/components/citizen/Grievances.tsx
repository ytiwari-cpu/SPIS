import { useState } from 'react'
import type { Grievance, GrievanceStatus, GrievanceType } from '@/types'

const mockGrievances: Grievance[] = [
  {
    id: 'grv_001',
    grievance_code: 'PRG-882910',
    programme_name: 'Rural Support',
    type: 'ELIGIBILITY_REVIEW' as GrievanceType,
    reason: 'I believe my family meets the eligibility criteria but was rejected.',
    supporting_remarks: null,
    status: 'UNDER_REVIEW' as GrievanceStatus,
    submitted_at: '2026-02-01T10:00:00Z',
    resolved_at: null,
    resolution_notes: null,
  },
  {
    id: 'grv_002',
    grievance_code: 'PRG-772102',
    programme_name: 'Health Grant',
    type: 'PAYMENT_DELAY' as GrievanceType,
    reason: 'Payment has been delayed for over 2 months.',
    supporting_remarks: 'Bank details are correct and verified.',
    status: 'RESOLVED' as GrievanceStatus,
    submitted_at: '2025-09-12T14:30:00Z',
    resolved_at: '2025-10-01T10:00:00Z',
    resolution_notes: 'Payment has been processed successfully.',
  },
]

const getStatusBadge = (status: GrievanceStatus) => {
  const styles = {
    SUBMITTED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    UNDER_REVIEW: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    RESOLVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    CLOSED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  }
  return styles[status]
}

const grievanceTypeLabels: Record<GrievanceType, string> = {
  REJECTION_APPEAL: 'Rejection Appeal',
  PAYMENT_DELAY: 'Payment Delay',
  INCORRECT_DETAILS: 'Incorrect Details',
  ELIGIBILITY_REVIEW: 'Eligibility Review',
  OTHER: 'Other',
}

export default function GrievancesContent() {
  const [grievances] = useState<Grievance[]>(mockGrievances)
  const [activeTab, setActiveTab] = useState<'existing' | 'new'>('existing')
  const [formData, setFormData] = useState({
    programme: '',
    type: '',
    reason: '',
    remarks: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // API call would go here
    alert('Grievance submitted successfully!')
    setFormData({ programme: '', type: '', reason: '', remarks: '' })
    setActiveTab('existing')
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Grievances & Appeals</h1>
        </header>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 rounded-t-xl">
          <div className="flex px-4 gap-8">
            <button
              onClick={() => setActiveTab('existing')}
              className={`flex flex-col items-center justify-center border-b-[3px] pb-3 pt-4 ${
                activeTab === 'existing'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 dark:text-gray-400'
              }`}
            >
              <p className="text-sm font-bold">Existing</p>
            </button>
            <button
              onClick={() => setActiveTab('new')}
              className={`flex flex-col items-center justify-center border-b-[3px] pb-3 pt-4 ${
                activeTab === 'new'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 dark:text-gray-400'
              }`}
            >
              <p className="text-sm font-bold">Raise New</p>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'existing' && (
          <div className="p-4 space-y-4 bg-white dark:bg-gray-900 rounded-b-xl border-x border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Existing Grievances</h3>
            
            {grievances.length === 0 ? (
              <div className="text-center py-12">
                <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-700 mb-4">
                  inbox
                </span>
                <p className="text-gray-500 dark:text-gray-400">No grievances found.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {grievances.map((grievance) => (
                  <div
                    key={grievance.id}
                    className="flex flex-col gap-3 bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="text-primary flex items-center justify-center rounded-lg bg-primary/10 shrink-0 size-10">
                          <span className="material-symbols-outlined">description</span>
                        </div>
                        <div>
                          <p className="text-gray-900 dark:text-white text-base font-bold">
                            {grievance.grievance_code}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">
                            {grievance.programme_name}
                          </p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 text-xs font-bold uppercase rounded ${getStatusBadge(grievance.status)}`}>
                        {grievance.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                      <div>
                        <p className="text-xs text-gray-400 uppercase font-bold">Type</p>
                        <p className="text-sm text-gray-900 dark:text-white">
                          {grievanceTypeLabels[grievance.type]}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase font-bold">Submitted</p>
                        <p className="text-sm text-gray-900 dark:text-white">
                          {new Date(grievance.submitted_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'new' && (
          <div className="p-4 bg-white dark:bg-gray-900 rounded-b-xl border-x border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Raise New Grievance</h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Programme</label>
                <select
                  value={formData.programme}
                  onChange={(e) => setFormData({ ...formData, programme: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-gray-900 dark:text-white"
                  required
                >
                  <option value="">Select a programme</option>
                  <option value="rural">Rural Support Scheme</option>
                  <option value="health">Health Grant 2026</option>
                  <option value="education">Education Subsidy</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Grievance Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-gray-900 dark:text-white"
                  required
                >
                  <option value="">Select grievance type</option>
                  <option value="REJECTION_APPEAL">Rejection Appeal</option>
                  <option value="PAYMENT_DELAY">Payment Delay</option>
                  <option value="INCORRECT_DETAILS">Incorrect Details</option>
                  <option value="OTHER">Others</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Reason for Grievance</label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-gray-900 dark:text-white resize-none"
                  placeholder="Describe your issue in detail..."
                  rows={4}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
                  Supporting Remarks (Optional)
                </label>
                <input
                  type="text"
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-gray-900 dark:text-white"
                  placeholder="Any additional information..."
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Supporting Documents</label>
                <button
                  type="button"
                  className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-6 bg-gray-50/50 dark:bg-gray-800/50 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <span className="material-symbols-outlined">upload_file</span>
                  <span className="text-sm font-medium">Click to upload documents</span>
                </button>
              </div>

              <button
                type="submit"
                className="w-full bg-primary text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 hover:bg-primary-dark transition-colors"
              >
                Submit Grievance
              </button>
            </form>

            <div className="mt-8 p-4 rounded-lg bg-primary/5 dark:bg-primary/10 border border-primary/20">
              <div className="flex gap-3">
                <span className="material-symbols-outlined text-primary shrink-0">info</span>
                <p className="text-xs text-primary/80 dark:text-primary/90 leading-relaxed italic">
                  Use this form if you were rejected for a programme and wish to appeal, or if you are
                  experiencing significant delays in payment processing.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
