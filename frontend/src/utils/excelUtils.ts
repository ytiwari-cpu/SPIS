/**
 * EXCEL UTILITIES
 *
 * Provides XLSX export/import alongside CSV, using SheetJS (xlsx library).
 *
 * Export: exportToExcel() for .xlsx, exportToCSV() re-exported from mock data.
 * Import: parseAndValidateExcel(), downloadImportTemplate(), downloadErrorReport().
 *
 * Column schemas follow redis-import-export.md.
 */

import * as XLSX from 'xlsx'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ExportColumn<T> {
  key: keyof T
  label: string
}

export type ImportColumnType = 'string' | 'number' | 'email' | 'phone' | 'enum' | 'date' | 'lookup'

export interface ImportColumn {
  key: string
  label: string
  required?: boolean
  type?: ImportColumnType
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  options?: string[]          // for 'enum' type
  lookupValues?: string[]     // for 'lookup' type (runtime reference data)
  lookupLabel?: string        // human-readable label for lookup errors
}

export interface CellError {
  row: number
  column: string
  value: unknown
  message: string
}

export interface ParsedImportRow {
  rowIndex: number
  data: Record<string, unknown>
  errors: CellError[]
  isValid: boolean
}

export interface ParsedImportResult {
  rows: ParsedImportRow[]
  totalRows: number
  validCount: number
  errorCount: number
  headers: string[]
}

// ═══════════════════════════════════════════════════════════════════════════
// XLSX EXPORT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Export data to an .xlsx file using SheetJS.
 * Auto-sizes columns based on content.
 */
export function exportToExcel<T extends object>(
  data: T[],
  filename: string,
  columns: ExportColumn<T>[],
): void {
  // Build worksheet data: header row + data rows
  const headerRow = columns.map(c => c.label)
  const dataRows = data.map(item =>
    columns.map(c => {
      const value = item[c.key]
      return value === null || value === undefined ? '' : value
    })
  )

  const wsData = [headerRow, ...dataRows]
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Auto-size columns
  const colWidths = columns.map((col, colIdx) => {
    const headerLen = col.label.length
    const maxDataLen = dataRows.reduce((max, row) => {
      const cellLen = String(row[colIdx] ?? '').length
      return Math.max(max, cellLen)
    }, 0)
    return { wch: Math.min(Math.max(headerLen, maxDataLen) + 2, 50) }
  })
  ws['!cols'] = colWidths

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Data')

  const dateStr = new Date().toISOString().split('T')[0]
  XLSX.writeFile(wb, `${filename}_${dateStr}.xlsx`)
}

// ═══════════════════════════════════════════════════════════════════════════
// CSV EXPORT (standalone — does not need the mock data import)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Export data to a .csv file.
 */
export function exportToCSV<T extends object>(
  data: T[],
  filename: string,
  columns: ExportColumn<T>[],
): void {
  const headers = columns.map(c => c.label).join(',')
  const rows = data.map(item =>
    columns.map(c => {
      const value = item[c.key]
      const strValue = String(value ?? '')
      return strValue.includes(',') || strValue.includes('"')
        ? `"${strValue.replace(/"/g, '""')}"`
        : strValue
    }).join(',')
  )

  const csv = [headers, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}

// ═══════════════════════════════════════════════════════════════════════════
// IMPORT — Validation Helpers
// ═══════════════════════════════════════════════════════════════════════════

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[\d\s\-+()]{7,15}$/

function validateCell(value: unknown, col: ImportColumn): string | null {
  const rawValue = value === null || value === undefined ? '' : String(value).trim()

  // Required check
  if (col.required && rawValue === '') {
    return `${col.label} is required`
  }
  if (!col.required && rawValue === '') return null // optional + empty = OK

  const type = col.type || 'string'

  switch (type) {
    case 'string': {
      if (col.minLength && rawValue.length < col.minLength)
        return `Min ${col.minLength} characters`
      if (col.maxLength && rawValue.length > col.maxLength)
        return `Max ${col.maxLength} characters`
      return null
    }
    case 'number': {
      const num = Number(rawValue)
      if (isNaN(num)) return 'Must be a number'
      if (col.min !== undefined && num < col.min) return `Min value is ${col.min}`
      if (col.max !== undefined && num > col.max) return `Max value is ${col.max}`
      return null
    }
    case 'email':
      return EMAIL_RE.test(rawValue) ? null : 'Invalid email format'
    case 'phone':
      return PHONE_RE.test(rawValue) ? null : 'Invalid phone format'
    case 'enum': {
      if (!col.options?.length) return null
      return col.options.includes(rawValue)
        ? null
        : `Must be one of: ${col.options.join(', ')}`
    }
    case 'date': {
      const d = new Date(rawValue)
      return isNaN(d.getTime()) ? 'Invalid date' : null
    }
    case 'lookup': {
      if (!col.lookupValues?.length) return null // skip if no lookup data
      return col.lookupValues.includes(rawValue)
        ? null
        : `Unknown ${col.lookupLabel || 'value'}: "${rawValue}"`
    }
    default:
      return null
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// IMPORT — Parse and Validate an uploaded Excel file
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parse an uploaded .xlsx/.xls file and validate each cell against the schema.
 */
export async function parseAndValidateExcel(
  file: File,
  columns: ImportColumn[],
): Promise<ParsedImportResult> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })

  if (raw.length < 2) {
    return { rows: [], totalRows: 0, validCount: 0, errorCount: 0, headers: [] }
  }

  const fileHeaders = (raw[0] as string[]).map(h => String(h).trim())
  const dataRows = raw.slice(1).filter(row =>
    (row as unknown[]).some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')
  )

  const rows: ParsedImportRow[] = dataRows.map((row, idx) => {
    const rowArray = row as unknown[]
    const data: Record<string, unknown> = {}
    const errors: CellError[] = []

    columns.forEach((col, colIdx) => {
      const headerIdx = fileHeaders.findIndex(
        h => h.toLowerCase() === col.label.toLowerCase()
      )
      const cellIdx = headerIdx >= 0 ? headerIdx : colIdx
      const value = rowArray[cellIdx]
      data[col.key] = value === undefined ? '' : value

      const error = validateCell(value, col)
      if (error) {
        errors.push({ row: idx + 2, column: col.label, value, message: error })
      }
    })

    return {
      rowIndex: idx + 2, // 1-based, skip header
      data,
      errors,
      isValid: errors.length === 0,
    }
  })

  return {
    rows,
    totalRows: rows.length,
    validCount: rows.filter(r => r.isValid).length,
    errorCount: rows.filter(r => !r.isValid).length,
    headers: fileHeaders,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// IMPORT — Template Download
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate and download a blank .xlsx template with correct headers and
 * a hint row showing validation rules.
 */
export function downloadImportTemplate(
  columns: ImportColumn[],
  filename: string,
): void {
  const headers = columns.map(c =>
    c.required ? `${c.label} *` : c.label
  )

  const hintRow = columns.map(col => {
    const parts: string[] = []
    const type = col.type || 'string'
    if (type === 'enum' && col.options?.length)
      parts.push(col.options.join(' | '))
    else if (type === 'lookup')
      parts.push(col.lookupLabel ? `Must match a ${col.lookupLabel}` : 'Lookup value')
    else if (type === 'date')
      parts.push('YYYY-MM-DD')
    else if (type === 'email')
      parts.push('user@example.com')
    else if (type === 'phone')
      parts.push('+1 234 567 8900')
    else if (type === 'number')
      parts.push(`Number${col.min !== undefined ? ` (min ${col.min})` : ''}${col.max !== undefined ? ` (max ${col.max})` : ''}`)
    else {
      if (col.minLength) parts.push(`min ${col.minLength} chars`)
      if (col.maxLength) parts.push(`max ${col.maxLength} chars`)
    }
    if (col.required) parts.push('REQUIRED')
    return parts.join(', ') || ''
  })

  const ws = XLSX.utils.aoa_to_sheet([headers, hintRow])
  ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 2, 20) }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Template')
  XLSX.writeFile(wb, `${filename}_template.xlsx`)
}

// ═══════════════════════════════════════════════════════════════════════════
// IMPORT — Error Report Download
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Download an .xlsx file containing only the invalid rows + error messages.
 */
export function downloadErrorReport(
  result: ParsedImportResult,
  columns: ImportColumn[],
  filename: string,
): void {
  const invalidRows = result.rows.filter(r => !r.isValid)
  if (invalidRows.length === 0) return

  const headers = [...columns.map(c => c.label), 'Errors']
  const dataRows = invalidRows.map(row => [
    ...columns.map(c => row.data[c.key] ?? ''),
    row.errors.map(e => `${e.column}: ${e.message}`).join('; '),
  ])

  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows])
  ws['!cols'] = headers.map(h => ({ wch: Math.max(String(h).length + 2, 20) }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Errors')
  XLSX.writeFile(wb, `${filename}_errors.xlsx`)
}
