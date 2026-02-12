import { Router, Request, Response, NextFunction } from 'express'
import { supabase } from '../lib/supabase.js'
import { validate } from '../middleware/validate.js'
import { NotFoundError } from '../middleware/errorHandler.js'
import { CreateDocumentSchema, VerifyDocumentSchema } from '../validators/schemas.js'
import type { CreateDocumentRequest, VerifyDocumentRequest } from '../types/index.js'
import { deleteFile } from '../services/uploadService.js'

export const documentRouter = Router()

const isUuid = (value?: string): boolean => {
  if (!value) return false
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(value)
}

/**
 * GET /api/v1/documents/family/:familyId
 * Get all documents for a family
 */
documentRouter.get('/family/:familyId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { familyId } = req.params

    const { data, error } = await supabase
      .from('documents')
      .select(`
        *,
        document_verification (*)
      `)
      .eq('owner_type', 'FAMILY')
      .eq('owner_id', familyId)
      .order('created_at', { ascending: false })

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message,
      })
    }

    res.json({
      success: true,
      data: data || [],
    })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /api/v1/documents/member/:memberId
 * Get all documents for a member
 */
documentRouter.get('/member/:memberId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { memberId } = req.params

    const { data, error } = await supabase
      .from('documents')
      .select(`
        *,
        document_verification (*)
      `)
      .eq('owner_type', 'MEMBER')
      .eq('owner_id', memberId)
      .order('created_at', { ascending: false })

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message,
      })
    }

    res.json({
      success: true,
      data: data || [],
    })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /api/v1/documents/:id
 * Get document by ID with verification status
 */
documentRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params

    const { data: document, error } = await supabase
      .from('documents')
      .select(`
        *,
        document_verification (*)
      `)
      .eq('document_id', id)
      .single()

    if (error || !document) {
      throw new NotFoundError('Document not found')
    }

    res.json({
      success: true,
      data: document,
    })
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/v1/documents
 * Upload document metadata
 */
documentRouter.post('/', validate(CreateDocumentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body: CreateDocumentRequest = req.body

    // Verify family or member exists
    if (body.family_id) {
      const { data: family, error: familyError } = await supabase
        .from('family')
        .select('uuid')
        .eq('uuid', body.family_id)
        .single()

      if (familyError || !family) {
        throw new NotFoundError('Family not found')
      }
    }

    if (body.member_id) {
      const { data: member, error: memberError } = await supabase
        .from('family_member')
        .select('uuid')
        .eq('uuid', body.member_id)
        .single()

      if (memberError || !member) {
        throw new NotFoundError('Member not found')
      }
    }

    // Create document record
    const { data: document, error } = await supabase
      .from('documents')
      .insert({
        owner_type: body.family_id ? 'FAMILY' : 'MEMBER',
        owner_id: body.family_id || body.member_id,
        document_type: body.document_type,
        file_path: body.file_path,
        file_name: body.file_name,
        mime_type: body.mime_type || null,
        file_size_bytes: body.file_size_bytes || null,
        uploaded_by: isUuid(body.uploaded_by) ? body.uploaded_by : null,
      })
      .select()
      .single()

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message,
      })
    }

    // Create initial verification record
    await supabase.from('document_verification').insert({
      document_id: document.document_id,
      status: 'pending',
    })

    res.status(201).json({
      success: true,
      data: document,
    })
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/v1/documents/:id/verify
 * Verify or reject a document
 */
documentRouter.post('/:id/verify', validate(VerifyDocumentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const body: VerifyDocumentRequest = req.body

    // Check if document exists
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('document_id')
      .eq('document_id', id)
      .single()

    if (docError || !document) {
      throw new NotFoundError('Document not found')
    }

    // Update or create verification record
    const { data: existingVerification } = await supabase
      .from('document_verification')
      .select('verification_id')
      .eq('document_id', id)
      .single()

    if (existingVerification) {
      // Update existing
      const { data: verification, error } = await supabase
        .from('document_verification')
        .update({
          status: body.status,
          verified_by: body.verified_by,
          verified_at: new Date().toISOString(),
          rejection_reason: body.status === 'rejected' ? body.rejection_reason : null,
        })
        .eq('document_id', id)
        .select()
        .single()

      if (error) {
        return res.status(400).json({
          success: false,
          error: error.message,
        })
      }

      return res.json({
        success: true,
        data: verification,
      })
    } else {
      // Create new
      const { data: verification, error } = await supabase
        .from('document_verification')
        .insert({
          document_id: id,
          status: body.status,
          verified_by: body.verified_by,
          verified_at: new Date().toISOString(),
          rejection_reason: body.status === 'rejected' ? body.rejection_reason : null,
        })
        .select()
        .single()

      if (error) {
        return res.status(400).json({
          success: false,
          error: error.message,
        })
      }

      return res.json({
        success: true,
        data: verification,
      })
    }
  } catch (error) {
    next(error)
  }
})

/**
 * DELETE /api/v1/documents/:id
 * Delete document, its verification, and its storage file
 */
documentRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params

    // Fetch document to get file_path for storage cleanup
    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('*')
      .eq('document_id', id)
      .single()

    if (fetchError || !document) {
      throw new NotFoundError('Document not found')
    }

    // Delete from Supabase Storage if file_path exists
    if (document.file_path) {
      const deleteResult = await deleteFile(document.file_path)
      if (!deleteResult.success) {
        console.warn('Storage delete failed (continuing):', deleteResult.error)
      }
    }

    // Delete verification first (foreign key constraint)
    await supabase
      .from('document_verification')
      .delete()
      .eq('document_id', id)

    // Delete document
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('document_id', id)

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message,
      })
    }

    res.json({
      success: true,
      message: 'Document deleted successfully',
    })
  } catch (error) {
    next(error)
  }
})
