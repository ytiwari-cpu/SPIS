/**
 * Create Super Admin User
 * Run with: npm run tsx src/scripts/createSuperAdmin.ts
 */

import 'dotenv/config'
import bcrypt from 'bcrypt'
import { pool } from '../db/pool.js'
import { hashNationalId } from '../lib/crypto.js'
import { addRole } from '../db/repository.js'

async function createSuperAdmin() {
  try {
    // User details
    const nationalId = '00000000000000'
    const email = 'ytiwari@argusoft.com'
    const password = 'Argus@1213141'

    console.log('Creating Super Admin user...')
    console.log(`Email: ${email}`)
    console.log(`National ID: ${nationalId}`)

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)
    console.log('✓ Password hashed')

    // Hash national ID
    const nationalIdHash = hashNationalId(nationalId)
    console.log('✓ National ID hashed')

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT user_id, email FROM users WHERE email = $1 OR national_id_hash = $2',
      [email, nationalIdHash]
    )

    if (existingUser.rows.length > 0) {
      console.log('\n⚠️  User already exists!')
      console.log('User ID:', existingUser.rows[0].user_id)
      console.log('Email:', existingUser.rows[0].email)
      
      // Update password and ensure SuperAdmin role
      const userId = existingUser.rows[0].user_id
      await pool.query(
        'UPDATE users SET password_hash = $1, status = $2, national_id_hash = $3 WHERE user_id = $4',
        [passwordHash, 'active', nationalIdHash, userId]
      )
      console.log('✓ Updated password and set status to active')

      // Ensure SuperAdmin role
      await addRole(userId as string, 'SuperAdmin')
      console.log('✓ SuperAdmin role assigned')

      console.log('\n✅ Super Admin user updated successfully!')
      console.log('\nLogin credentials:')
      console.log(`National ID: ${nationalId}`)
      console.log(`Email: ${email}`)
      console.log(`Password: ${password}`)
      
      await pool.end()
      process.exit(0)
    }

    // Create new user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, national_id_hash, status)
       VALUES ($1, $2, $3, $4)
       RETURNING user_id, email`,
      [email, passwordHash, nationalIdHash, 'active']
    )

    const userId = result.rows[0].user_id as string
    console.log('✓ User created')
    console.log('User ID:', userId)

    // Assign SuperAdmin role
    await addRole(userId, 'SuperAdmin')
    console.log('✓ SuperAdmin role assigned')

    console.log('\n✅ Super Admin user created successfully!')
    console.log('\nLogin credentials:')
    console.log(`National ID: ${nationalId}`)
    console.log(`Email: ${email}`)
    console.log(`Password: ${password}`)
    console.log('\nYou can now login at the SPIS portal')

    await pool.end()
    process.exit(0)
  } catch (error) {
    console.error('\n❌ Error creating Super Admin user:')
    console.error(error)
    await pool.end()
    process.exit(1)
  }
}

createSuperAdmin()
