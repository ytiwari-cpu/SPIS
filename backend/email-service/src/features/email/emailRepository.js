/**
 * EmailRepository — DB queries for the email feature
 */

import { createEmailRequest } from '../../db/repository.js'

export class EmailRepository {
  async createRequest(fields) {
    return createEmailRequest(fields)
  }
}
