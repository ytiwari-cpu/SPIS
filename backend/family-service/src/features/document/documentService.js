/**
 * DocumentService — business logic for the document feature
 */

import { deleteFile } from '../../services/uploadService.js'

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/
const isUuid = (value) => !!value && UUID_RE.test(value)

export class DocumentService {
  /** @param {import('./documentRepository.js').DocumentRepository} repo */
  constructor(repo) {
    this.repo = repo
  }

  async listByFamily(familyId) {
    const { data, error } = await this.repo.listByFamily(familyId)
    if (error) throw new Error(error.message)
    return data || []
  }

  async listByMember(memberId) {
    const { data, error } = await this.repo.listByMember(memberId)
    if (error) throw new Error(error.message)
    return data || []
  }

  async get(documentId) {
    const { data, error } = await this.repo.getById(documentId)
    if (error || !data) return null
    return data
  }

  async create(body) {
    if (body.family_id) {
      const { data: family, error } = await this.repo.getFamilyById(body.family_id)
      if (error || !family) return { notFound: 'Family' }
    }
    if (body.member_id) {
      const { data: member, error } = await this.repo.getMemberById(body.member_id)
      if (error || !member) return { notFound: 'Member' }
    }

    const { data: document, error } = await this.repo.create({
      owner_type:       body.family_id ? 'FAMILY' : 'MEMBER',
      owner_id:         body.family_id || body.member_id,
      document_type:    body.document_type,
      file_path:        body.file_path,
      file_name:        body.file_name,
      mime_type:        body.mime_type        || null,
      file_size_bytes:  body.file_size_bytes  || null,
      uploaded_by:      isUuid(body.uploaded_by) ? body.uploaded_by : null,
    })
    if (error) throw new Error(error.message)

    await this.repo.createVerification({ document_id: document.document_id, status: 'pending' })
    return { document }
  }

  async verify(documentId, body) {
    const { data: document, error: docError } = await this.repo.getById(documentId)
    if (docError || !document) return null

    const verificationData = {
      status:           body.status,
      verified_by:      body.verified_by,
      verified_at:      new Date().toISOString(),
      rejection_reason: body.status === 'rejected' ? body.rejection_reason : null,
    }

    const { data: existingVerification } = await this.repo.getVerification(documentId)

    let result, err
    if (existingVerification) {
      ;({ data: result, error: err } = await this.repo.updateVerification(documentId, verificationData))
    } else {
      ;({ data: result, error: err } = await this.repo.insertVerification({ document_id: documentId, ...verificationData }))
    }

    if (err) throw new Error(err.message)
    return result
  }

  async remove(documentId) {
    const { data: document, error: fetchError } = await this.repo.getById(documentId)
    if (fetchError || !document) return null

    if (document.file_path) {
      const deleteResult = await deleteFile(document.file_path)
      if (!deleteResult.success) console.warn('Storage delete failed (continuing):', deleteResult.error)
    }

    await this.repo.deleteVerification(documentId)
    const { error } = await this.repo.remove(documentId)
    if (error) throw new Error(error.message)
    return true
  }
}
