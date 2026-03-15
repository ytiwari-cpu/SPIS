/**
 * SqlEditor Api — route definitions for dev-only SQL editor / data tools
 *
 * Migrated from routes/dev.routes.ts to the 4-layer ApiSchema pattern.
 * Production guard is enforced at the service layer (ApplicationError.forbidden).
 * Auth + permission added (original had neither).
 */

import { z }                   from 'zod'
import { ApiSchema }           from '../../../../base/apiSchema.js'
import { SqlEditorController } from './sqlEditorController.js'
import { requireAuth }         from '../../../../base/middleware/requireAuth.js'

const auth = requireAuth()
const perm = 'ADMIN.DEV.SQL'

const executeSql = {
  path:       '/sql',
  verb:       'POST',
  handler:    { controller: SqlEditorController, method: 'executeSql', arguments: ['request:body'] },
  middleware: [auth],
  permission: perm,
  request:    {
    body: z.object({
      sql: z.string().min(1),
    }),
  },
}

const listTables = {
  path:       '/tables',
  verb:       'GET',
  handler:    { controller: SqlEditorController, method: 'listTables', arguments: [] },
  middleware: [auth],
  permission: perm,
}

const healthCheck = {
  path:       '/health',
  verb:       'GET',
  handler:    { controller: SqlEditorController, method: 'healthCheck', arguments: [] },
  middleware: [auth],
  permission: perm,
}

const browseTable = {
  path:       '/tables/:tableName',
  verb:       'GET',
  handler:    { controller: SqlEditorController, method: 'browseTable', arguments: ['request:params', 'request:query'] },
  middleware: [auth],
  permission: perm,
}

const seedData = {
  path:       '/seed',
  verb:       'POST',
  handler:    { controller: SqlEditorController, method: 'seedData', arguments: [] },
  middleware: [auth],
  permission: perm,
}

const clearAllData = {
  path:       '/clear',
  verb:       'DELETE',
  handler:    { controller: SqlEditorController, method: 'clearAllData', arguments: ['request:body'] },
  middleware: [auth],
  permission: perm,
  request:    {
    body: z.object({
      confirmation: z.string().optional(),
    }),
  },
}

export const SqlEditorApi = new ApiSchema({
  name:      'SqlEditor',
  url:       '/api/v1/dev',
  endpoints: [executeSql, listTables, healthCheck, browseTable, seedData, clearAllData],
})
