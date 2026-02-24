import { ApiSchema } from '../../../../base/apiSchema.js'
import { RuleGroupController } from './ruleGroupController.js'
import { requireAuth, requirePermission } from '../../middleware/requireAuth.js'

const list = {
  path:       '/',
  verb:       'GET',
  handler:    { controller: RuleGroupController, method: 'list' },
  middleware: [requireAuth, requirePermission('ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.RULES.VIEW')],
}

const get = {
  path:       '/:id',
  verb:       'GET',
  handler:    { controller: RuleGroupController, method: 'get' },
  middleware: [requireAuth, requirePermission('ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.RULES.VIEW')],
}

const create = {
  path:       '/',
  verb:       'POST',
  handler:    { controller: RuleGroupController, method: 'create' },
  middleware: [requireAuth, requirePermission('ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.RULES.MANAGE')],
}

const update = {
  path:       '/:id',
  verb:       'PATCH',
  handler:    { controller: RuleGroupController, method: 'update' },
  middleware: [requireAuth, requirePermission('ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.RULES.MANAGE')],
}

const deleteGroup = {
  path:       '/:id',
  verb:       'DELETE',
  handler:    { controller: RuleGroupController, method: 'delete' },
  middleware: [requireAuth, requirePermission('ADMIN.PROGRAMMES.ARCHIVE', 'PROGRAMME.RULES.MANAGE')],
}

const addSubRule = {
  path:       '/:id/rules',
  verb:       'POST',
  handler:    { controller: RuleGroupController, method: 'addSubRule' },
  middleware: [requireAuth, requirePermission('ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.RULES.MANAGE')],
}

const removeSubRule = {
  path:       '/:groupId/rules/:ruleId',
  verb:       'DELETE',
  handler:    { controller: RuleGroupController, method: 'removeSubRule' },
  middleware: [requireAuth, requirePermission('ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.RULES.MANAGE')],
}

export const RuleGroupApi = new ApiSchema({
  name:      'RuleGroup',
  url:       '/api/v1/rule-groups',
  endpoints: [list, get, create, update, deleteGroup, addSubRule, removeSubRule],
})
