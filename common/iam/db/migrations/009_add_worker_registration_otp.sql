-- Migration: Add 'worker_registration' to otp_purpose enum

ALTER TYPE otp_purpose ADD VALUE IF NOT EXISTS 'worker_registration';
