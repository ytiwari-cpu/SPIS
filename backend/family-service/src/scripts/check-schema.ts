import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

async function checkSchema() {
  console.log('Checking Supabase tables...\n')
  
  const tableNames = [
    'family', 'family_member', 'address', 'documents', 
    'document_verification', 'biometric_metadata', 
    'account_details', 'identity_match', 'family_history', 'family_event_outbox'
  ]

  for (const table of tableNames) {
    const { data, error } = await supabase.from(table).select('*').limit(1)
    if (error) {
      console.log(`❌ ${table}: ${error.message}`)
    } else {
      console.log(`✅ ${table}: OK`)
      if (data && data.length > 0) {
        console.log(`   Columns: ${Object.keys(data[0]).join(', ')}`)
      }
    }
  }
}

checkSchema()
