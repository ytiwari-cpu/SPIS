-- Migration: Allow duplicate emails, enforce unique national_id_hash
-- Workers/SuperAdmins may share emails across different systems

-- Drop unique constraint on email
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;

-- Add unique constraint on national_id_hash (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_national_id_hash_key'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_national_id_hash_key UNIQUE (national_id_hash);
  END IF;
END $$;

-- Keep the email index for performance (non-unique)
-- Already exists: CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
