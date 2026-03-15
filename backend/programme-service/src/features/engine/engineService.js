import { BaseService }     from '../../../../base/baseService.js'
import { EngineRepository } from './engineRepository.js'
import { evaluateSubject, evaluateAllSubjects } from '../../services/ruleEngine.js'

export class EngineService extends BaseService {
  constructor(context) {
    super(context)
    this.engineRepository = new EngineRepository(context)
    // Programme + family connections for batch evaluation
    this.connections = {
      programme: context.connection,
      family:    context.extras?.familyConnection ?? null,
    }
  }

  async evaluate(programmeId, subjectId, subjectType) {
    const result = await evaluateSubject(programmeId, subjectId, subjectType)
    await this.engineRepository.upsertResult({
      programme_id:     programmeId,
      subject_id:       result.subject_id,
      subject_type:     result.subject_type,
      calculated_score: result.calculated_score,
      group_scores:     result.group_scores,
      status:           result.eligible ? 'Active' : 'Pending',
    })
    return result
  }

  async evaluateAll(programmeId) {
    const results = await evaluateAllSubjects(programmeId, this.connections)
    const records = results.map(r => ({
      programme_id:     programmeId,
      subject_id:       r.subject_id,
      subject_type:     r.subject_type,
      calculated_score: r.calculated_score,
      group_scores:     r.group_scores,
      status:           r.eligible ? 'Active' : 'Pending',
    }))
    await this.engineRepository.upsertResults(records)
    return {
      total_evaluated: results.length,
      eligible:        results.filter(r => r.eligible).length,
      ineligible:      results.filter(r => !r.eligible).length,
      results,
    }
  }

  async impactAnalysis(programmeId) {
    const results = await evaluateAllSubjects(programmeId, this.connections)
    return {
      total_families:      results.length,
      would_be_eligible:   results.filter(r => r.eligible).length,
      would_be_ineligible: results.filter(r => !r.eligible).length,
      average_score:       results.length > 0
        ? results.reduce((sum, r) => sum + r.calculated_score, 0) / results.length
        : 0,
    }
  }
}
