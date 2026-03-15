import { BaseService }        from '../../../../base/baseService.js'
import { ProgrammeRepository } from './programmeRepository.js'

export class ProgrammeService extends BaseService {
  constructor(context) {
    super(context)
    this.programmeRepository = new ProgrammeRepository(context)
  }

  async list() {
    const allProgrammes = await this.programmeRepository.findAll()
    const canViewAll =
      this.hasPermission('ADMIN.PROGRAMMES.VIEW') ||
      this.hasPermission('PROGRAMME.PROGRAMMES.VIEW')
    if (canViewAll) {
      return allProgrammes
    }
    const userId     = this.getUserId()
    const managedIds = await this.programmeRepository.findManagedProgrammeIds(userId)
    return allProgrammes.filter(p => p.created_by === userId || managedIds.includes(p.programme_id))
  }

  async getById(programmeId) {
    return await this.programmeRepository.findById(programmeId)
  }

  async create(parsed) {
    const userId      = this.getUserId()
    const programmeId = ProgrammeService.generateUUID()

    await this.programmeRepository.createMaster({
      programme_id:   programmeId,
      programme_code: parsed.programme_code,
      programme_name: parsed.programme_name,
      description:    parsed.description,
      status:         'DRAFT',
      active_flag:    false,
      created_by:     userId,
      updated_by:     userId,
    })

    await this.programmeRepository.createConfig({
      programme_id:      programmeId,
      ranking_required:  parsed.ranking_required,
      quota_limit:       parsed.quota_limit,
      benefit_type:      parsed.benefit_type,
      benefit_frequency: parsed.benefit_frequency,
      effective_from:    parsed.effective_from,
      effective_to:      parsed.effective_to,
    })

    if (parsed.payment_frequency || parsed.payment_mode || parsed.total_budget_allocated) {
      await this.programmeRepository.createPaymentSettings({
        programme_id:           programmeId,
        payment_frequency:      parsed.payment_frequency,
        payment_mode:           parsed.payment_mode,
        total_budget_allocated: parsed.total_budget_allocated,
        currency:               parsed.currency,
        effective_from:         parsed.effective_from,
      })
    }

    await this.programmeRepository.addManager(programmeId, userId, userId)

    const programme = await this.programmeRepository.findByIdWithRelations(programmeId)
    await this.programmeRepository.recordHistory({
      programme_id: programmeId,
      change_type:  'CREATED',
      new_value:    programme,
      changed_by:   userId,
    })

    return programme
  }

  async update(programmeId, parsed) {
    const userId  = this.getUserId()
    const oldProg = await this.programmeRepository.findById(programmeId)
    const masterFields = { updated_by: userId, updated_at: new Date().toISOString() }
    if (parsed.programme_name)            {
      masterFields.programme_name = parsed.programme_name
    }
    if (parsed.description !== undefined) {
      masterFields.description    = parsed.description
    }

    await this.programmeRepository.updateMaster(programmeId, masterFields)

    const configFields = {}
    if (parsed.ranking_required !== undefined) {
      configFields.ranking_required = parsed.ranking_required
    }
    if (parsed.quota_limit       !== undefined) {
      configFields.quota_limit      = parsed.quota_limit
    }
    if (parsed.benefit_type)      {
      configFields.benefit_type      = parsed.benefit_type
    }
    if (parsed.benefit_frequency) {
      configFields.benefit_frequency = parsed.benefit_frequency
    }
    if (parsed.effective_from)    {
      configFields.effective_from    = parsed.effective_from
    }
    if (parsed.effective_to !== undefined)  {
      configFields.effective_to = parsed.effective_to
    }
    if (Object.keys(configFields).length > 0) {
      configFields.updated_at = new Date().toISOString()
      await this.programmeRepository.updateConfig(programmeId, configFields)
    }

    const updated = await this.programmeRepository.findByIdWithRelations(programmeId)
    await this.programmeRepository.recordHistory({
      programme_id: programmeId,
      change_type:  'UPDATED',
      old_value:    oldProg,
      new_value:    updated,
      changed_by:   userId,
    })
    return updated
  }

  async updateRulesTree(programmeId, rulesTree) {
    const userId = this.getUserId()
    await this.programmeRepository.updateMaster(programmeId, {
      rules_tree: rulesTree,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
  }

  async activate(programmeId) {
    const userId = this.getUserId()
    const prog   = await this.programmeRepository.findById(programmeId)
    if (!prog) {
      return { found: false }
    }
    if (prog.status === 'ACTIVE') {
      return { found: true, alreadyActive: true, data: prog }
    }
    const rules = prog.rules_tree?.rules
    if (!prog.rules_tree || (Array.isArray(rules) && rules.length === 0)) {
      return { found: true, alreadyActive: false, invalid: true }
    }

    await this.programmeRepository.updateMaster(programmeId, {
      status:      'ACTIVE',
      active_flag: true,
      updated_by:  userId,
      updated_at:  new Date().toISOString(),
    })

    const updated = await this.programmeRepository.findByIdWithRelations(programmeId)
    await this.programmeRepository.recordHistory({
      programme_id: programmeId,
      change_type:  'ACTIVATED',
      old_value:    prog,
      new_value:    updated,
      changed_by:   userId,
    })
    return { found: true, alreadyActive: false, invalid: false, data: updated }
  }

  async softDelete(programmeId) {
    const userId = this.getUserId()
    await this.programmeRepository.deactivate(programmeId, userId, new Date().toISOString())
  }
}
