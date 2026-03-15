/**
 * SqlEditorController — HTTP handlers for dev SQL-editor endpoints
 */

import { BaseController }      from '../../../../base/baseController.js'
import { SqlEditorService }    from './sqlEditorService.js'

export class SqlEditorController extends BaseController {
  constructor(context) {
    super(context)
    this.service = new SqlEditorService(context)
  }

  // POST /sql
  async executeSql(body) {
    const { sql } = body
    const result  = await this.service.executeSql(sql)
    return this.respondOk(result)
  }

  // GET /tables
  async listTables() {
    const result = await this.service.listTables()
    return this.respondOk(result)
  }

  // GET /health
  async healthCheck() {
    const result = await this.service.healthCheck()
    return this.respondOk(result)
  }

  // GET /tables/:tableName
  async browseTable(params, query) {
    const { tableName } = params
    const result        = await this.service.browseTable(tableName, query)
    return this.respondOk(result)
  }

  // POST /seed
  async seedData() {
    const result = await this.service.seedData()
    return this.respondOk(result)
  }

  // DELETE /clear
  async clearAllData(body) {
    const { confirmation } = body
    const result           = await this.service.clearAllData(confirmation)
    return this.respondOk(result)
  }
}
