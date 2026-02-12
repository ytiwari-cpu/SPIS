import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.log('Missing env vars');
  process.exit(1);
}

const supabase = createClient(url, key, { db: { schema: 'family' } });

async function run() {
  // Try to get column info by inserting empty and seeing what columns are mentioned in error
  const {data, error} = await supabase.from('family_history').insert({}).select();
  console.log('Insert result - Data:', data);
  console.log('Insert result - Error:', error);
  process.exit(0);
}

run();
