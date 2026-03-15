/**
 * features/index.js — programme-service feature aggregator
 *
 * Registers all feature route handlers onto the Express app.
 * api.js calls registerFeatures(app) once instead of importing
 * each Api class individually.
 */

import { ProgrammeApi }        from './programme/programmeApi.js'
import { RuleApi }             from './rule/ruleApi.js'
import { RuleGroupApi }        from './ruleGroup/ruleGroupApi.js'
import { VariableApi }         from './variable/variableApi.js'
import { CustomFieldApi }      from './customField/customFieldApi.js'
import { BeneficiaryApi }      from './beneficiary/beneficiaryApi.js'
import { EngineApi }           from './engine/engineApi.js'
import { AuditApi }            from './audit/auditApi.js'
import { ProgrammeManagerApi } from './programmeManager/programmeManagerApi.js'

/**
 * Mount all programme-service feature routes onto the Express app.
 * @param {import('express').Application} app
 * @param {{ connection?: object, redisClient?: object }} [options]
 */
export function registerFeatures(app, options = {}) {
  ProgrammeApi.register(app, options)         // GET/POST /api/v1/programmes/*
  RuleApi.register(app, options)              // GET/POST /api/v1/rules/*
  RuleGroupApi.register(app, options)         // GET/POST /api/v1/rule-groups/*
  VariableApi.register(app, options)          // GET/POST /api/v1/variables/*
  CustomFieldApi.register(app, options)       // GET/POST /api/v1/custom-fields/*
  BeneficiaryApi.register(app, options)       // GET/POST /api/v1/beneficiaries/*
  EngineApi.register(app, options)            // POST /api/v1/engine/*
  AuditApi.register(app, options)             // GET  /api/v1/audit/*
  ProgrammeManagerApi.register(app, options)  // GET/POST /api/v1/programme-managers/*
}
