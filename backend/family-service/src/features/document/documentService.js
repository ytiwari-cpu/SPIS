import { BaseService }        from '../../../../base/baseService.js'
/**
 * DocumentService — business logic for the document feature
 */

import { deleteFile }         from '../../services/uploadService.js'
import { DocumentRepository } from './documentRepository.js'

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/
const isUuid = (value) => !!value && UUID_RE.test(value)

export class DocumentService extends BaseService {
  constructor(context) {
    super(context)
    this.documentRepository = new DocumentRepository(context)
  }

  async listByFamily(familyId) {
    return await this.documentRepository.listByFamily(familyId)
  }

  async listByMember(memberId) {
    return await this.documentRepository.listByMember(memberId)
  }

  async get(documentId) {
    return await this.documentRepository.getById(documentId)
  }

  async create(body) {
    if (body.family_id) {
      const family = await this.documentRepository.getFamilyById(body.family_id)
      if (!family) {
        return { notFound: 'Family' }
      }
    }
    if (body.member_id) {
      const member = await this.documentRepository.getMemberById(body.member_id)
      if (!member) {
        return { notFound: 'Member' }
      }
    }

    const docUuid = DocumentService.generateUUID()
    await this.documentRepository.create({
      document_id:     docUuid,
      owner_type:      body.family_id ? 'FAMILY' : 'MEMBER',
      owner_id:        body.family_id || body.member_id,
      document_type:   body.document_type,
      file_path:       body.file_path,
      file_name:       body.file_name,
      mime_type:       body.mime_type        || null,
      file_size_bytes: body.file_size_bytes  || null,
      uploaded_by:     isUuid(body.uploaded_by) ? body.uploaded_by : null,
    })

    await this.documentRepository.createVerification({ document_id: docUuid, status: 'pending' })

    const document = await this.documentRepository.getById(docUuid)
    return { document }
  }

  async verify(documentId, body) {
    const document = await this.documentRepository.getById(documentId)
    if (!document) {
      return null
    }

    const verificationData = {
      status:           body.status,
      verified_by:      body.verified_by,
      verified_at:      new Date().toISOString(),
      rejection_reason: body.status === 'rejected' ? body.rejection_reason : null,
    }

    const existingVerification = await this.documentRepository.getVerification(documentId)

    if (existingVerification) {
      await this.documentRepository.updateVerification(documentId, verificationData)
    } else {
      await this.documentRepository.insertVerification({ document_id: documentId, ...verificationData })
    }

    return { document_id: documentId, ...verificationData }
  }

  async remove(documentId) {
    const document = await this.documentRepository.getById(documentId)
    if (!document) {
      return null
    }

    if (document.file_path) {
      const deleteResult = await deleteFile(document.file_path)
      if (!deleteResult.success) {
        console.warn('Storage delete failed (continuing):', deleteResult.error)
      }
    }

    await this.documentRepository.deleteVerification(documentId)
    await this.documentRepository.remove(documentId)
    return true
  }
}
