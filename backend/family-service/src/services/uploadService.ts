/**
 * FILE UPLOAD SERVICE - Supabase Storage Integration
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * REAL FILE UPLOADS - NOT MOCK DATA
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * This service handles actual file uploads to Supabase Storage buckets.
 * Returns real file URLs that persist in the database.
 * 
 * Storage Structure:
 *   - Bucket: 'documents' (or 'family-documents')
 *   - Path: {owner_type}/{owner_id}/{document_type}/{filename}
 *   
 * Examples:
 *   - FAMILY/abc123/proof_of_residence/utility_bill.pdf
 *   - MEMBER/def456/national_id/front.jpg
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { supabase } from '../lib/supabase.js'
import crypto from 'crypto'

// Bucket name - must match what's created in Supabase Dashboard
const DOCUMENTS_BUCKET = 'documents'

export interface UploadResult {
  success: boolean
  file_url?: string
  file_path?: string
  file_size?: number
  mime_type?: string
  error?: string
}

export interface UploadOptions {
  owner_type: 'FAMILY' | 'MEMBER'  // UPPERCASE
  owner_id: string                  // family_id or member_id
  document_type: string             // e.g., 'proof_of_residence', 'national_id'
  file_name: string                 // Original filename
  file_data: Buffer | Uint8Array    // Raw file data
  content_type: string              // MIME type e.g., 'application/pdf'
}

/**
 * Generate a unique, safe filename
 */
function generateSafeFilename(originalName: string): string {
  const timestamp = Date.now()
  const randomSuffix = crypto.randomBytes(4).toString('hex')
  
  // Get file extension
  const ext = originalName.split('.').pop()?.toLowerCase() || 'bin'
  
  // Sanitize original name (remove unsafe characters)
  const safeName = originalName
    .replace(/\.[^/.]+$/, '') // Remove extension
    .replace(/[^a-zA-Z0-9-_]/g, '_') // Replace unsafe chars
    .substring(0, 50) // Limit length
  
  return `${safeName}_${timestamp}_${randomSuffix}.${ext}`
}

/**
 * Upload a file to Supabase Storage
 * 
 * @param options - Upload options including owner_type, owner_id, document_type, file data
 * @returns UploadResult with success status and file URL
 */
export async function uploadFile(options: UploadOptions): Promise<UploadResult> {
  try {
    const {
      owner_type,
      owner_id,
      document_type,
      file_name,
      file_data,
      content_type,
    } = options

    // Validate inputs
    if (!owner_type || !['FAMILY', 'MEMBER'].includes(owner_type)) {
      return { success: false, error: 'owner_type must be FAMILY or MEMBER (UPPERCASE)' }
    }

    if (!owner_id) {
      return { success: false, error: 'owner_id is required' }
    }

    if (!document_type) {
      return { success: false, error: 'document_type is required' }
    }

    if (!file_data || file_data.length === 0) {
      return { success: false, error: 'file_data is required and must not be empty' }
    }

    // Generate safe filename and full path
    const safeFilename = generateSafeFilename(file_name)
    const filePath = `${owner_type}/${owner_id}/${document_type}/${safeFilename}`

    console.log(`UPLOAD: Uploading to ${DOCUMENTS_BUCKET}/${filePath}`)

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(filePath, file_data, {
        contentType: content_type,
        upsert: false, // Don't overwrite existing files
      })

    if (error) {
      console.error('UPLOAD ERROR:', error)
      return { success: false, error: `Upload failed: ${error.message}` }
    }

    // Get the public URL for the uploaded file
    const { data: urlData } = supabase.storage
      .from(DOCUMENTS_BUCKET)
      .getPublicUrl(filePath)

    console.log(`UPLOAD SUCCESS: ${filePath}`)

    return {
      success: true,
      file_url: urlData.publicUrl,
      file_path: filePath,
      file_size: file_data.length,
      mime_type: content_type,
    }

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('UPLOAD EXCEPTION:', message)
    return { success: false, error: message }
  }
}

/**
 * Delete a file from Supabase Storage
 * 
 * @param filePath - The path to the file in storage
 * @returns Success status
 */
export async function deleteFile(filePath: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!filePath) {
      return { success: false, error: 'filePath is required' }
    }

    const { error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .remove([filePath])

    if (error) {
      console.error('DELETE ERROR:', error)
      return { success: false, error: `Delete failed: ${error.message}` }
    }

    console.log(`DELETE SUCCESS: ${filePath}`)
    return { success: true }

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('DELETE EXCEPTION:', message)
    return { success: false, error: message }
  }
}

/**
 * Get a signed URL for private file access (if bucket is private)
 * 
 * @param filePath - The path to the file in storage
 * @param expiresIn - Seconds until URL expires (default: 3600 = 1 hour)
 * @returns Signed URL or error
 */
export async function getSignedUrl(
  filePath: string,
  expiresIn: number = 3600
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    if (!filePath) {
      return { success: false, error: 'filePath is required' }
    }

    const { data, error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrl(filePath, expiresIn)

    if (error) {
      console.error('SIGNED URL ERROR:', error)
      return { success: false, error: `Failed to create signed URL: ${error.message}` }
    }

    return { success: true, url: data.signedUrl }

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('SIGNED URL EXCEPTION:', message)
    return { success: false, error: message }
  }
}

/**
 * List files in a specific path
 * 
 * @param ownerType - FAMILY or MEMBER
 * @param ownerId - family_id or member_id
 * @param documentType - optional document type to filter by
 */
export async function listFiles(
  ownerType: 'FAMILY' | 'MEMBER',
  ownerId: string,
  documentType?: string
): Promise<{ success: boolean; files?: unknown[]; error?: string }> {
  try {
    const basePath = documentType 
      ? `${ownerType}/${ownerId}/${documentType}`
      : `${ownerType}/${ownerId}`

    const { data, error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .list(basePath)

    if (error) {
      console.error('LIST ERROR:', error)
      return { success: false, error: `List failed: ${error.message}` }
    }

    return { success: true, files: data }

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('LIST EXCEPTION:', message)
    return { success: false, error: message }
  }
}

export default {
  uploadFile,
  deleteFile,
  getSignedUrl,
  listFiles,
}
