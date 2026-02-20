import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const national_id = '00000000000000';
const password = 'Argus@1213141';

// Hash the national_id
const national_id_hash = crypto
  .createHash('sha256')
  .update(national_id)
  .digest('hex');

console.log('Looking for user with national_id_hash:', national_id_hash);

// Try direct query first
const { data: user, error } = await supabase
  .from('users')
  .select('*')
  .eq('national_id_hash', national_id_hash)
  .single();

if (error) {
  console.error('Error fetching user:', error);
} else {
  console.log('\n✓ User found via Supabase client:');
  console.log('  user_id:', user.user_id);
  console.log('  email:', user.email);
  console.log('  status:', user.status);
  console.log('  password_hash:', user.password_hash);
  
  // Test password
  const isValid = await bcrypt.compare(password, user.password_hash);
  console.log('\n✓ Password validation:', isValid);
}

// Now test with RPC exec_sql
console.log('\n--- Testing RPC exec_sql ---');
const query = `SELECT * FROM users WHERE national_id_hash = '${national_id_hash}'`;
console.log('Query:', query);

const { data: rpcData, error: rpcError } = await supabase.rpc('exec_sql', {
  query: query
});

if (rpcError) {
  console.error('✗ RPC Error:', rpcError);
} else {
  console.log('✓ RPC Result:', rpcData);
  if (Array.isArray(rpcData) && rpcData.length > 0) {
    console.log('  Found user via RPC:', rpcData[0].user_id);
  } else {
    console.log('  ✗ No user found via RPC');
  }
}

process.exit(0);
