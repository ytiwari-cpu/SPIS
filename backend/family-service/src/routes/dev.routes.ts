import { Router, Request, Response } from 'express'
import { supabase, supabasePublic, testConnection } from '../lib/supabase.js'

const router = Router()

// Block in production
router.use((req: Request, res: Response, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      error: 'Dev routes are disabled in production',
    })
  }
  next()
})

/**
 * SQL Editor - Execute raw SQL queries (DEV ONLY)
 * ⚠️ DANGEROUS: Only for development!
 */
router.post('/sql', async (req: Request, res: Response) => {
  try {
    const { query } = req.body

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'SQL query is required',
      })
    }

    // Execute raw SQL using Supabase's rpc
    // Note: This requires a function to be created in Supabase
    // For now, we'll use direct table operations for common queries
    
    const startTime = Date.now()
    
    // Parse simple SELECT queries
    const trimmedQuery = query.trim().toLowerCase()
    
    if (trimmedQuery.startsWith('select')) {
      // Use Supabase's from() for SELECT queries
      // This is limited but safer than raw SQL
      const { data, error } = await supabasePublic.rpc('execute_sql', { 
        sql_query: query 
      })

      if (error) {
        // If RPC doesn't exist, return helpful message
        return res.status(400).json({
          success: false,
          error: error.message,
          hint: 'To use SQL Editor, create an execute_sql function in Supabase. For now, use table-specific endpoints.',
          duration_ms: Date.now() - startTime,
        })
      }

      return res.json({
        success: true,
        data: data,
        row_count: Array.isArray(data) ? data.length : 0,
        duration_ms: Date.now() - startTime,
      })
    }

    // For non-SELECT queries, provide guidance
    return res.status(400).json({
      success: false,
      error: 'Only SELECT queries are supported in this dev SQL editor',
      hint: 'For INSERT/UPDATE/DELETE, use the API endpoints or Supabase Dashboard',
    })

  } catch (error) {
    console.error('SQL execution error:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * Get database schema information
 */
router.get('/schema', async (_req: Request, res: Response) => {
  try {
    // List all tables in family schema
    const tables = [
      'family',
      'family_member',
      'address',
      'documents',
      'document_verification',
      'biometric_metadata',
      'account_details',
      'identity_match',
      'family_history',
      'family_event_outbox',
    ]

    const schemaInfo: Record<string, any> = {}

    for (const table of tables) {
      // Try to get columns by selecting with limit 0
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(0)

      if (error) {
        schemaInfo[table] = { 
          exists: false, 
          error: error.message 
        }
      } else {
        schemaInfo[table] = { 
          exists: true,
          // We can't easily get column info, so mark as accessible
          accessible: true
        }
      }
    }

    return res.json({
      success: true,
      schema: 'family',
      tables: schemaInfo,
    })

  } catch (error) {
    console.error('Schema info error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to get schema info',
    })
  }
})

/**
 * Database connection test
 */
router.get('/health', async (_req: Request, res: Response) => {
  const result = await testConnection()
  return res.json(result)
})

/**
 * Get table data with pagination (for dev inspection)
 */
router.get('/table/:tableName', async (req: Request, res: Response) => {
  try {
    const { tableName } = req.params
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const offset = (page - 1) * limit

    // Whitelist of allowed tables
    const allowedTables = [
      'family',
      'family_member',
      'address',
      'documents',
      'document_verification',
      'biometric_metadata',
      'account_details',
      'identity_match',
      'family_history',
      'family_event_outbox',
    ]

    if (!allowedTables.includes(tableName)) {
      return res.status(400).json({
        success: false,
        error: `Table ${tableName} is not allowed. Allowed tables: ${allowedTables.join(', ')}`,
      })
    }

    const { data, error, count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact' })
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false })

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message,
      })
    }

    return res.json({
      success: true,
      table: tableName,
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: count ? Math.ceil(count / limit) : 0,
      },
    })

  } catch (error) {
    console.error('Table fetch error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch table data',
    })
  }
})

/**
 * Seed sample data (for testing)
 */
router.post('/seed', async (_req: Request, res: Response) => {
  try {
    // Create a sample address first (using actual schema columns)
    const { data: address, error: addressError } = await supabase
      .from('address')
      .insert({
        address_type: 'permanent',
        line1: '123 Main Street',
        line2: 'Apt 4B',
        parish: 'Kinondoni',
        district: 'Dar es Salaam',
        geo_code: 'DSM-KIN-001',
      })
      .select()
      .single()

    if (addressError) {
      return res.status(400).json({
        success: false,
        error: `Failed to create address: ${addressError.message}`,
      })
    }

    // Create a sample family
    const { data: family, error: familyError } = await supabase
      .from('family')
      .insert({
        permanent_address_id: address.address_id,
        household_size: 4,
        geo_code: 'DSM-001',
        vulnerability_flag: false,
        status: 'active',
        intake_channel: 'field_registration',
        registration_status: 'draft',
      })
      .select()
      .single()

    if (familyError) {
      return res.status(400).json({
        success: false,
        error: `Failed to create family: ${familyError.message}`,
      })
    }

    // Create head of household
    const { data: headMember, error: memberError } = await supabase
      .from('family_member')
      .insert({
        family_id: family.family_id,
        national_id: `TZ-${Date.now()}`,
        first_name: 'John',
        last_name: 'Mwamba',
        date_of_birth: '1985-03-15',
        gender: 'male',
        relationship_to_head: 'head',
        current_address_id: address.address_id,
        alive_flag: true,
        marital_status: 'married',
      })
      .select()
      .single()

    if (memberError) {
      return res.status(400).json({
        success: false,
        error: `Failed to create member: ${memberError.message}`,
      })
    }

    // Update family with head_member_id
    await supabase
      .from('family')
      .update({ head_member_id: headMember.member_id })
      .eq('family_id', family.family_id)

    // Log to family_history (using actual schema columns)
    await supabase
      .from('family_history')
      .insert({
        entity_type: 'family',
        entity_id: family.family_id,
        change_type: 'create',
        old_value: null,
        new_value: family,
        changed_by: 'dev_seed',
      })

    return res.json({
      success: true,
      message: 'Sample data seeded successfully',
      data: {
        family,
        head_member: headMember,
        address,
      },
    })

  } catch (error) {
    console.error('Seed error:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to seed data',
    })
  }
})

/**
 * Clear all data (dangerous!)
 */
router.delete('/clear', async (req: Request, res: Response) => {
  try {
    const { confirm } = req.body

    if (confirm !== 'DELETE_ALL_DATA') {
      return res.status(400).json({
        success: false,
        error: 'Must send { "confirm": "DELETE_ALL_DATA" } to clear data',
      })
    }

    // Delete in order to respect foreign keys
    const tables = [
      'family_event_outbox',
      'family_history',
      'identity_match',
      'biometric_metadata',
      'document_verification',
      'documents',
      'account_details',
      'family_member',
      'family',
      'address',
    ]

    const results: Record<string, any> = {}

    for (const table of tables) {
      // First count rows
      const { count: beforeCount } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })

      // Then delete all rows
      const { error } = await supabase
        .from(table)
        .delete()
        .neq('created_at', '1900-01-01') // Delete all rows

      results[table] = {
        deleted: !error,
        count: beforeCount || 0,
        error: error?.message,
      }
    }

    return res.json({
      success: true,
      message: 'All data cleared',
      results,
    })

  } catch (error) {
    console.error('Clear error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to clear data',
    })
  }
})

export { router as devRouter }
