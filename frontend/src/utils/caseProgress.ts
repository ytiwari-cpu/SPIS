/**
 * CASE PROGRESS UTILITIES
 * 
 * Utility functions for calculating case progress based on status.
 * 
 * PROGRESS DEFINITION:
 * Since our Case model uses statuses (not explicit steps), we map status to progress:
 * - OPEN: 0% (case just opened, no work started)
 * - IN_PROGRESS: 40% (actively being worked on)
 * - PENDING_REVIEW: 70% (awaiting review/approval)
 * - ON_HOLD: 25% (paused, minimal progress)
 * - COMPLETED: 100% (fully done)
 * - CLOSED: 100% (archived/closed)
 * 
 * OVERDUE DEFINITION (server time):
 * A case is overdue if: status is NOT completed/closed AND dueDate < now
 */

import type { Case, CaseStatus } from '@/mock/superAdminMockData'

/**
 * Maps case status to progress percentage.
 * Progress is derived from workflow status since our model doesn't have explicit steps.
 */
export function getStatusProgress(status: CaseStatus): number {
  switch (status) {
    case 'OPEN': return 0
    case 'IN_PROGRESS': return 40
    case 'PENDING_REVIEW': return 70
    case 'ON_HOLD': return 25
    case 'COMPLETED': return 100
    case 'CLOSED': return 100
    default: return 0
  }
}

/**
 * Check if a case is overdue.
 * A case is overdue if status is not completed/closed AND dueDate < now.
 */
export function isCaseOverdue(caseItem: Pick<Case, 'status' | 'dueDate'>): boolean {
  if (caseItem.status === 'COMPLETED' || caseItem.status === 'CLOSED') return false
  if (!caseItem.dueDate) return false
  return new Date(caseItem.dueDate) < new Date()
}

/**
 * Calculate cases statistics from a list of cases.
 */
export function calculateCasesStats(cases: Case[]): {
  total: number
  completed: number
  pending: number
  overdue: number
  completionRatio: number
  statusCounts: Record<CaseStatus, number>
} {
  const total = cases.length
  const completed = cases.filter(c => c.status === 'COMPLETED' || c.status === 'CLOSED').length
  const pending = cases.filter(c => c.status !== 'COMPLETED' && c.status !== 'CLOSED').length
  const overdue = cases.filter(c => isCaseOverdue(c)).length
  const completionRatio = total > 0 ? Math.round((completed / total) * 100) : 0

  const statusCounts: Record<CaseStatus, number> = {
    OPEN: 0,
    IN_PROGRESS: 0,
    PENDING_REVIEW: 0,
    ON_HOLD: 0,
    COMPLETED: 0,
    CLOSED: 0,
  }
  cases.forEach(c => {
    statusCounts[c.status]++
  })

  return { total, completed, pending, overdue, completionRatio, statusCounts }
}
