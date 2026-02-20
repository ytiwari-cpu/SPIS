#!/usr/bin/env node
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const nationalId = '00000000000000'
const nationalIdHash = crypto.createHash('sha256').update(nationalId).digest('hex')

console.log('Looking for user with national_id_hash:', nationalIdHash)

const { data, error } = await supabase
  .from('users')
  .select('*, user_roles (*)')
  .eq('national_id_hash', nationalIdHash)

if (error) {
  console.error('Error:', error)
} else if (!data || data.length === 0) {
  console.log('User NOT found')
} else {
  console.log('User found:', JSON.stringify(data, null, 2))
}
