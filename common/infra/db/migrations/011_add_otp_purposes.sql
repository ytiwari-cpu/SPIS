-- ═══════════════════════════════════════════════════════════════
-- IAM Service Database Migration
-- Add 'otp_login' and 'worker_registration' to otp_purpose enum
-- ═══════════════════════════════════════════════════════════════
--
-- Project: SPIS IAM Service
-- Database: wrxrstmncezssrscrkxs (Supabase)
-- Run via: Supabase SQL Editor
-- Dashboard: https://supabase.com/dashboard/project/wrxrstmncezssrscrkxs
--
-- IMPORTANT: Run this in the Supabase SQL Editor for the IAM service database
--
-- ═══════════════════════════════════════════════════════════════

-- Add new values to the otp_purpose enum
ALTER TYPE otp_purpose ADD VALUE IF NOT EXISTS 'worker_registration';
ALTER TYPE otp_purpose ADD VALUE IF NOT EXISTS 'otp_login';

-- Verify the enum values
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = 'otp_purpose'::regtype 
ORDER BY enumsortorder;

-- Expected output:
-- password_reset
-- mfa_email
-- invite
-- worker_registration
-- otp_login
