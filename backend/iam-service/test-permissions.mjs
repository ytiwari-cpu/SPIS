import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const user_id = 'a0aafda3-f191-4864-8b28-85d6d03734cb';

// Replicate the exact query from getUserPermissions
const query = `SELECT DISTINCT p.permission_key
     FROM permissions p
     INNER JOIN role_permissions rp ON p.permission_key = rp.permission_key
     INNER JOIN user_roles ur ON rp.role_name = ur.role_name
     WHERE ur.user_id = '${user_id}'`;

console.log('Query:');
console.log(query);
console.log();

const { data, error } = await supabase.rpc('exec_sql', {
  query: query
});

if (error) {
  console.error('✗ Error:', error);
} else {
  console.log('✓ Result:', JSON.stringify(data, null, 2));
}

process.exit(0);
