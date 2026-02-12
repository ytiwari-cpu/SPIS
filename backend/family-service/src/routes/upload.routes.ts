/**
 * FILE UPLOAD ROUTES - Real Supabase Storage Uploads
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * MULTIPART FILE UPLOADS TO SUPABASE STORAGE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * These routes handle actual file uploads using multer middleware.
 * Files are uploaded to Supabase Storage and URLs stored in documents table.
 * 
 * POLYMORPHIC MODEL:
 *   - owner_type: 'FAMILY' | 'MEMBER' (UPPERCASE)
 *   - owner_id: family_id or member_id
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Router, Request, Response } from 'express'
import multer from 'multer'
import { supabase } from '../lib/supabase.js'
import { uploadFile, deleteFile, getSignedUrl } from '../services/uploadService.js'
import { writeHistory, createHistoryEntry, updateHistoryEntry, deleteHistoryEntry } from '../services/historyService.js'

const router = Router()

const isUuid = (value?: string): boolean => {
  if (!value) return false
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(value)
}

// Configure multer for memory storage (files stay in memory buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (_req, file, cb) => {
    // Accept common document types
    const allowedMimes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`))
    }
  },
})

// ═══════════════════════════════════════════════════════════════════════════
// FAMILY DOCUMENT UPLOAD
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/upload/family/:familyId/documents
 * 
 * Upload a document for a family.
 * Uses multipart form data.
 * 
 * Form fields:
 *   - file: The file to upload (required)
 *   - document_type: Type of document e.g., 'proof_of_residence' (required)
 *   - document_number: Optional document number
 */
router.post('/family/:familyId/documents', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { familyId } = req.params
    const { document_type, document_number } = req.body
    const file = req.file

    // Verify family exists
    const { data: family, error: familyError } = await supabase
      .from('family')
      .select('uuid')
      .eq('uuid', familyId)
      .single()

    if (familyError || !family) {
      return res.status(404).json({
        success: false,
        error: 'Family not found.',
      })
    }

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded. Use form field "file".',
      })
    }

    if (!document_type) {
      return res.status(400).json({
        success: false,
        error: 'document_type is required.',
      })
    }

    // Upload file to Supabase Storage
    const uploadResult = await uploadFile({
      owner_type: 'FAMILY',
      owner_id: familyId,
      document_type,
      file_name: file.originalname,
      file_data: file.buffer,
      content_type: file.mimetype,
    })

    if (!uploadResult.success) {
      return res.status(500).json({
        success: false,
        error: uploadResult.error || 'File upload failed',
      })
    }

    // Create document record in database with POLYMORPHIC columns
    const headerUserId = req.headers['x-user-id'] as string | undefined
    const documentData = {
      owner_type: 'FAMILY',
      owner_id: familyId,
      document_type,
      document_number: document_number || null,
      file_url: uploadResult.file_url,
      file_path: uploadResult.file_path,
      file_name: file.originalname,
      mime_type: uploadResult.mime_type,
      file_size_bytes: uploadResult.file_size,
      status: 'PENDING',
      uploaded_at: new Date().toISOString(),
      uploaded_by: isUuid(headerUserId) ? headerUserId : null,
    }

    const { data: document, error: docError } = await supabase
      .from('documents')
      .insert(documentData)
      .select()
      .single()

    if (docError) {
      // Clean up uploaded file if DB insert fails
      if (uploadResult.file_path) {
        await deleteFile(uploadResult.file_path)
      }
      return res.status(500).json({
        success: false,
        error: `Failed to save document record: ${docError.message}`,
      })
    }

    // Write history
    await writeHistory(createHistoryEntry(
      familyId,
      'DOCUMENT',
      document.document_id,
      document,
      isUuid(headerUserId) ? headerUserId : 'system'
    ))

    return res.status(201).json({
      success: true,
      data: document,
      message: 'Document uploaded successfully.',
    })

  } catch (err) {
    console.error('Family document upload exception:', err)
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Internal server error',
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// MEMBER DOCUMENT UPLOAD
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/upload/member/:memberId/documents
 * 
 * Upload a document for a member.
 * Uses multipart form data.
 * 
 * Form fields:
 *   - file: The file to upload (required)
 *   - document_type: Type of document e.g., 'national_id' (required)
 *   - document_number: Optional document number
 */
router.post('/member/:memberId/documents', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { memberId } = req.params
    const { document_type, document_number } = req.body
    const file = req.file

    // Verify member exists and get family_uuid
    const { data: member, error: memberError } = await supabase
      .from('family_member')
      .select('uuid, family_uuid')
      .eq('uuid', memberId)
      .single()

    if (memberError || !member) {
      return res.status(404).json({
        success: false,
        error: 'Member not found.',
      })
    }

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded. Use form field "file".',
      })
    }

    if (!document_type) {
      return res.status(400).json({
        success: false,
        error: 'document_type is required.',
      })
    }

    // Upload file to Supabase Storage
    const uploadResult = await uploadFile({
      owner_type: 'MEMBER',
      owner_id: memberId,
      document_type,
      file_name: file.originalname,
      file_data: file.buffer,
      content_type: file.mimetype,
    })

    if (!uploadResult.success) {
      return res.status(500).json({
        success: false,
        error: uploadResult.error || 'File upload failed',
      })
    }

    // Create document record in database with POLYMORPHIC columns
    const headerUserId = req.headers['x-user-id'] as string | undefined
    const documentData = {
      owner_type: 'MEMBER',
      owner_id: memberId,
      document_type,
      document_number: document_number || null,
      file_url: uploadResult.file_url,
      file_path: uploadResult.file_path,
      file_name: file.originalname,
      mime_type: uploadResult.mime_type,
      file_size_bytes: uploadResult.file_size,
      status: 'PENDING',
      uploaded_at: new Date().toISOString(),
      uploaded_by: isUuid(headerUserId) ? headerUserId : null,
    }

    const { data: document, error: docError } = await supabase
      .from('documents')
      .insert(documentData)
      .select()
      .single()

    if (docError) {
      // Clean up uploaded file if DB insert fails
      if (uploadResult.file_path) {
        await deleteFile(uploadResult.file_path)
      }
      return res.status(500).json({
        success: false,
        error: `Failed to save document record: ${docError.message}`,
      })
    }

    // Write history - use member's family_uuid
    await writeHistory(createHistoryEntry(
      member.family_uuid,
      'DOCUMENT',
      document.document_id,
      document,
      isUuid(headerUserId) ? headerUserId : 'system'
    ))

    return res.status(201).json({
      success: true,
      data: document,
      message: 'Document uploaded successfully.',
    })

  } catch (err) {
    console.error('Member document upload exception:', err)
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Internal server error',
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// GET DOCUMENT WITH SIGNED URL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/upload/documents/:documentId/url
 * 
 * Get a signed URL for accessing a document.
 * Useful if the storage bucket is private.
 */
router.get('/documents/:documentId/url', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params
    const expiresIn = parseInt(req.query.expires_in as string) || 3600

    // Get document record
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('file_path, file_url')
      .eq('document_id', documentId)
      .single()

    if (docError || !document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found.',
      })
    }

    if (!document.file_path) {
      // Return public URL if available
      return res.json({
        success: true,
        data: {
          url: document.file_url,
          expires_in: null,
          is_public: true,
        },
      })
    }

    // Get signed URL
    const signedResult = await getSignedUrl(document.file_path, expiresIn)

    if (!signedResult.success) {
      return res.status(500).json({
        success: false,
        error: signedResult.error || 'Failed to generate signed URL',
      })
    }

    return res.json({
      success: true,
      data: {
        url: signedResult.url,
        expires_in: expiresIn,
        is_public: false,
      },
    })

  } catch (err) {
    console.error('Get document URL exception:', err)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// DELETE DOCUMENT (by owner scope)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * DELETE /api/v1/upload/:ownerType/:ownerId/documents/:documentId
 *
 * Delete a document verifying it belongs to the specified owner.
 * ownerType = 'family' | 'member' (lowercase in URL, UPPERCASE in DB)
 */
router.delete('/:ownerType/:ownerId/documents/:documentId', async (req: Request, res: Response) => {
  try {
    const { ownerType, ownerId, documentId } = req.params
    const dbOwnerType = ownerType.toUpperCase() // FAMILY | MEMBER

    // Get document and verify ownership
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('document_id', documentId)
      .eq('owner_type', dbOwnerType)
      .eq('owner_id', ownerId)
      .single()

    if (docError || !document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found or does not belong to the specified owner.',
      })
    }

    // Resolve family_id for history
    let familyId = dbOwnerType === 'FAMILY' ? ownerId : null
    if (dbOwnerType === 'MEMBER') {
      const { data: member } = await supabase
        .from('family_member')
        .select('family_uuid')
        .eq('uuid', ownerId)
        .single()
      familyId = member?.family_uuid
    }

    // Delete from Supabase Storage
    if (document.file_path) {
      const deleteResult = await deleteFile(document.file_path)
      if (!deleteResult.success) {
        console.warn('Failed to delete file from storage:', deleteResult.error)
      }
    }

    // Delete verification records first (FK)
    await supabase
      .from('document_verification')
      .delete()
      .eq('document_id', documentId)

    // Delete the DB row
    const { error: deleteError } = await supabase
      .from('documents')
      .delete()
      .eq('document_id', documentId)

    if (deleteError) {
      return res.status(500).json({
        success: false,
        error: `Failed to delete document: ${deleteError.message}`,
      })
    }

    // Write history
    if (familyId) {
      await writeHistory(deleteHistoryEntry(
        familyId,
        'DOCUMENT',
        documentId,
        document,
        req.headers['x-user-id'] as string || 'system'
      ))
    }

    return res.json({
      success: true,
      message: 'Document deleted successfully.',
    })
  } catch (err) {
    console.error('Delete document (scoped) exception:', err)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// DELETE DOCUMENT (by ID only)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * DELETE /api/v1/upload/documents/:documentId
 * 
 * Delete a document from storage and database.
 */
router.delete('/documents/:documentId', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params

    // Get document record with owner info
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('document_id', documentId)
      .single()

    if (docError || !document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found.',
      })
    }

    // Get family_id for history
    let familyId = document.owner_type === 'FAMILY' ? document.owner_id : null
    
    if (document.owner_type === 'MEMBER') {
      const { data: member } = await supabase
        .from('family_member')
        .select('family_uuid')
        .eq('uuid', document.owner_id)
        .single()
      familyId = member?.family_uuid
    }

    // Delete from storage if file_path exists
    if (document.file_path) {
      const deleteResult = await deleteFile(document.file_path)
      if (!deleteResult.success) {
        console.warn('Failed to delete file from storage:', deleteResult.error)
        // Continue anyway - we still want to delete the DB record
      }
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('documents')
      .delete()
      .eq('document_id', documentId)

    if (deleteError) {
      return res.status(500).json({
        success: false,
        error: `Failed to delete document: ${deleteError.message}`,
      })
    }

    // Write history
    if (familyId) {
      await writeHistory(deleteHistoryEntry(
        familyId,
        'DOCUMENT',
        documentId,
        document,
        req.headers['x-user-id'] as string || 'system'
      ))
    }

    return res.json({
      success: true,
      message: 'Document deleted successfully.',
    })

  } catch (err) {
    console.error('Delete document exception:', err)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
})

export { router as uploadRouter }
