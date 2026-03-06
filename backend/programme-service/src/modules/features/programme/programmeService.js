import { BaseService }        from '../../../../../base/baseService.js'
import { ProgrammeRepository } from './programmeRepository.js'

export class ProgrammeService extends BaseService {
  constructor(repo) {
    super(repo.context)
    this.repo = repo
  }

  async list() {
    const allProgrammes = await this.repo.findAll()
    const canViewAll =
      this.hasPermission('ADMIN.PROGRAMMES.VIEW') ||
      this.hasPermission('PROGRAMME.PROGRAMMES.VIEW')
    if (canViewAll) return allProgrammes
    const userId     = this.getUserId()
    const managedIds = await this.repo.findManagedProgrammeIds(userId)
    return allProgrammes.filter(p => p.created_by === userId || managedIds.includes(p.programme_id))
  }

  async getById(programmeId) { return this.repo.findById(programmeId) }

  async create(parsed) {
    const userId = this.getUserId()
    const programme = await this.repo.createMaster({
      programme_code: parsed.programme_code,
      programme_name: parsed.programme_name,
      description:    parsed.description,
      status:         'DRAFT',
      active_flag:    false,
      created_by:     userId,
      updated_by:     userId,
    })
    const programmeId = programme.programme_id
    await this.repo.createConfig({
      programme_id:      programmeId,
      ranking_required:  parsed.ranking_required,
      quota_limit:       parsed.quota_limit,
      benefit_type:      parsed.benefit_type,
      benefit_frequency: parsed.benefit_frequency,
      effective_from:    parsed.effective_from,
      effective_to:      parsed.effective_to,
    })
    if (parsed.payment_frequency || parsed.payment_mode || parsed.total_budget_allocated) {
      await this.repo.createPaymentSettings({
        programme_id:           programmeId,
        payment_frequency:      parsed.payment_frequency,
        payment_mode:           parsed.payment_mode,
        total_budget_allocated: parsed.total_budget_allocated,
        currency:               parsed.currency,
        effective_from:         parsed.effective_from,
      })
    }
    await this.repo.addManager(programmeId, userId, userId)
    await this.repo.recordHistory({
      programme_id: programmeId,
      change_type:  'CREATED',
      new_value:    programme,
      changed_by:   userId,
    })
    return this.repo.findByIdWithRelations(programmeId)
  }

  async update(programmeId, parsed) {
    const userId  = this.getUserId()
    const oldProg = await this.repo.findById(programmeId)
    const masterFields = { updated_by: userId, updated_at: new Date().toISOString() }
    if (parsed.programme_name)        masterFields.programme_name = parsed.programme_name
    if (parsed.description !== undefined) masterFields.description = parsed.description
    const updated = await this.repo.updateMaster(programmeId, masterFields)
    const configFields = {}
    if (parsed.ranking_required !== undefined) configFields.ranking_required = parsed.ranking_required
    if (parsed.quota_limit       !== undefined) configFields.quota_limit      = parsed.quota_limit
    if (parsed.benefit_type)      configFields.benefit_type      = parsed.benefit_type
    if (parsed.benefit_frequency) configFields.benefit_frequency = parsed.benefit_frequency
    if (parsed.effective_from)    configFields.effective_from    = parsed.effective_from
    if (parsed.effective_to !== undefined)  configFields.effective_to = parsed.effective_to
    if (Object.keys(configFields).length > 0) {
      configFields.updated_at = new Date().toISOString()
      await this.repo.updateConfig(programmeId, configFields)
    }
    await this.repo.recordHistory({
      programme_id: programmeId,
      change_type:  'UPDATED',
      old_value:    oldProg,
      new_value:    updated,
      changed_by:   userId,
    })
    return this.repo.findByIdWithRelations(programmeId)
  }

  async updateRulesTree(programmeId, rulesTree) {
    const userId = this.getUserId()
    return this.repo.updateMaster(programmeId, {
      rules_tree: rulesTree,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
  }

  async activate(programmeId) {
    const userId = this.getUserId()
    const prog   = await this.repo.findById(programmeId)
    if (!prog) return { found: false }
    if (prog.status === 'ACTIVE') return { found: true, alreadyActive: true, data: prog }
    const rules = prog.rules_tree?.rules
    if (!prog.rules_tree || (Array.isArray(rules) && rules.length === 0)) {
      return { found: true, alreadyActive: false, invalid: true }
    }
    const updated = await this.repo.updateMaster(programmeId, {
      status:      'ACTIVE',
      active_flag: true,
      updated_by:  userId,
      updated_at:  new Date().toISOString(),
    })
    await this.repo.recordHistory({
      programme_id: programmeId,
      change_type:  'ACTIVATED',
      old_value:    prog,
      new_value:    updated,
      changed_by:   userId,
    })
    const full = await this.repo.findByIdWithRelations(programmeId)
    return { found: true, alreadyActive: false, invalid: false, data: full }
  }

  async softDelete(programmeId) {
    const userId = this.getUserId()
    await this.repo.deactivate(programmeId, userId)
  }
}
