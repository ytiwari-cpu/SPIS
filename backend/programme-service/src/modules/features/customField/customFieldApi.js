import { z } from 'zod'
import { ApiSchema } from '../../../../../base/apiSchema.js'
import { CustomFieldController } from './customFieldController.js'
import { requireAuth } from '../../../../../base/middleware/requireAuth.js'

// ─── Inline Zod Schemas ─────────────────────────────────────────────────────
export const createCustomFieldSchema = z.object({
  display_name:  z.string().min(1).max(255),
  target_table:  z.enum(['family', 'family_member', 'address', 'house_services']),
  data_type:     z.enum(['text', 'number', 'boolean', 'date', 'enum']),
  enum_values:   z.array(z.string()).optional(),
  is_required:   z.boolean().optional().default(false),
  default_value: z.string().optional(),
  description:   z.string().optional(),
})

export const updateCustomFieldSchema = z.object({
  display_name: z.string().min(1).max(255).optional(),
  description:  z.string().optional(),
  enum_values:  z.array(z.string()).optional(),
})

// ─── Auth ────────────────────────────────────────────────────────────────────
const auth = requireAuth()

// ─── Endpoints ───────────────────────────────────────────────────────────────
const list = {
  path:       '/',
  verb:       'GET',
  handler:    { controller: CustomFieldController, method: 'list' },
  middleware: [auth],
  permissionsAnyOf: ['ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.RULES.VIEW'],
}

const listByTable = {
  path:       '/table/:table',
  verb:       'GET',
  handler:    { controller: CustomFieldController, method: 'listByTable' },
  middleware: [auth],
  permissionsAnyOf: ['ADMIN.PROGRAMMES.VIEW', 'PROGRAMME.RULES.VIEW'],
}

const create = {
  path:       '/',
  verb:       'POST',
  handler:    { controller: CustomFieldController, method: 'create' },
  middleware: [auth],
  permissionsAnyOf: ['ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.RULES.MANAGE'],
  validation: { body: createCustomFieldSchema },
}

const update = {
  path:       '/:id',
  verb:       'PATCH',
  handler:    { controller: CustomFieldController, method: 'update' },
  middleware: [auth],
  permissionsAnyOf: ['ADMIN.PROGRAMMES.EDIT', 'PROGRAMME.RULES.MANAGE'],
  validation: { body: updateCustomFieldSchema },
}

const deleteField = {
  path:       '/:id',
  verb:       'DELETE',
  handler:    { controller: CustomFieldController, method: 'delete' },
  middleware: [auth],
  permissionsAnyOf: ['ADMIN.PROGRAMMES.ARCHIVE', 'PROGRAMME.RULES.MANAGE'],
}

export const CustomFieldApi = new ApiSchema({
  name:      'CustomField',
  url:       '/api/v1/custom-fields',
  endpoints: [list, listByTable, create, update, deleteField],
})
