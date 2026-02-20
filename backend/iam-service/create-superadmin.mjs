#!/usr/bin/env node
/**
 * Create SuperAdmin user directly in Supabase using Supabase client
 */

import 'dotenv/config'
import bcrypt from 'bcrypt'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

async function createSuperAdmin() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  try {
    // User details
    const nationalId = '00000000000000'
    const email = 'ytiwari@argusoft.com'
    const password = 'Argus@1213141'

    console.log('Creating SuperAdmin user...')
    console.log('Email:', email)
    console.log('National ID:', nationalId)

    // Generate hashes
    const passwordHash = await bcrypt.hash(password, 10)
    const nationalIdHash = crypto.createHash('sha256').update(nationalId).digest('hex')

    console.log('✓ Password hash:', passwordHash.substring(0, 20) + '...')
    console.log('✓ National ID hash:', nationalIdHash)

    // Check if user exists
    const { data: existingUsers } = await supabase
      .from('users')
      .select('user_id, email')
      .or(`email.eq.${email},national_id_hash.eq.${nationalIdHash}`)

    let userId

    if (existingUsers && existingUsers.length > 0) {
      userId = existingUsers[0].user_id
      console.log('✓ User exists, updating:', userId)

      // Update password
      const { error: updateError } = await supabase
        .from('users')
        .update({
          password_hash: passwordHash,
          status: 'active',
          national_id_hash: nationalIdHash,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)

      if (updateError) throw updateError
      console.log('✓ Updated password and status')
    } else {
      // Create new user
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          email,
          password_hash: passwordHash,
          national_id_hash: nationalIdHash,
          status: 'active'
        })
        .select('user_id')
        .single()

      if (insertError) throw insertError
      userId = newUser.user_id
      console.log('✓ Created new user:', userId)
    }

    // Assign SuperAdmin role
    const { error: roleError } = await supabase
      .from('user_roles')
      .upsert({
        user_id: userId,
        role_name: 'SuperAdmin'
      }, {
        onConflict: 'user_id,role_name'
      })

    if (roleError) throw roleError
    console.log('✓ SuperAdmin role assigned')

    // Verify
    const { data: verification } = await supabase
      .from('users')
      .select(`
        user_id,
        email,
        status,
        created_at,
        user_roles (role_name)
      `)
      .eq('user_id', userId)
      .single()

    console.log('\n✅ SuperAdmin user ready!')
    console.log('User details:', verification)
    console.log('\nLogin credentials:')
    console.log('  National ID: 00000000000000')
    console.log('  Password: Argus@1213141')

    process.exit(0)
  } catch (error) {
    console.error('\n❌ Error:', error.message)
    console.error(error)
    process.exit(1)
  }
}

createSuperAdmin()
