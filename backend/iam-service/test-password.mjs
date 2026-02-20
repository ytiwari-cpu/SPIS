#!/usr/bin/env node
import bcrypt from 'bcrypt'

const password = 'Argus@1213141'
const storedHash = '$2b$10$YqB2vbr88sMUq21VMQ35/eB4jEKLXovOltnv6U2eNjaiqL/T6N9E2'

console.log('Testing password:', password)
console.log('Against hash:', storedHash)

const isValid = await bcrypt.compare(password, storedHash)
console.log('Password valid:', isValid)
