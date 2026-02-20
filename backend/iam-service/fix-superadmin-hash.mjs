import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const national_id = '00000000000000';

// Hash with the correct format (with trn: prefix)
const normalized = national_id.replace(/\s/g, '').toUpperCase();
const national_id_hash = crypto
  .createHash('sha256')
  .update(`trn:${normalized}`)
  .digest('hex');

console.log('National ID:', national_id);
console.log('Normalized:', normalized);
console.log('Correct Hash (with trn: prefix):', national_id_hash);

// Update the user
const { data, error } = await supabase
  .from('users')
  .update({ national_id_hash })
  .eq('email', 'ytiwari@argusoft.com')
  .select();

if (error) {
  console.error('✗ Error updating user:', error);
  process.exit(1);
}

console.log('\n✓ User updated successfully');
console.log('User ID:', data[0].user_id);
console.log('New hash:', data[0].national_id_hash);

process.exit(0);
