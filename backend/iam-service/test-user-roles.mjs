import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const user_id = 'a0aafda3-f191-4864-8b28-85d6d03734cb';

// Test the query
const query = `SELECT * FROM user_roles WHERE user_id = '${user_id}'`;
console.log('Query:', query);

const { data, error } = await supabase.rpc('exec_sql', {
  query: query
});

if (error) {
  console.error('✗ Error:', error);
} else {
  console.log('✓ Result:', JSON.stringify(data, null, 2));
}

// Also try direct query
console.log('\n--- Testing direct Supabase query ---');
const { data: directData, error: directError } = await supabase
  .from('user_roles')
  .select('*')
  .eq('user_id', user_id);

if (directError) {
  console.error('✗ Direct Error:', directError);
} else {
  console.log('✓ Direct Result:', JSON.stringify(directData, null, 2));
}

process.exit(0);
