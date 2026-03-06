/**
 * emailRepository.js — DB queries for the email feature
 *
 * All database access for email operations goes through here.
 */

import { createEmailRequest } from '../../../db/repository.js'

export class EmailRepository {
  async createRequest(fields) {
    return createEmailRequest(fields)
  }
}
