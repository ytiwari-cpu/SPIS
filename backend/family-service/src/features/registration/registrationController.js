/**
 * Registration Controller
 *
 * Handles HTTP request/response for all 28 registration endpoints.
 * Delegates business logic to RegistrationService.
 */

import { BaseController }      from '../../../../base/baseController.js'
import { RegistrationService } from './registrationService.js'

export class RegistrationController extends BaseController {
  constructor(context) {
    super(context)
    this.registrationService = new RegistrationService(context)
  }

  // ─── FAMILY ──────────────────────────────────────────────

  async getFamily(params) {
    const data = await this.registrationService.getFamilyForEditing(params.familyUuid)
    this.respondOk({ success: true, data })
  }

  async updateFamily(params, body) {
    const data = await this.registrationService.updateFamily(params.familyUuid, body)
    this.respondOk({ success: true, data })
  }

  async createFamily(body) {
    const data = await this.registrationService.createFamily(body)
    this.respondCreated({ success: true, data })
  }

  // ─── ADDRESS ─────────────────────────────────────────────

  async updatePermanentAddress(params, body) {
    const data = await this.registrationService.updatePermanentAddress(params.familyUuid, body)
    this.respondOk({ success: true, data })
  }

  async createPermanentAddress(params, body) {
    const data = await this.registrationService.createPermanentAddress(params.familyUuid, body)
    this.respondCreated({ success: true, data })
  }

  async createMemberAddress(params, body) {
    const data = await this.registrationService.createMemberAddress(params.memberUuid, body)
    this.respondCreated({ success: true, data })
  }

  // ─── MAILING ADDRESS ────────────────────────────────────

  async createMailingAddress(params, body) {
    const data = await this.registrationService.createMailingAddress(params.familyUuid, body)
    this.respondCreated({ success: true, data })
  }

  async getMailingAddress(params) {
    const data = await this.registrationService.getMailingAddress(params.familyUuid)
    this.respondOk({ success: true, data })
  }

  async updateMailingAddress(params, body) {
    const data = await this.registrationService.updateMailingAddress(params.familyUuid, body)
    this.respondOk({ success: true, data })
  }

  // ─── MEMBERS ─────────────────────────────────────────────

  async updateMember(params, body) {
    const { familyUuid, memberUuid } = params
    const data = await this.registrationService.updateMember(familyUuid, memberUuid, body)
    this.respondOk({ success: true, data })
  }

  async createMember(params, body) {
    const data = await this.registrationService.createMember(params.familyUuid, body)
    this.respondCreated({ success: true, data })
  }

  async addMember(params, body) {
    const data = await this.registrationService.addMemberPostRegistration(params.familyUuid, body)
    this.respondCreated({ success: true, data })
  }

  async updateMemberStatus(params, body) {
    const { familyUuid, memberUuid } = params
    const data = await this.registrationService.updateMemberStatus(familyUuid, memberUuid, body)
    this.respondOk({ success: true, ...data })
  }

  async deleteMember(params, body) {
    const { familyUuid, memberUuid } = params
    const data = await this.registrationService.deleteMember(familyUuid, memberUuid, body)
    this.respondOk({ success: true, ...data })
  }

  async getMemberHistory(params) {
    const { familyUuid, memberUuid } = params
    const data = await this.registrationService.getMemberHistory(familyUuid, memberUuid)
    this.respondOk({ success: true, data })
  }

  // ─── DOCUMENTS ───────────────────────────────────────────

  async createFamilyDocument(params, body) {
    const data = await this.registrationService.createFamilyDocument(params.familyUuid, body)
    this.respondCreated({ success: true, data })
  }

  async createMemberDocument(params, body) {
    const data = await this.registrationService.createMemberDocument(params.memberUuid, body)
    this.respondCreated({ success: true, data })
  }

  // ─── HOUSE SERVICES ──────────────────────────────────────

  async createHouseServices(params, body) {
    const data = await this.registrationService.createHouseServices(params.familyUuid, body)
    this.respondCreated({ success: true, data })
  }

  async getHouseServices(params) {
    const data = await this.registrationService.getHouseServices(params.familyUuid)
    this.respondOk({ success: true, data })
  }

  async updateHouseServices(params, body) {
    const data = await this.registrationService.updateHouseServices(params.familyUuid, body)
    this.respondOk({ success: true, data })
  }

  // ─── SUBMISSION / REVIEW ──────────────────────────────────

  async getAccountInfo(params) {
    const data = await this.registrationService.getAccountInfo(params)
    this.respondOk({ success: true, data })
  }

  async getReview(params) {
    const data = await this.registrationService.getReview(params.familyUuid)
    this.respondOk({ success: true, data })
  }

  async saveDraft(params, body) {
    const data = await this.registrationService.saveDraft(params.familyUuid, body)
    this.respondOk(data)
  }

  async submit(params) {
    const data = await this.registrationService.submit(params.familyUuid)
    this.respondOk(data)
  }

  async getProgress(params) {
    const data = await this.registrationService.getProgress(params.familyUuid)
    this.respondOk({ success: true, data })
  }

  // ─── SAVE EDITS ──────────────────────────────────────────

  async saveEdits(params, body) {
    const result = await this.registrationService.saveEdits(params.familyUuid, body)
    if (result.partial) {
      this.context.response.status(207).json({ success: true, ...result })
    } else {
      this.respondOk({ success: true, ...result })
    }
  }

  // ─── CHECK NID ───────────────────────────────────────────

  async checkNationalId(params) {
    const data = await this.registrationService.checkNationalId(params.nationalId)
    this.respondOk({ success: true, ...data })
  }
}
