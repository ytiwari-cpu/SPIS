import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.FAMILY_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseServiceKey = process.env.FAMILY_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.FAMILY_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables: FAMILY_SUPABASE_URL and FAMILY_SUPABASE_SERVICE_ROLE_KEY')
}

if (process.env.FAMILY_SUPABASE_SERVICE_ROLE_KEY === process.env.FAMILY_SUPABASE_ANON_KEY) {
  console.warn('Supabase service role key matches anon key. RLS will block server-side writes. Update FAMILY_SUPABASE_SERVICE_ROLE_KEY with the real service role key.')
}

/**
 * IMPORTANT: The tables are in the 'family' schema, not 'public'.
 * 
 * To use the Supabase REST API with the 'family' schema, you need to:
 * 1. Go to Supabase Dashboard → Settings → API → Exposed Schemas
 * 2. Add 'family' to the list of exposed schemas
 * 
 * For now, we use the public schema client and rely on the schema being exposed.
 * If the schema isn't exposed, you'll get "Invalid schema: family" error.
 */

// Main Supabase client - uses 'family' schema if exposed, otherwise falls back
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  db: {
    schema: 'family', // Requires 'family' schema to be exposed in Supabase Dashboard
  },
})

// Client for public schema (for RPC calls and other operations)
export const supabasePublic = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// Test database connection
export async function testConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('family').select('family_id').limit(1)
    if (error) {
      return { success: false, error: error.message }
    }
    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// Get all family IDs for dev login
export async function getAllFamilyIds(): Promise<{ 
  success: boolean; 
  data?: { uuid: string; family_id: string; status: string | null; registration_status: string | null; created_at: string }[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('family')
      .select('uuid, family_id, status, registration_status, created_at')
      .order('created_at', { ascending: false })
    
    if (error) {
      return { success: false, error: error.message }
    }
    return { success: true, data: data || [] }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
