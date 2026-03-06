/**
 * CitizensService — business logic for the citizens feature
 */

export class CitizensService {
  /** @param {import('./citizensRepository.js').CitizensRepository} repo */
  constructor(repo) {
    this.repo = repo
  }

  async list({ page, limit, status, gender, search }) {
    const { data, count, error } = await this.repo.list({ page, limit, status, gender, search })
    if (error) throw new Error(error.message)
    return { citizens: data || [], total: count ?? 0 }
  }

  async get(uuid) {
    const { data, error } = await this.repo.getById(uuid)
    if (error || !data) return null
    return data
  }
}
