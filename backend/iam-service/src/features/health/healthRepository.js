/**
 * IAM — Health Repository
 */

import { BaseRepository } from '../../../../base/baseRepository.js'

export class HealthRepository extends BaseRepository {
  constructor(context) {
    super(context)
  }

  async testConnection() {
    try {
      await this.runQuery('SELECT 1', [], true)
      return true
    } catch {
      return false
    }
  }
}
