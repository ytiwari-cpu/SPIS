import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Check if there's a role_name type
const query1 = `SELECT typname FROM pg_type WHERE typname = 'role_name'`;
console.log('Checking for role_name type:');
const { data: typeData, error: typeError } = await supabase.rpc('exec_sql', {
  query: query1
});

if (typeError) {
  console.error('Error:', typeError);
} else {
  console.log('Result:', typeData);
}

// Check the actual column types
const query2 = `
  SELECT 
    table_name, 
    column_name, 
    data_type, 
    udt_name
  FROM information_schema.columns 
  WHERE table_name IN ('role_permissions', 'user_roles')
    AND column_name = 'role_name'
`;

console.log('\nChecking column data types:');
const { data: colData, error: colError } = await supabase.rpc('exec_sql', {
  query: query2
});

if (colError) {
  console.error('Error:', colError);
} else {
  console.log('Result:', JSON.stringify(colData, null, 2));
}

process.exit(0);
