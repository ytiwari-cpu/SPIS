-- Migration 012: Add password_hash column to users table
-- Passwords are stored as bcrypt hashes (set during worker registration or password reset)
-- NULL until the user sets a password for the first time.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash TEXT DEFAULT NULL;
