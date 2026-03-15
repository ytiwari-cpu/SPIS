import { CustomFieldRepository } from './customFieldRepository.js'
/**
 * CustomFieldService — business logic for custom field management.
 *
 * Delegates DB queries to CustomFieldRepository and ALTER TABLE
 * operations to the shared customFieldManager utility.
 */

import { BaseService } from '../../../../base/baseService.js'
import {
  createCustomField,
  getAllCustomFields,
  getCustomFieldsByTable,
  updateCustomField,
  deactivateCustomField,
} from '../../services/customFieldManager.js'

export class CustomFieldService extends BaseService {
  constructor(context) {
    super(context)
    this.customFieldRepository = new CustomFieldRepository(context)
  }

  async list() {
    return await getAllCustomFields()
  }

  async listByTable(targetTable) {
    return await getCustomFieldsByTable(targetTable)
  }

  async create(input, createdBy) {
    return await createCustomField(input, createdBy)
  }

  async update(id, input, updatedBy) {
    return await updateCustomField(id, input, updatedBy)
  }

  async deactivate(id) {
    return await deactivateCustomField(id)
  }
}
