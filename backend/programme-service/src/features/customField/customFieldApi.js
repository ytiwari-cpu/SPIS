import { z } from 'zod'
import { ApiSchema } from '../../../../base/apiSchema.js'
import { CustomFieldController } from './customFieldController.js'
import { requireAuth } from '../../../../base/middleware/requireAuth.js'

const auth = requireAuth()

const TargetTableSchema = z.enum(['family', 'family_member', 'address', 'house_services'])
const IdParams          = z.object({ id: z.string().uuid() })

// ─── Endpoints ───────────────────────────────────────────────────────────────
const list = {
  path:       '/',
  verb:       'GET',
  handler:    { controller: CustomFieldController, method: 'list', arguments: [] },
  middleware: [auth],
  permission: { anyOf: ['ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.RULES.VIEW'] },
}

const listByTable = {
  path:       '/table/:table',
  verb:       'GET',
  handler:    { controller: CustomFieldController, method: 'listByTable', arguments: ['request:params'] },
  middleware: [auth],
  permission: { anyOf: ['ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.RULES.VIEW'] },
  request:    { params: z.object({ table: TargetTableSchema }) },
}

const create = {
  path:       '/',
  verb:       'POST',
  handler:    { controller: CustomFieldController, method: 'create', arguments: ['request:body', 'user'] },
  middleware: [auth],
  permission: { anyOf: ['ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.RULES.MANAGE'] },
  request:    {
    body: z.object({
      display_name:  z.string().min(1).max(255),
      target_table:  TargetTableSchema,
      data_type:     z.enum(['text', 'number', 'boolean', 'date', 'enum']),
      enum_values:   z.array(z.string().max(255)).max(100).optional(),
      is_required:   z.boolean().optional().default(false),
      default_value: z.string().max(500).optional(),
      description:   z.string().max(2000).optional(),
    }),
  },
}

const update = {
  path:       '/:id',
  verb:       'PATCH',
  handler:    { controller: CustomFieldController, method: 'update', arguments: ['request:params', 'request:body', 'user'] },
  middleware: [auth],
  permission: { anyOf: ['ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.RULES.MANAGE'] },
  request:    {
    params: IdParams,
    body:   z.object({
      display_name: z.string().min(1).max(255).optional(),
      description:  z.string().max(2000).optional(),
      enum_values:  z.array(z.string().max(255)).max(100).optional(),
    }),
  },
}

const deleteField = {
  path:       '/:id',
  verb:       'DELETE',
  handler:    { controller: CustomFieldController, method: 'delete', arguments: ['request:params'] },
  middleware: [auth],
  permission: { anyOf: ['ADMIN.PROGRAMMES.ARCHIVE', 'PROGRAMME.RULES.MANAGE'] },
  request:    { params: IdParams },
}

export const CustomFieldApi = new ApiSchema({
  name:      'CustomField',
  url:       '/api/v1/custom-fields',
  endpoints: [list, listByTable, create, update, deleteField],
})
