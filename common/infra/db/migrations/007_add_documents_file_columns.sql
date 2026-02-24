-- Add missing file metadata columns to documents table
-- Fixes: "Could not find the 'file_name' column of 'documents' in the schema cache"

ALTER TABLE family.documents
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS file_path TEXT,
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS file_url TEXT;

-- Optional: ensure status column exists for uploads
ALTER TABLE family.documents
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'UPLOADED';

-- Optional: ensure uploaded_at exists
ALTER TABLE family.documents
  ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ DEFAULT NOW();

-- Optional: ensure uploaded_by exists
ALTER TABLE family.documents
  ADD COLUMN IF NOT EXISTS uploaded_by TEXT;

-- Refresh PostgREST schema cache (Supabase)
NOTIFY pgrst, 'reload schema';
