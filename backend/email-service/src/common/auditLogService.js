/**
 * email-service/src/common/auditLogService.js
 *
 * Business-logic audit log service for email-service.
 * Uses BaseService.generateUUID() and BaseRepository + QueryHelper pattern.
 * ALWAYS fail-silent: audit errors must never propagate to the request caller. *
 * Writes a structured human-readable event record to the `audit_logs` table
 * in the email service's Supabase project (public schema).
 *
 * Design rules:
 *  - Uses BaseService.generateUUID() for UUID generation.
 *  - Uses BaseRepository + QueryHelper pattern for all DB operations.
 *  - ALWAYS fail-silent: audit errors must never propagate to the request caller.
 */

import { BaseService }    from '../../../base/baseService.js'
import { BaseRepository }  from '../../../base/baseRepository.js'
import { QueryHelper }     from '../../../base/queryHelper.js'
import { EMAIL }  from '../../../base/table.js'

class AuditLogRepository extends BaseRepository {
  constructor(context) {
    super(context)
  }

  async insertLog(fields) {
    const { text, values } = new QueryHelper(EMAIL.AUDIT_LOG).insert(fields).toParam()
    await this.runQuery(text, values, false)
  }
}

export class AuditLogService extends BaseService {
  constructor(context) {
    super(context)
    this.auditLogRepository = new AuditLogRepository(context)
  }

  async record({ userId, createdBy, action }) {
    try {
      const uuid = AuditLogService.generateUUID()
      await this.auditLogRepository.insertLog({
        uuid,
        user_id:    userId,
        created_by: createdBy,
        logs:       action,
      })
    } catch (err) {
      this.log.error('Audit log write failed', {
        table: EMAIL.AUDIT_LOG,
        error: err.message,
      })
    }
  }
}
