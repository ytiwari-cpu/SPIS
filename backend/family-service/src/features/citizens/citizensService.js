import { BaseService } from '../../../../base/baseService.js'
import { CitizensRepository } from './citizensRepository.js'
/**
 * CitizensService — business logic for the citizens feature
 */

export class CitizensService extends BaseService {
  /** @param {import('./citizensRepository.js').CitizensRepository} repo */
  constructor(context) {
    super(context)
    this.citizensRepository = new CitizensRepository(context)
  }

  async list({ page, limit, status, gender, search }) {
    const parsedPage  = Math.max(1, parseInt(page, 10)  || 1)
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20))
    const cleanSearch = (search || '').trim()
    const cleanStatus = (status || '').trim()
    const cleanGender = (gender || '').trim()

    const { data, count } = await this.citizensRepository.list({
      page:   parsedPage,
      limit:  parsedLimit,
      status: cleanStatus || undefined,
      gender: cleanGender || undefined,
      search: cleanSearch || undefined,
    })
    const total = count ?? 0
    return {
      citizens:   data || [],
      total,
      pagination: {
        page:       parsedPage,
        limit:      parsedLimit,
        total,
        totalPages: total ? Math.ceil(total / parsedLimit) : 0,
      },
    }
  }

  async get(uuid) {
    return await this.citizensRepository.getById(uuid)
  }
}
