import { createClient } from '@supabase/supabase-js'

// ─── Programme Database Client ────────────────────────────────────────────────
const programmeUrl = process.env.PROGRAMME_SUPABASE_URL
const programmeServiceKey = process.env.PROGRAMME_SUPABASE_SERVICE_ROLE_KEY

if (!programmeUrl || !programmeServiceKey) {
    throw new Error('Missing Supabase environment variables: PROGRAMME_SUPABASE_URL and PROGRAMME_SUPABASE_SERVICE_ROLE_KEY')
}

/** Supabase client for programme schema */
export const supabase = createClient(programmeUrl, programmeServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
    db: {
        schema: 'programme',
    },
})

// ─── Family Database Client (read-only cross-service access) ──────────────────
const familyUrl = process.env.FAMILY_SUPABASE_URL
const familyServiceKey = process.env.FAMILY_SUPABASE_SERVICE_ROLE_KEY

if (!familyUrl || !familyServiceKey) {
    console.warn('⚠️  Missing Family Supabase env vars — rule engine family data lookup will fail')
}

/** Supabase client for family schema (read-only, used by rule engine) */
export const familySupabase = familyUrl && familyServiceKey
    ? createClient(familyUrl, familyServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        db: { schema: 'family' },
    })
    : null

// Test programme database connection
export async function testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.from('programme_master').select('programme_id').limit(1)
        if (error) {
            return { success: false, error: error.message }
        }
        return { success: true }
    } catch (err: unknown) {
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
}
