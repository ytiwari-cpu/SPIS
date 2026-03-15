import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.PROGRAMME_SUPABASE_URL
const supabaseKey = process.env.PROGRAMME_SUPABASE_SERVICE_ROLE_KEY

const familySupabaseUrl = process.env.FAMILY_SUPABASE_URL
const familySupabaseKey = process.env.FAMILY_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️  Missing PROGRAMME_SUPABASE_URL / PROGRAMME_SUPABASE_SERVICE_ROLE_KEY')
}

/**
 * Standalone Supabase client for programme-service.
 * Targets the 'programme' schema where all programme tables live.
 * Used only by code that needs direct Supabase access outside the
 * connection/repository layer (e.g. ruleEngine.ts, variableCatalog.ts).
 *
 * DB connection for repositories is handled by createConnection() in api.js.
 */
export const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: 'programme' },
    })
  : (null as any)

/**
 * Supabase client for the family database.
 * Used by customFieldManager (ALTER TABLE) and ruleEngine (data fetching).
 * Targets the 'family' schema where family/member/address tables live.
 */
export const familySupabase = (familySupabaseUrl && familySupabaseKey)
  ? createClient(familySupabaseUrl, familySupabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: 'family' },
    })
  : (null as any)
