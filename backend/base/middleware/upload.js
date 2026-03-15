/**
 * base/middleware/upload.js
 *
 * Centralised multer factory with magic-bytes validation and filename sanitization.
 * No other file should import multer directly — this is the single chokepoint.
 *
 * Usage in apiSchema endpoint config:
 *   file: { field: 'file', maxSizeMb: 50 }   // ApiSchema auto-injects this middleware
 */

import { createRequire } from 'node:module'

// Lazy-load multer — resolved from the calling service's node_modules
let _multer = null
function getMulter() {
  if (!_multer) {
    const require_ = createRequire(`${process.cwd()  }/package.json`)
    _multer = require_('multer')
  }
  return _multer
}

const DEFAULT_MIME_TYPES = [
  'application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

// Magic-byte signatures for allowed types — checks first bytes of the actual file content,
// not just the MIME header (which can be spoofed by renaming a .exe to .pdf)
const MAGIC_BYTES = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46],         // %PDF
  'image/jpeg':      [0xFF, 0xD8, 0xFF],                // JFIF / EXIF
  'image/png':       [0x89, 0x50, 0x4E, 0x47],          // \x89PNG
  'image/gif':       [0x47, 0x49, 0x46],                // GIF
  'image/webp':      [0x52, 0x49, 0x46, 0x46],          // RIFF (WebP container)
}

/**
 * Check whether a file buffer matches the expected MIME type's magic bytes.
 * For types without a known signature (docx etc.), trusts the MIME check.
 *
 * @param {Buffer} buffer — the file buffer (from req.file.buffer)
 * @param {string} mimeType — the declared MIME type
 * @returns {boolean}
 */
export function matchesMagicBytes(buffer, mimeType) {
  const magic = MAGIC_BYTES[mimeType]
  if (!magic) {
    return true
  }  // for types without a known signature (docx etc.), trust MIME check
  return magic.every((byte, i) => buffer[i] === byte)
}

/**
 * Sanitize filename — strip path traversal sequences and dangerous chars.
 * Keeps only alphanumerics, dots, underscores, hyphens.
 *
 * @param {string} filename
 * @returns {string}
 */
function sanitizeFilename(filename) {
  return filename
    .replace(/\.\.\/|\.\.\\/g, '')         // strip ../ and ..\ path traversal
    .replace(/[^a-zA-Z0-9._\-]/g, '_')    // replace all other non-safe chars with _
    .slice(0, 255)                         // cap filename length
}

/**
 * Create a multer upload middleware for single-file upload.
 *
 * @param {{ field?: string, maxSizeMb?: number, mimeTypes?: string[] }} [options]
 * @returns {import('express').RequestHandler}
 */
export function createUploadMiddleware({ field = 'file', maxSizeMb = 10, mimeTypes } = {}) {
  const multer  = getMulter()
  const allowed = mimeTypes || DEFAULT_MIME_TYPES
  return multer({
    storage:    multer.memoryStorage(),  // buffer in memory — max 10 MB default
    limits:     { fileSize: maxSizeMb * 1024 * 1024, files: 1 },  // 1 file per request max
    fileFilter: (_req, file, cb) => {
      // 1. Sanitize filename before it touches any file system path
      file.originalname = sanitizeFilename(file.originalname)
      // 2. Reject if declared MIME type is not in the allowlist
      if (!allowed.includes(file.mimetype)) {
        return cb(null, false)
      }
      // Magic byte check runs post-upload in the controller (buffer is needed):
      //   if (!matchesMagicBytes(req.file.buffer, req.file.mimetype))
      //     throw ApplicationError.badRequest('File content does not match declared type')
      cb(null, true)
    },
  }).single(field)
}
